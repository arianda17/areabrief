import { useCallback, useEffect, useState } from "react";
import type { BranchReport, PackageCounts } from "./types";
import { PACKAGE_KEYS } from "./types";
import { DEMO_DATA } from "./demo-data";
import {
  initFirebase,
  signInAnon,
  ensureDeviceModel,
  summarizeBranch,
  compileAreaReport,
  fallbackBranchSummary,
  fallbackAreaReport,
  fetchAnomalyThreshold,
  saveAreaReport,
} from "./firebase";

import "./App.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyPackages(): PackageCounts {
  return {
    "Bucket 1": 0, "Bucket 2": 0, "Bucket 3": 0, "Bucket 4": 0,
    "Family Bucket 1": 0, "Family Bucket 2": 0, "Family Bucket 3": 0, "Family Bucket 4": 0,
    "Value Meal 1": 0, "Value Meal 2": 0, "Value Meal 3": 0, "Value Meal 4": 0,
    "Meal Box 1": 0, "Meal Box 2": 0, "Meal Box 3": 0, "Meal Box 4": 0, "Jumbo Tea": 0,
  };
}

function newBranchId(): string {
  return "branch_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function emptyBranch(): BranchReport {
  return {
    id: newBranchId(),
    branchName: "",
    dailySales: 0,
    customers: 0,
    mtdSales: 0,
    lastMonthMtd: 0,
    packages: emptyPackages(),
    note: "",
    status: "idle",
  };
}

function vsLastMonthPct(mtd: number, lastMonthMtd: number): number {
  if (!lastMonthMtd) return 0;
  return ((mtd - lastMonthMtd) / lastMonthMtd) * 100;
}

