// Firebase initialization + AI Logic wrapper for AreaBrief.
//
// This file wires up:
//   - firebase/app      : initializeApp
//   - firebase/auth     : anonymous auth on load
//   - firebase/firestore: saved reports / history
//   - firebase/app-check: debug provider for local dev
//   - firebase/remote-config: anomaly threshold (%)
//   - firebase/ai       : Firebase AI Logic hybrid inference (prefer-on-device)
//
// NOTE: firebase-config.ts uses placeholder values read from Vite env vars.
// The parent supplies real config values after creating a Firebase project.
// Until then, Firebase init may throw on real network calls, so the app degrades
// gracefully: AI calls return fallback/simulated results and Firestore falls back
// to localStorage. This lets the full UI flow be verified locally without a live project.

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously, type User } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { initializeAppCheck, type AppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { getRemoteConfig, type RemoteConfig } from "firebase/remote-config";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type GenerativeModel,
} from "firebase/ai";

import { firebaseConfig, REMOTE_CONFIG_DEFAULTS } from "./firebase-config";

// ---------------------------------------------------------------------------
// Firebase app + services (lazily initialized so the UI can render without keys)
// ---------------------------------------------------------------------------

let firebaseApp: FirebaseApp | null = null;
let authUser: User | null = null;
let firestore: Firestore | null = null;
let appCheckInstance: AppCheck | null = null;
let remoteConfig: RemoteConfig | null = null;

let deviceModel: GenerativeModel | null = null;   // PREFER_ON_DEVICE model instance
let cloudModel: GenerativeModel | null = null;    // ONLY_IN_CLOUD model instance

let firebaseError: string | null = null;

/**
 * Attempt to initialize Firebase and all services. Safe to call multiple times.
 * Returns an object describing readiness and any error encountered.
 */
export function initFirebase(): {
  ready: boolean;
  user: User | null;
  error: string | null;
} {
  if (firebaseApp) {
    return { ready: !!authUser, user: authUser, error: firebaseError };
  }

  // Quick sanity check: placeholder keys mean no real Firebase project yet.
  const isPlaceholder =
    !firebaseConfig.apiKey ||
    firebaseConfig.apiKey === "TODO_API_KEY" ||
    firebaseConfig.projectId === "TODO_PROJECT";

  if (isPlaceholder) {
    firebaseError = "Firebase project config not set — see src/firebase-config.ts TODO";
    return { ready: false, user: null, error: firebaseError };
  }

  try {
    firebaseApp = initializeApp(firebaseConfig);

    // App Check with reCAPTCHA Enterprise (Fraud Defense): the site key in
    // VITE_RECAPTCHA_SITE_KEY is the Enterprise key registered in the Firebase
    // console App Check (classic reCAPTCHA v3 is deprecated there and its field
    // is disabled). ReCaptchaV3Provider must NOT be used with this key.
    const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (recaptchaSiteKey) {
      appCheckInstance = initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else {
      console.warn(
        "App Check not initialized — missing VITE_RECAPTCHA_SITE_KEY env var. " +
          "Set it in .env to enable App Check (required for AI Logic in production). " +
          "Debug token (self.FIREBASE_APPCHECK_DEBUG_TOKEN) is set in main.tsx for local dev."
      );
    }

    authUser = null; // set after signInAnonymously resolves
    void signInAnonymously(getAuth(firebaseApp)).then((cred) => {
      authUser = cred.user;
    });

    firestore = getFirestore(firebaseApp);
    remoteConfig = getRemoteConfig(firebaseApp);

    // AI Logic: initialize service with Gemini Developer API backend
    const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

    // Per-branch on-device pass: prefer Nano, fall back to cloud
    deviceModel = getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: { model: "gemini-2.5-flash" },
      onDeviceParams: {
        createOptions: {
          expectedInputs: [{ type: "text", languages: ["en"] }],
          expectedOutputs: [{ type: "text", languages: ["en"] }],
          initialPrompts: [
            {
              role: "system",
              content: [{ type: "text", value: "You are a concise branch report summarizer. Summarize the branch's daily report into 2-3 sentences and flag anomalies (sales drops, stock-outs, high returns, unusual patterns). Be brief and actionable." }],
            },
          ],
        },
      },
    });

    // Area report compile pass: cloud only (needs cross-branch reasoning)
    cloudModel = getGenerativeModel(ai, {
      mode: InferenceMode.ONLY_IN_CLOUD,
      inCloudParams: {
        model: "gemini-2.5-flash",
        generationConfig: { maxOutputTokens: 2000 },
      },
    });

    return { ready: !!authUser, user: authUser, error: null };
  } catch (err: any) {
    firebaseError = err?.message || String(err);
    return { ready: false, user: null, error: firebaseError };
  }
}

