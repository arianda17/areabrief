# AreaBrief — Field Supervisor Report Companion

**BuildHybridAI 2026** — Best Web/Chrome category target

AreaBrief helps area supervisors compile daily branch reports into a ranked area report. Instead of hand-compiling chat messages, the supervisor pastes one daily report per branch and gets:

1. **Per-branch summary on-device** — Gemini Nano via Firebase AI Logic hybrid inference (`PREFER_ON_DEVICE`). Instant, offline-capable, branch data never leaves the device for this pass. Falls back to cloud when Nano is unavailable (each card shows an engine badge: "On-device", "Cloud fallback", or "Local fallback" when no Firebase project is configured).
2. **Cross-branch area report** — Cloud pass via the same Firebase AI Logic SDK: branches ranked by sales, MTD vs last month, package totals, anomaly flags, one-paragraph executive summary.
3. **Copy / export** — clipboard copy and `.md` download.
4. **History** — saved reports in Firestore (online) with localStorage fallback (offline).

## Tech stack

- Vite + React + TypeScript (single-page app)
- Firebase JS SDK **v13.4.0** (`firebase` package)
  - `firebase/app` — app init
  - `firebase/auth` — anonymous sign-in
  - `firebase/firestore` — saved reports / history
  - `firebase/app-check` — debug provider for localhost
  - `firebase/remote-config` — anomaly threshold (%)
  - `firebase/ai` — Firebase AI Logic hybrid inference (`getAI`, `getGenerativeModel`, `GoogleAIBackend`, `InferenceMode.PREFER_ON_DEVICE`, `generateContent`, `response.inferenceSource`)

## Firebase AI Logic usage (exact code path)

Per-branch on-device pass (`src/firebase.ts`):

```ts
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode } from "firebase/ai";

const ai = getAI(firebaseApp, { backend: new GoogleAIBackend() });

const model = getGenerativeModel(ai, {
  mode: InferenceMode.PREFER_ON_DEVICE,
  inCloudParams: { model: "gemini-2.5-flash" },
});

await model.initializeDeviceModel(progress => console.log(progress));

const result = await model.generateContent(prompt);
const engine = result.response.inferenceSource === "on_device" ? "On-device" : "Cloud fallback";
const text = result.response.text();
```

Area report cloud pass:

```ts
const cloudModel = getGenerativeModel(ai, {
  mode: InferenceMode.ONLY_IN_CLOUD,
  inCloudParams: {
    model: "gemini-2.5-flash",
    generationConfig: { maxOutputTokens: 2000 },
  },
});

const text = (await cloudModel.generateContent(prompt)).response.text();
```

`response.inferenceSource` (available from JS SDK v12.5.0+) returns `"on_device"` or `"in_cloud"` (lowercase, per the installed `@firebase/ai` type definitions) and drives the engine badge on every result card.

On-device inference requires Chrome Desktop v139+ with the Prompt API enabled (`chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`). In environments without Nano (this VM included), `PREFER_ON_DEVICE` falls back to cloud and the badge reads "Cloud fallback". When no Firebase project is configured at all, the app uses a clearly labelled local template fallback instead and the badge reads "Local fallback".

## Prerequisites

- Node.js v24 (or recent LTS)
- A Firebase project (created by the parent — this repo does NOT create one)

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a Firebase project at https://console.firebase.google.com/ and register a web app. Copy the config values.

3. Create a `.env` file in the project root (not committed):

   ```sh
   VITE_FIREBASE_API_KEY=your_api_key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
   VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef
   ```

4. Enable required Firebase services in the console:
   - AI Logic (get started flow enforces App Check for AI Logic)
   - App Check — register the debug token shown in DevTools after first local load
   - Firestore — test mode for local dev
   - Remote Config — set `anomaly_threshold_percent` (default 25)

5. Run locally:

   ```sh
   npm run dev
   ```

   Open http://localhost:5173. Load demo data → summarize a branch → compile area report → copy/export.

## Demo flow (under 1 minute)

1. Click **Load Demo Data** — fills 8 Golden Cluck branches (fictional data).
2. Click **Summarize on-device** on any branch card — sees instant summary + engine badge.
3. Click **Compile Area Report** — cloud pass produces ranked area report.
4. Click **Copy Report** or **Export .md**.

## Build & preview

```sh
npm run build   # typecheck + Vite build
npm run preview # serve production build locally
```

## License

Apache-2.0. See LICENSE.

## Notes

- `src/firebase-config.ts` is a placeholder — replace `TODO_*` values with your real Firebase config from env vars.
- All branch/demo data is fictional (Golden Cluck fried chicken chain). No real user or business data.
- Free tier only. No paid APIs. No API keys committed.