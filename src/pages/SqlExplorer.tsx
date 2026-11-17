import { useMemo, useState } from "react";
import { useHub } from "../lib/hub/store";
import type { RiskBand } from "../lib/hub/engine";

export function SqlExplorer() {
  const scored = useHub((s) => s.scored);
  const [band, setBand] = useState<string>("all");
  const [contract, setContract] = useState<string>("all");
  const [minRisk, setMinRisk] = useState(0);

  const contracts = useMemo(
    () => [...new Set(scored.map((r) => String(r.Contract)))].sort(),
    [scored],
  );

  const rows = useMemo(() => {
    return scored
      .filter((r) => (band === "all" ? true : r.risk_band === band))
      .filter((r) => (contract === "all" ? true : r.Contract === contract))
      .filter((r) => (r.risk_score || 0) >= minRisk)
      .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
      .slice(0, 100);
  }, [scored, band, contract, minRisk]);

  return (
    <div>
      <h2 className="page-title">Explorer</h2>
      <p className="page-cap">
        Filter the scored cohort without SQL. Results are capped at 100 rows for readability.
      </p>
      <div className="field">
        <label>
          Risk band{" "}
          <select value={band} onChange={(e) => setBand(e.target.value)}>
            <option value="all">All</option>
            {(["Stable", "Watching", "At Risk", "Urgent"] as RiskBand[]).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </label>
        <label>
          Contract{" "}
          <select value={contract} onChange={(e) => setContract(e.target.value)}>
            <option value="all">All</option>
            {contracts.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Min risk {(minRisk * 100).toFixed(0)}%{" "}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={minRisk}
            onChange={(e) => setMinRisk(Number(e.target.value))}
          />
        </label>
      </div>
      <p className="msg ok" style={{ marginBottom: "0.75rem" }}>
        Showing {rows.length} of {scored.length} customers
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Risk</th>
              <th>Band</th>
              <th>Contract</th>
              <th>Internet</th>
              <th>Tenure</th>
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
                <td>{r.Contract}</td>
                <td>{r.InternetService}</td>
                <td>{r.tenure}</td>
                <td>${Number(r.MonthlyCharges).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
