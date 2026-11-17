import { useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  ChartColumn,
  Database,
  LayoutDashboard,
  ListOrdered,
  
  Upload,
} from "lucide-react";
import { useHub } from "./lib/hub/store";
import { Onboarding } from "./pages/Onboarding";
import { Overview } from "./pages/Overview";
import { Leaderboard } from "./pages/Leaderboard";
import { Segments } from "./pages/Segments";
import { ModelPage } from "./pages/ModelPage";
import { SqlExplorer } from "./pages/SqlExplorer";

type Page = "overview" | "leaderboard" | "segments" | "model" | "sql";

const TABS: { id: Page; label: string; hint: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", hint: "Signals", icon: LayoutDashboard },
  { id: "leaderboard", label: "Leaderboard", hint: "Top risk", icon: ListOrdered },
  { id: "segments", label: "Segments", hint: "Cohorts", icon: ChartColumn },
  { id: "model", label: "Model", hint: "Performance", icon: Activity },
  { id: "sql", label: "Explorer", hint: "Query", icon: Database },
];

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const init = useHub((s) => s.init);
  const loading = useHub((s) => s.loading);
  const ready = useHub((s) => s.ready);
  const onboardingDone = useHub((s) => s.onboardingDone);
  const trainMsg = useHub((s) => s.trainMsg);
  const scoreMsg = useHub((s) => s.scoreMsg);
  const uploadTrain = useHub((s) => s.uploadTrain);
  const uploadScore = useHub((s) => s.uploadScore);
  const completeOnboarding = useHub((s) => s.completeOnboarding);

  useEffect(() => {
    void init();
  }, [init]);

  if (loading) {
    return <div className="boot">Training chance signals…</div>;
  }

  if (!onboardingDone || showGuide) {
    return (
      <Onboarding
        onContinue={() => {
          completeOnboarding();
          setShowGuide(false);
        }}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="pulse" aria-hidden />
            <div>
              <h1>Chance Signal Hub</h1>
              <p className="sub">Live churn intelligence</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" className="sources-btn" onClick={() => setShowGuide(true)}>
              <BookOpen size={16} aria-hidden />
              Guide
            </button>
            <button type="button" className="sources-btn" onClick={() => setSourcesOpen((v) => !v)}>
              <Upload size={16} aria-hidden />
              Sources
            </button>
          </div>
        </div>
        {sourcesOpen && (
          <div className="sources-panel">
            <div className="sources-grid">
              <div className="upload">
                <label>Labeled training CSV (must include Churn)</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void f.text().then(uploadTrain);
                  }}
                />
                <span className={"msg " + (trainMsg.startsWith("Error") ? "err" : "ok")}>{trainMsg}</span>
              </div>
              <div className="upload">
                <label>New customers to score (optional)</label>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void f.text().then(uploadScore);
                  }}
                />
                <span className={"msg " + (scoreMsg.startsWith("Error") ? "err" : "ok")}>{scoreMsg}</span>
              </div>
              <p className="sources-help">
                Training needs <code>customerID, tenure, Contract, InternetService, MonthlyCharges, Churn</code>{" "}
                (0/1). Scoring uses the same features without Churn. Missing feature columns are filled from
                training medians / modes. Uploads stay in this browser session only.
              </p>
            </div>
          </div>
        )}
      </header>

      <nav className="tab-rail" aria-label="Pages">
        <div className="tab-inner">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                className={"tab" + (page === t.id ? " active" : "")}
                onClick={() => setPage(t.id)}
              >
                <Icon size={16} aria-hidden />
                {t.label}
                <span className="hint">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main className="main">
        {ready && page === "overview" && <Overview />}
        {ready && page === "leaderboard" && <Leaderboard />}
        {ready && page === "segments" && <Segments />}
        {ready && page === "model" && <ModelPage />}
        {ready && page === "sql" && <SqlExplorer />}
      </main>
    </div>
  );
}
