// Enable App Check debug provider for LOCAL DEV ONLY (vite dev server).
// Per Firebase docs: self.FIREBASE_APPCHECK_DEBUG_TOKEN must be set BEFORE initializeAppCheck.
// Gated to import.meta.env.DEV so production builds (preview/hosting) use the real
// reCAPTCHA Enterprise provider instead. Do NOT ship debug tokens in production.
if (typeof self !== "undefined" && import.meta.env.DEV) {
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);