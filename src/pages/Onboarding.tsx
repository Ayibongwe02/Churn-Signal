type Props = { onContinue: () => void };

export function Onboarding({ onContinue }: Props) {
  return (
    <div className="boot" style={{ padding: "1.5rem" }}>
      <div className="onboard">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <span className="pulse" aria-hidden />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: "0.14em", color: "var(--signal)", textTransform: "uppercase" }}>
            Chance Signal Hub
          </span>
        </div>
        <h2>How this system works</h2>
        <p>
          Chance Signal Hub trains a live churn classifier on labeled customer history, then scores any cohort
          you load — so retention teams can see who is likely to leave before it happens.
        </p>
        <ol>
          <li>
            <strong>Train on outcomes.</strong> Use the bundled telco sample or upload a CSV with a{" "}
            <code>Churn</code> column (0/1) plus features such as tenure, contract, and monthly charges.
          </li>
          <li>
            <strong>Score a cohort.</strong> Score the training set itself, or upload new customers without
            labels. The model fills missing feature columns from training defaults.
          </li>
          <li>
            <strong>Read the bands.</strong> Stable · Watching · At Risk · Urgent map predicted probability to
            action priority. High-risk revenue is monthly charges held by At Risk and Urgent accounts.
          </li>
          <li>
            <strong>Drill in.</strong> Use Leaderboard for the top 50 risks, Segments for contract and service
            patterns, Model for holdout accuracy / ROC, and Explorer for quick filters.
          </li>
          <li>
            <strong>Act offline.</strong> Nothing is stored on a server — uploads stay in this session. Export
            insights to your CRM or retention playbooks however you work today.
          </li>
        </ol>
        <p style={{ marginBottom: "1.25rem" }}>
          Open <strong>Sources</strong> anytime to swap training or scoring data. Open <strong>Guide</strong>{" "}
          to revisit this page.
        </p>
        <button type="button" className="primary" onClick={onContinue}>
          Enter the hub
        </button>
      </div>
    </div>
  );
}