function currency(n: number): string {
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// LocalStorage keys for offline history fallback
const STORAGE_KEY = "areabrief_history_v1";
const STORAGE_BRANCHES = "areabrief_branches_v1";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildBranchPrompt(b: BranchReport): string {
  const pkgLines = Object.entries(b.packages)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join("\n");
  const vs = vsLastMonthPct(b.mtdSales, b.lastMonthMtd);
  return `You are a concise branch report summarizer for a fried-chicken restaurant chain (Golden Cluck).

Branch: ${b.branchName}
Daily sales: ${currency(b.dailySales)}
Customers: ${b.customers}
MTD sales: ${currency(b.mtdSales)} (last month MTD: ${currency(b.lastMonthMtd)}, change: ${vs >= 0 ? "+" : ""}${vs.toFixed(1)}%)
Package counts:
${pkgLines || "  (none)"}
Free-text note: ${b.note || "(none)"}

Task: Summarize this branch's daily report in 2-3 sentences. Flag any anomalies: sudden sales drop vs last month MTD, stock-outs, unusually high returns, or other unusual patterns. Be brief and actionable. Output plain text only, no markdown formatting.`;
}

function buildAreaPrompt(branches: BranchReport[], thresholdPct: number): string {
  const lines = branches.map((b) => {
    const vs = vsLastMonthPct(b.mtdSales, b.lastMonthMtd);
    const pkgTotal = Object.values(b.packages).reduce((a, v) => a + v, 0);
    return `- ${b.branchName}: daily sales ${currency(b.dailySales)}, customers ${b.customers}, MTD ${currency(b.mtdSales)} (vs last month ${vs >= 0 ? "+" : ""}${vs.toFixed(1)}%), packages sold ${pkgTotal}. Note: ${b.note || "(none)"}`;
  }).join("\n");

  return `You are an area supervisor assistant for Golden Cluck fried chicken chain. Compile an area report from the following branch daily reports.

Branches:
${lines}

Threshold for anomaly flagging: ${thresholdPct}% drop in MTD sales vs last month MTD.

Produce a formatted area report with:
1. Branches ranked by daily sales (highest first), with MTD vs last month % change shown.
2. Total daily sales across all branches.
3. Package totals across all branches (group each package type).
4. Anomalies across branches (sales drops above threshold, stock-outs, high returns, unusual patterns) — list each with branch name.
5. One-paragraph executive summary.

Output plain text only, no markdown formatting. Be concise and actionable for a field supervisor.`;
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

export default function App() {
  const [branches, setBranches] = useState<BranchReport[]>([]);
  const [areaReport, setAreaReport] = useState<{ text: string; engine: "Cloud" | "Local fallback"; loading: boolean; error?: string }>({ text: "", engine: "Cloud", loading: false });
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [firebaseState, setFirebaseState] = useState<{ ready: boolean; user: any; error: string | null }>({ ready: false, user: null, error: null });
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [remoteConfigLoaded, setRemoteConfigLoaded] = useState(false);
  const [anomalyThreshold, setAnomalyThreshold] = useState(25);
  const [hasSummary, setHasSummary] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<{ id: string; text: string; ts: number }[]>(
    loadFromStorage(STORAGE_KEY, [] as { id: string; text: string; ts: number }[])
  );

  // ---- Firebase init on mount ----
  useEffect(() => {
    const state = initFirebase();
    setFirebaseState(state);
    // Call signInAnon unconditionally after init; update state when user resolves.
    void signInAnon().then((u) => {
      // Use `state.error` (captured above), NOT firebaseState.error: the
      // state variable in this closure is the initial render's value (null).
      setFirebaseState({ ready: !!u, user: u, error: state.error });
    });
  }, []);

  // ---- Load branches: demo data or local storage ----
  useEffect(() => {
    const stored = loadFromStorage(STORAGE_BRANCHES, null as BranchReport[] | null);
    setBranches(stored ? stored : DEMO_DATA.map((b) => ({ ...b })));
    setHasSummary(new Set());
  }, []);

  // ---- Remote Config: anomaly threshold ----
  useEffect(() => {
    if (!firebaseState.ready || remoteConfigLoaded) return;
    void fetchAnomalyThreshold().then((val) => {
      const pct = Number(val) || 25;
      setAnomalyThreshold(pct);
      setRemoteConfigLoaded(true);
    });
  }, [firebaseState.ready, remoteConfigLoaded]);

  // ---- Actions ----

  const addBranch = useCallback(() => {
    const b = emptyBranch();
    setBranches((prev) => [...prev, b]);
    saveToStorage(STORAGE_BRANCHES, [...branches, b]);
  }, [branches]);

  const updateBranch = useCallback((id: string, updates: Partial<BranchReport>) => {
    setBranches((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    saveToStorage(STORAGE_BRANCHES, branches.map((b) => (b.id === id ? { ...b, ...updates } : b)));
    setHasSummary((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, [branches]);

  const deleteBranch = useCallback((id: string) => {
    setBranches((prev) => prev.filter((b) => b.id !== id));
    saveToStorage(STORAGE_BRANCHES, branches.filter((b) => b.id !== id));
    setHasSummary((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, [branches]);

  const loadDemoData = useCallback(() => {
    const demo = DEMO_DATA.map((b) => ({ ...b }));
    setBranches(demo);
    setHasSummary(new Set());
    setAreaReport({ text: "", engine: "Cloud", loading: false });
    saveToStorage(STORAGE_BRANCHES, demo);
    setStatusMessage("Demo data loaded — Golden Cluck, 8 branches");
  }, []);

  // Per-branch summary (on-device pass via Firebase AI Logic)
  const summarizeOnDevice = useCallback(async (branch: BranchReport) => {
    setLoading((prev) => ({ ...prev, [branch.id]: true }));
    setHasSummary((prev) => { const next = new Set(prev); next.delete(branch.id); return next; });

    try {
      // Ensure on-device model is ready (must be after user activation — this is a button click)
      await ensureDeviceModel();

      const prompt = buildBranchPrompt(branch);
      const { text, engine } = await summarizeBranch(prompt);

      setBranches((prev) => prev.map((b) =>
        b.id === branch.id ? { ...b, onDeviceSummary: text, onDeviceFlags: [], engineBadge: engine, status: "done" as const } : b
      ));
      saveToStorage(STORAGE_BRANCHES, branches.map((b) =>
        b.id === branch.id ? { ...b, onDeviceSummary: text, onDeviceFlags: [], engineBadge: engine, status: "done" as const } : b
      ));
      setHasSummary((prev) => { const next = new Set(prev); next.add(branch.id); return next; });
      setStatusMessage(`Summarized ${branch.branchName} — engine: ${engine}`);
    } catch (err: any) {
      // Graceful fallback if AI call fails (no project, no network, Nano unavailable)
      const fb = fallbackBranchSummary(branch.branchName, branch.dailySales, branch.note);
      setBranches((prev) => prev.map((b) =>
        b.id === branch.id ? { ...b, onDeviceSummary: fb.text, engineBadge: fb.engine, status: "done" as const, error: String(err?.message || err) } : b
      ));
      saveToStorage(STORAGE_BRANCHES, branches.map((b) =>
        b.id === branch.id ? { ...b, onDeviceSummary: fb.text, engineBadge: fb.engine, status: "done" as const, error: String(err?.message || err) } : b
      ));
      setHasSummary((prev) => { const next = new Set(prev); next.add(branch.id); return next; });
      setStatusMessage(`Fallback used for ${branch.branchName}: ${err?.message || String(err)}`);
    } finally {
      setLoading((prev) => { const next = { ...prev }; delete next[branch.id]; return next; });
    }
  }, [branches]);

  // Compile area report (cloud pass via Firebase AI Logic)
  const compileReport = useCallback(async () => {
    if (branches.length === 0) return;
    setAreaReport({ text: "", engine: "Cloud", loading: true });

    try {
      // Ensure device model initialized too (lazy init on first interaction)
      try { await ensureDeviceModel(); } catch { /* cloud-only path may not need it */ }

      const prompt = buildAreaPrompt(branches, anomalyThreshold);
      const text = await compileAreaReport(prompt);

      setAreaReport({ text, engine: "Cloud", loading: false });
      setStatusMessage("Area report compiled (cloud pass)");

      // Persist to Firestore history (no-op if Firestore unavailable)
      const lite = branches.map((b) => ({ name: b.branchName, dailySales: b.dailySales }));
      void saveAreaReport(text, lite);

      // Local history fallback
      const entry = { id: Date.now().toString(36), text, ts: Date.now() };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 20);
        saveToStorage(STORAGE_KEY, next);
        return next;
      });
    } catch (err: any) {
      // Local fallback report
      const lite = branches.map((b) => ({ name: b.branchName, dailySales: b.dailySales, mtdSales: b.mtdSales, lastMonthMtd: b.lastMonthMtd, note: b.note }));
      const text = fallbackAreaReport(lite);
      setAreaReport({ text, engine: "Local fallback", loading: false, error: String(err?.message || err) });
      setStatusMessage(`Fallback area report: ${err?.message || String(err)}`);
      // Persist fallback report to history too (Firestore no-op if unavailable)
      void saveAreaReport(text, branches.map((b) => ({ name: b.branchName, dailySales: b.dailySales })));
      const entry = { id: Date.now().toString(36), text, ts: Date.now() };
      setHistory((prev) => {
        const next = [entry, ...prev].slice(0, 20);
        saveToStorage(STORAGE_KEY, next);
        return next;
      });
    }
  }, [branches, anomalyThreshold]);

  // Copy report to clipboard
  const copyReport = useCallback(async () => {
    const text = areaReport.text || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage("Report copied to clipboard");
    } catch {
      // fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setStatusMessage("Report copied to clipboard");
    }
  }, [areaReport.text]);

  // Export report as .md file
  const exportReport = useCallback(() => {
    const text = areaReport.text || "";
    if (!text) return;
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `area-report-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatusMessage("Report exported as .md");
  }, [areaReport.text]);

  // ---- Render helpers ----

  const summaryBadge = (engine: "On-device" | "Cloud fallback" | "Local fallback" | undefined) => {
    if (!engine) return <span className="badge badge-idle">Pending</span>;
    if (engine === "On-device") return <span className="badge badge-ondevice">On-device</span>;
    if (engine === "Local fallback") return <span className="badge badge-local">Local fallback</span>;
    return <span className="badge badge-cloud">Cloud fallback</span>;
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>AreaBrief</h1>
        <p className="subtitle">Field Supervisor Report Companion — Golden Cluck</p>
      </header>

      {/* Firebase / status banner */}
      <div className="status-banner">
        {firebaseState.error ? (
          <span className="status-warn">⚠ {firebaseState.error}</span>
        ) : firebaseState.ready ? (
          <span className="status-ok">✓ Firebase connected (anonymous user: {firebaseState.user?.uid?.slice(0, 8) ?? "…"})</span>
        ) : (
          <span className="status-warn">⏳ Initializing Firebase…</span>
        )}
        {statusMessage && <span className="status-msg">{statusMessage}</span>}
      </div>

      <div className="toolbar">
        <button className="btn btn-primary" onClick={loadDemoData} disabled={loading.demo}>
          📦 Load Demo Data
        </button>
        <button className="btn" onClick={addBranch} disabled={loading.demo}>
          ➕ Add Branch
        </button>
        <button className="btn btn-success" onClick={compileReport} disabled={areaReport.loading || branches.length === 0}>
          {areaReport.loading ? "Compiling area report…" : "📊 Compile Area Report"}
        </button>
        {areaReport.text && (
          <>
            <button className="btn" onClick={copyReport}>📋 Copy Report</button>
            <button className="btn" onClick={exportReport}>⬇ Export .md</button>
          </>
        )}
      </div>

      {/* Branch editor section */}
      <section className="section">
        <h2>Branch Reports</h2>
        <p className="hint">Enter one daily report per branch (sales, packages, notes). Then summarize each branch on-device.</p>

        {branches.length === 0 && (
          <div className="empty-state">
            <p>No branches yet. Click "Add Branch" or "Load Demo Data" to get started.</p>
          </div>
        )}

        <div className="branch-grid">
          {branches.map((branch) => (
            <article key={branch.id} className={`branch-card ${branch.status === "summarizing" ? "summarizing" : ""} ${branch.status === "error" ? "error" : ""}`}>
              <div className="card-header">
                <h3>{branch.branchName || "(unnamed branch)"}</h3>
                <button className="btn-delete" onClick={() => deleteBranch(branch.id)} title="Delete">✕</button>
              </div>

              <div className="card-body">
                <div className="field-row">
                  <label>Branch name</label>
                  <input
                    value={branch.branchName}
                    onChange={(e) => updateBranch(branch.id, { branchName: e.target.value })}
                    disabled={branch.status === "summarizing"}
                  />
                </div>
                <div className="field-row">
                  <label>Daily sales</label>
                  <input type="number" value={branch.dailySales} onChange={(e) => updateBranch(branch.id, { dailySales: Number(e.target.value) || 0 })} disabled={branch.status === "summarizing"} />
                </div>
                <div className="field-row">
                  <label>Customers</label>
                  <input type="number" value={branch.customers} onChange={(e) => updateBranch(branch.id, { customers: Number(e.target.value) || 0 })} disabled={branch.status === "summarizing"} />
                </div>
                <div className="field-row">
                  <label>MTD sales</label>
                  <input type="number" value={branch.mtdSales} onChange={(e) => updateBranch(branch.id, { mtdSales: Number(e.target.value) || 0 })} disabled={branch.status === "summarizing"} />
                </div>
                <div className="field-row">
                  <label>Last month MTD</label>
                  <input type="number" value={branch.lastMonthMtd} onChange={(e) => updateBranch(branch.id, { lastMonthMtd: Number(e.target.value) || 0 })} disabled={branch.status === "summarizing"} />
                </div>
                <div className="field-row">
                  <label>Free-text note</label>
                  <textarea value={branch.note} onChange={(e) => updateBranch(branch.id, { note: e.target.value })} disabled={branch.status === "summarizing"} />
                </div>

                <div className="package-grid">
                  <h4>Package counts</h4>
                  {PACKAGE_KEYS.map((key) => (
                    <div className="pkg-field" key={key}>
                      <label>{key}</label>
                      <input type="number" value={branch.packages[key]} onChange={(e) => updateBranch(branch.id, { packages: { ...branch.packages, [key]: Number(e.target.value) || 0 } })} disabled={branch.status === "summarizing"} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-footer">
                <button
                  className={`btn ${hasSummary.has(branch.id) ? "btn-outline" : "btn-primary"}`}
                  onClick={() => summarizeOnDevice(branch)}
                  disabled={branch.status === "summarizing" || loading[branch.id]}
                >
                  {branch.status === "summarizing" || loading[branch.id] ? "Summarizing…" : hasSummary.has(branch.id) ? "Re-summarize" : "Summarize on-device"}
                </button>
                {branch.engineBadge && summaryBadge(branch.engineBadge)}
                {branch.error && <span className="card-error">Error: {branch.error}</span>}
              </div>

              {branch.onDeviceSummary && (
                <div className="card-summary">
                  <strong>Summary:</strong> {branch.onDeviceSummary}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* Area report section */}
      {areaReport.text && (
        <section className="section report-section">
          <h2>Area Report</h2>
          <p className="hint">Cross-branch compilation (cloud pass). Ranked table, package totals, anomalies, executive summary.</p>
          <div className="report-card">
            <pre>{areaReport.text}</pre>
          </div>
          <div className="report-actions">
            <span className={areaReport.engine === "Local fallback" ? "badge badge-local" : "badge badge-cloud"}>{areaReport.engine}</span>
            {areaReport.error && <span className="card-error">{areaReport.error}</span>}
          </div>
        </section>
      )}

      {/* History section */}
      {history.length > 0 && (
        <section className="section history-section">
          <h2>History</h2>
          <p className="hint">Saved area reports (localStorage fallback; Firestore when Firebase project is configured).</p>
          <div className="history-list">
            {history.map((entry) => (
              <article key={entry.id} className="history-item">
                <div className="history-meta">{new Date(entry.ts).toLocaleString()}</div>
                <button className="btn btn-outline" onClick={() => setAreaReport({ text: entry.text, engine: entry.text.startsWith("# Area Report (Local Fallback)") ? "Local fallback" : "Cloud", loading: false })}>
                  Load report
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}