/** Sign in anonymously. Call after initFirebase(). */
export async function signInAnon(): Promise<User | null> {
  if (!firebaseApp) {
    const state = initFirebase();
    if (!state.ready) return null;
  }
  try {
    const cred = await signInAnonymously(getAuth(firebaseApp!));
    authUser = cred.user;
    return authUser;
  } catch (err: any) {
    firebaseError = err?.message || String(err);
    return null;
  }
}

/** Ensure the on-device model is initialized (must be after user activation). */
export async function ensureDeviceModel(monitor?: (progress: number) => void): Promise<void> {
  if (!deviceModel) {
    throw new FirebaseError("AI Logic not initialized — Firebase project config missing");
  }
  await deviceModel.initializeDeviceModel((val: number) => {
    monitor?.(val);
  });
}

/** Per-branch on-device summary pass. Returns { text, engine } where engine is "On-device" | "Cloud fallback". */
export async function summarizeBranch(prompt: string): Promise<{ text: string; engine: "On-device" | "Cloud fallback" }> {
  if (!deviceModel) {
    throw new Error("AI Logic not initialized — Firebase project config missing");
  }
  const result = await deviceModel.generateContent(prompt);
  const engine = result.response.inferenceSource === "on_device" ? "On-device" : "Cloud fallback";
  return { text: result.response.text(), engine };
}

/** Compile cross-branch area report via cloud pass. Returns the markdown report text. */
export async function compileAreaReport(prompt: string): Promise<string> {
  if (!cloudModel) {
    throw new Error("AI Logic not initialized — Firebase project config missing");
  }
  const result = await cloudModel.generateContent(prompt);
  return result.response.text();
}

/** Fallback text used when Firebase/AI is unavailable (offline or no project). */
export function fallbackBranchSummary(branchName: string, dailySales: number, note: string): { text: string; engine: "Local fallback" } {
  return {
    text: `${branchName} reported $${dailySales.toLocaleString()} in daily sales. ${note || "No notes provided."} (Local fallback — Firebase AI not available.)`,
    engine: "Local fallback",
  };
}

/** Local fallback for area report when cloud is unavailable. */
export function fallbackAreaReport(branches: { name: string; dailySales: number; mtdSales: number; lastMonthMtd: number; note: string }[]): string {
  const total = branches.reduce((s, b) => s + b.dailySales, 0);
  const lines = branches.map((b) => `- ${b.name}: $${b.dailySales.toLocaleString()} (${b.note || "no notes"})`).join("\n");
  return `# Area Report (Local Fallback)\n\nTotal daily sales: $${total.toLocaleString()}\n\nBranches:\n${lines}\n\n*Generated without Firebase AI Logic — real project config needed for AI-powered compilation.*`;
}

class FirebaseError extends Error {}

export { firebaseApp, authUser as firebaseUser, firestore, appCheckInstance as appCheck, remoteConfig };

// ---------------------------------------------------------------------------
// Remote Config — fetch and activate anomaly threshold
// ---------------------------------------------------------------------------

export async function fetchAnomalyThreshold(): Promise<string> {
  if (!remoteConfig) return REMOTE_CONFIG_DEFAULTS.anomaly_threshold_percent;
  try {
    const { fetchAndActivate, getString } = await import("firebase/remote-config");
    await fetchAndActivate(remoteConfig);
    return getString(remoteConfig, "anomaly_threshold_percent");
  } catch (err: any) {
    console.warn("Remote Config fetch failed:", err?.message || err);
    return REMOTE_CONFIG_DEFAULTS.anomaly_threshold_percent;
  }
}

// ---------------------------------------------------------------------------
// Firestore — save compiled area report to history
// ---------------------------------------------------------------------------

export async function saveAreaReport(
  reportText: string,
  branches: { name: string; dailySales: number }[],
): Promise<void> {
  if (!firestore) return; // local fallback only — no-op when Firestore unavailable
  try {
    const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");
    await addDoc(collection(firestore, "area_reports"), {
      reportText,
      branchCount: branches.length,
      branchNames: branches.map((b) => b.name),
      totalDailySales: branches.reduce((s, b) => s + b.dailySales, 0),
      createdAt: serverTimestamp(),
      source: "cloud",
    });
  } catch (err: any) {
    console.warn("Firestore save failed:", err?.message || err);
  }
}
