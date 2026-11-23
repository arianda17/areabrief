// Firebase configuration placeholder
//
// TODO: Replace this placeholder with your real Firebase project config.
// 1. Create a Firebase project at https://console.firebase.google.com/
// 2. Register a web app and copy the config object from Project Settings.
// 3. Populate the values below from env vars (preferred) or hardcode temporarily for local testing.
// 4. DO NOT commit real API keys to a public repository.
//
// Environment variables expected at build/runtime:
//   VITE_FIREBASE_API_KEY
//   VITE_FIREBASE_AUTH_DOMAIN
//   VITE_FIREBASE_PROJECT_ID
//   VITE_FIREBASE_STORAGE_BUCKET
//   VITE_FIREBASE_MESSAGING_SENDER_ID
//   VITE_FIREBASE_APP_ID
//   VITE_FIREBASE_MEASUREMENT_ID (optional)

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "TODO_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "TODO_PROJECT.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "TODO_PROJECT",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "TODO_PROJECT.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:TODO",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
} as const;

// Remote Config default values (fallbacks when Remote Config is unavailable)
export const REMOTE_CONFIG_DEFAULTS = {
  anomaly_threshold_percent: "25", // % drop in sales vs last month to flag as anomaly
} as const;
