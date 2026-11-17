import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useHub } from "../lib/hub/store";

function groupBy(scored: ReturnType<typeof useHub.getState>["scored"], key: string) {
  const map = new Map<string, { n: number; risk: number; charges: number }>();
  for (const r of scored) {
    const k = String(r[key] ?? "Unknown");
    const cur = map.get(k) || { n: 0, risk: 0, charges: 0 };
    cur.n += 1;
    cur.risk += r.risk_score || 0;
    cur.charges += Number(r.MonthlyCharges) || 0;
    map.set(k, cur);
  }
  return [...map.entries()]
    .map(([name, v]) => ({
      name,
      customers: v.n,
      avgRisk: Math.round((v.risk / v.n) * 1000) / 1000,
      avgCharges: Math.round((v.charges / v.n) * 100) / 100,
    }))
    .sort((a, b) => b.avgRisk - a.avgRisk);
}

export function Segments() {
  const scored = useHub((s) => s.scored);
  const byContract = groupBy(scored, "Contract");
  const byInternet = groupBy(scored, "InternetService");

  return (
    <div>
      <h2 className="page-title">Segment analysis</h2>
      <p className="page-cap">Average predicted risk and charges by contract and internet service.</p>
      <h3 className="section">By contract type</h3>
      <div className="card" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byContract}>
            <XAxis dataKey="name" tick={{ fill: "#8A93A6", fontSize: 11 }} />
            <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#191D26", border: "1px solid #262B36" }} />
            <Bar dataKey="avgRisk" fill="#00D9C0" name="Avg risk" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="table-wrap" style={{ marginBottom: "1.25rem" }}>
        <table className="data">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Customers</th>
              <th>Avg risk</th>
              <th>Avg charges</th>
            </tr>
          </thead>
          <tbody>
            {byContract.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{r.customers}</td>
                <td>{r.avgRisk}</td>
                <td>${r.avgCharges}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="section">By internet service</h3>
      <div className="card" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={byInternet}>
            <XAxis dataKey="name" tick={{ fill: "#8A93A6", fontSize: 11 }} />
            <YAxis tick={{ fill: "#8A93A6", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#191D26", border: "1px solid #262B36" }} />
            <Bar dataKey="avgRisk" fill="#E8873F" name="Avg risk" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Internet</th>
              <th>Customers</th>
              <th>Avg risk</th>
              <th>Avg charges</th>
            </tr>
          </thead>
          <tbody>
            {byInternet.map((r) => (
              <tr key={r.name}>
                <td>{r.name}</td>
                <td>{r.customers}</td>
                <td>{r.avgRisk}</td>
                <td>${r.avgCharges}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
