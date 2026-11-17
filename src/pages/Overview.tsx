import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RISK_COLORS, RISK_DEFINITIONS, type RiskBand } from "../lib/hub/engine";
import { useHub } from "../lib/hub/store";

const ORDER: RiskBand[] = ["Stable", "Watching", "At Risk", "Urgent"];

export function Overview() {
  const scored = useHub((s) => s.scored);
  const high = scored.filter((r) => r.risk_band === "At Risk" || r.risk_band === "Urgent");
  const avg = scored.length ? scored.reduce((s, r) => s + (r.risk_score || 0), 0) / scored.length : 0;
  const revenue = high.reduce((s, r) => s + (Number(r.MonthlyCharges) || 0), 0);
  const counts = ORDER.map((band) => ({
    name: band,
    count: scored.filter((r) => r.risk_band === band).length,
  }));
  const revenueByBand = ORDER.map((band) => ({
    name: band,
    value: scored
      .filter((r) => r.risk_band === band)
      .reduce((s, r) => s + (Number(r.MonthlyCharges) || 0), 0),
  })).filter((d) => d.value > 0);

  return (
    <div>
      <h2 className="page-title">Overview</h2>
      <p className="page-cap">Live KPIs from the current scored cohort and risk bands.</p>
      <div className="legend">
        {ORDER.map((b) => (
          <span key={b}>
            <b style={{ color: RISK_COLORS[b] }}>{b}</b> {RISK_DEFINITIONS[b].range} — {RISK_DEFINITIONS[b].desc}
          </span>
        ))}
      </div>
      <div className="kpi-grid">
        <div className="kpi">
          <div className="label">Total customers</div>
          <div className="value">{scored.length.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="label">High risk</div>
          <div className="value">
            {high.length.toLocaleString()}
            <span style={{ fontSize: "0.85rem", color: "var(--muted)", marginLeft: "0.4rem" }}>
              {scored.length ? ((high.length / scored.length) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>
        <div className="kpi">
          <div className="label">Avg predicted risk</div>
          <div className="value">{(avg * 100).toFixed(1)}%</div>
        </div>
        <div className="kpi">
          <div className="label">Revenue at risk</div>
          <div className="value">${revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>
      <h3 className="section">Risk distribution</h3>
      <div className="card" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={counts}>
            <XAxis dataKey="name" tick={{ fill: "#8A93A6", fontSize: 12 }} />
            <YAxis tick={{ fill: "#8A93A6", fontSize: 12 }} />
            <Tooltip contentStyle={{ background: "#191D26", border: "1px solid #262B36" }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {counts.map((c) => (
                <Cell key={c.name} fill={RISK_COLORS[c.name as RiskBand]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <h3 className="section">Monthly revenue by risk band</h3>
      <div className="card" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={revenueByBand} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
              {revenueByBand.map((d) => (
                <Cell key={d.name} fill={RISK_COLORS[d.name as RiskBand]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ background: "#191D26", border: "1px solid #262B36" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
