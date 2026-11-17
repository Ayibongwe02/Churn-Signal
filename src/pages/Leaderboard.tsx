import { useMemo, useState } from "react";
import { useHub } from "../lib/hub/store";

export function Leaderboard() {
  const scored = useHub((s) => s.scored);
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const top = [...scored].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 50);
    if (!q.trim()) return top;
    const needle = q.trim().toLowerCase();
    return top.filter((r) => r.customerID.toLowerCase().includes(needle));
  }, [scored, q]);

  return (
    <div>
      <h2 className="page-title">High-risk leaderboard</h2>
      <p className="page-cap">Top 50 customers by predicted churn probability.</p>
      <div className="field">
        <input
          type="search"
          placeholder="Search customer ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Risk</th>
              <th>Band</th>
              <th>Tenure</th>
              <th>Contract</th>
              <th>Monthly</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.customerID}>
                <td>{r.customerID}</td>
                <td>{((r.risk_score || 0) * 100).toFixed(1)}%</td>
                <td>
                  <span className={"band band-" + String(r.risk_band).replace(" ", "")}>{r.risk_band}</span>
                </td>
                <td>{r.tenure}</td>
                <td>{r.Contract}</td>
                <td>${Number(r.MonthlyCharges).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
