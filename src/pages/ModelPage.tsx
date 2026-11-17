import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHub } from "../lib/hub/store";

export function ModelPage() {
  const metrics = useHub((s) => s.metrics);
  const importance = useHub((s) => s.importance);
  if (!metrics) return <p className="page-cap">Model not ready.</p>;
  const { confusion: c } = metrics;
  const roc = metrics.roc.fpr.map((f, i) => ({ fpr: f, tpr: metrics.roc.tpr[i] }));

  return (
    <div>
      <h2 className="page-title">Model performance</h2>
      <p className="page-cap">
        Holdout metrics from an 80/20 split on the labeled training set. Classifier: logistic regression on
        one-hot + numeric features (browser-side stand-in for the original RandomForest).
      </p>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="label">Accuracy</div>
          <div className="value">{(metrics.accuracy * 100).toFixed(1)}%</div>
        </div>
        <div className="kpi">
          <div className="label">ROC-AUC</div>
          <div className="value">{metrics.roc_auc.toFixed(3)}</div>
        </div>
        <div className="kpi">
          <div className="label">Train / test</div>
          <div className="value" style={{ fontSize: "1.1rem" }}>
            {metrics.n_train} / {metrics.n_test}
          </div>
        </div>
      </div>
      <h3 className="section">Confusion matrix (test)</h3>
      <div className="table-wrap" style={{ maxWidth: 360, marginBottom: "1rem" }}>
        <table className="data">
          <thead>
            <tr>
              <th></th>
              <th>Pred 0</th>
              <th>Pred 1</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Actual 0</td>
              <td>{c.tn}</td>
              <td>{c.fp}</td>
            </tr>
            <tr>
              <td>Actual 1</td>
              <td>{c.fn}</td>
              <td>{c.tp}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3 className="section">ROC curve</h3>
      <div className="card" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={roc}>
            <XAxis dataKey="fpr" type="number" domain={[0, 1]} tick={{ fill: "#8A93A6", fontSize: 11 }} />
            <YAxis dataKey="tpr" type="number" domain={[0, 1]} tick={{ fill: "#8A93A6", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#191D26", border: "1px solid #262B36" }} />
            <Line type="monotone" dataKey="tpr" stroke="#00D9C0" dot={false} name="TPR" />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <h3 className="section">Top feature signals</h3>
      <div className="card" style={{ height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={importance} layout="vertical" margin={{ left: 24 }}>
            <XAxis type="number" tick={{ fill: "#8A93A6", fontSize: 11 }} />
            <YAxis type="category" dataKey="feature" width={140} tick={{ fill: "#8A93A6", fontSize: 10 }} />
            <Tooltip contentStyle={{ background: "#191D26", border: "1px solid #262B36" }} />
            <Bar dataKey="importance" fill="#00D9C0" name="|weight|" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
