export type RiskBand = "Stable" | "Watching" | "At Risk" | "Urgent";

export interface CustomerRow {
  customerID: string;
  gender: string;
  SeniorCitizen: number;
  Partner: string;
  Dependents: string;
  tenure: number;
  PhoneService: string;
  MultipleLines: string;
  InternetService: string;
  OnlineSecurity: string;
  OnlineBackup: string;
  DeviceProtection: string;
  TechSupport: string;
  StreamingTV: string;
  StreamingMovies: string;
  Contract: string;
  PaperlessBilling: string;
  PaymentMethod: string;
  MonthlyCharges: number;
  TotalCharges: number;
  Churn?: number;
  risk_score?: number;
  risk_band?: RiskBand;
  [key: string]: string | number | undefined;
}

export interface ModelMetrics {
  accuracy: number;
  roc_auc: number;
  n_train: number;
  n_test: number;
  confusion: { tn: number; fp: number; fn: number; tp: number };
  roc: { fpr: number[]; tpr: number[] };
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export const RISK_COLORS: Record<RiskBand, string> = {
  Stable: "#5FBF8B",
  Watching: "#E8B84B",
  "At Risk": "#E8873F",
  Urgent: "#D64550",
};

export const RISK_DEFINITIONS: Record<RiskBand, { range: string; desc: string }> = {
  Stable: { range: "0–25%", desc: "Low predicted churn probability. No action needed." },
  Watching: { range: "25–50%", desc: "Early signals present. Worth a periodic check-in." },
  "At Risk": { range: "50–75%", desc: "Meaningful churn probability. Proactive outreach recommended." },
  Urgent: { range: "75–100%", desc: "High churn probability. Prioritize retention action now." },
};

export const REQUIRED_TRAIN = ["customerID", "tenure", "Contract", "InternetService", "MonthlyCharges", "Churn"];
export const REQUIRED_SCORE = ["customerID", "tenure", "Contract", "InternetService", "MonthlyCharges"];

export function riskBand(prob: number): RiskBand {
  if (prob >= 0.75) return "Urgent";
  if (prob >= 0.5) return "At Risk";
  if (prob >= 0.25) return "Watching";
  return "Stable";
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r/g, "").trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

export function parseCustomers(text: string): CustomerRow[] {
  return parseCsv(text).map((r) => {
    const churn = r.Churn !== undefined && r.Churn !== "" ? Number(r.Churn) : undefined;
    return {
      customerID: r.customerID || "",
      gender: r.gender || "Unknown",
      SeniorCitizen: Number(r.SeniorCitizen) || 0,
      Partner: r.Partner || "No",
      Dependents: r.Dependents || "No",
      tenure: Number(r.tenure) || 0,
      PhoneService: r.PhoneService || "No",
      MultipleLines: r.MultipleLines || "No",
      InternetService: r.InternetService || "No",
      OnlineSecurity: r.OnlineSecurity || "No",
      OnlineBackup: r.OnlineBackup || "No",
      DeviceProtection: r.DeviceProtection || "No",
      TechSupport: r.TechSupport || "No",
      StreamingTV: r.StreamingTV || "No",
      StreamingMovies: r.StreamingMovies || "No",
      Contract: r.Contract || "Month-to-month",
      PaperlessBilling: r.PaperlessBilling || "No",
      PaymentMethod: r.PaymentMethod || "Unknown",
      MonthlyCharges: Number(r.MonthlyCharges) || 0,
      TotalCharges: Number(r.TotalCharges) || 0,
      ...(churn !== undefined && Number.isFinite(churn) ? { Churn: churn } : {}),
    };
  }).filter((r) => r.customerID);
}

const SKIP_COLS = new Set(["customerID", "Churn", "risk_score", "risk_band"]);

function isNumericCol(rows: CustomerRow[], col: string): boolean {
  let n = 0;
  for (const r of rows.slice(0, 40)) {
    const v = r[col];
    if (v === undefined || v === "") continue;
    if (typeof v === "number" || (typeof v === "string" && v !== "" && !Number.isNaN(Number(v)))) n++;
  }
  return n >= 5;
}

export interface Encoder {
  featureCols: string[];
  catCols: string[];
  numCols: string[];
  catLevels: Record<string, string[]>;
  defaults: Record<string, string | number>;
  means: number[];
  stds: number[];
  names: string[];
}

export function buildEncoder(train: CustomerRow[]): Encoder {
  const featureCols = Object.keys(train[0] || {}).filter((c) => !SKIP_COLS.has(c));
  const numCols = featureCols.filter((c) => isNumericCol(train, c));
  const catCols = featureCols.filter((c) => !numCols.includes(c));
  const catLevels: Record<string, string[]> = {};
  for (const c of catCols) {
    const set = new Set<string>();
    for (const r of train) set.add(String(r[c] ?? "Unknown"));
    catLevels[c] = [...set].sort();
  }
  const defaults: Record<string, string | number> = {};
  for (const c of catCols) {
    const counts = new Map<string, number>();
    for (const r of train) {
      const v = String(r[c] ?? "Unknown");
      counts.set(v, (counts.get(v) || 0) + 1);
    }
    defaults[c] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
  }
  for (const c of numCols) {
    const vals = train.map((r) => Number(r[c]) || 0).sort((a, b) => a - b);
    defaults[c] = vals[Math.floor(vals.length / 2)] ?? 0;
  }

  const names: string[] = [];
  for (const c of catCols) for (const level of catLevels[c]) names.push(`${c}=${level}`);
  for (const c of numCols) names.push(c);

  // provisional matrix for means/stds of numeric part only after one-hot
  const X = encodeMatrix(train, {
    featureCols, catCols, numCols, catLevels, defaults, means: [], stds: [], names,
  }, false);
  const d = X[0]?.length || 0;
  const means = Array(d).fill(0);
  const stds = Array(d).fill(1);
  for (const row of X) for (let j = 0; j < d; j++) means[j] += row[j];
  for (let j = 0; j < d; j++) means[j] /= X.length || 1;
  for (const row of X) for (let j = 0; j < d; j++) stds[j] += (row[j] - means[j]) ** 2;
  for (let j = 0; j < d; j++) stds[j] = Math.sqrt(stds[j] / (X.length || 1)) || 1;

  return { featureCols, catCols, numCols, catLevels, defaults, means, stds, names };
}

function encodeMatrix(rows: CustomerRow[], enc: Encoder, scale: boolean): number[][] {
  return rows.map((r) => {
    const vec: number[] = [];
    for (const c of enc.catCols) {
      const val = String(r[c] ?? enc.defaults[c] ?? "Unknown");
      for (const level of enc.catLevels[c]) vec.push(val === level ? 1 : 0);
    }
    for (const c of enc.numCols) {
      vec.push(Number(r[c] ?? enc.defaults[c] ?? 0) || 0);
    }
    if (scale && enc.means.length === vec.length) {
      return vec.map((v, j) => (v - enc.means[j]) / enc.stds[j]);
    }
    return vec;
  });
}

function sigmoid(z: number) {
  if (z > 20) return 1;
  if (z < -20) return 0;
  return 1 / (1 + Math.exp(-z));
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface TrainedModel {
  encoder: Encoder;
  weights: number[];
  bias: number;
  metrics: ModelMetrics;
  importance: FeatureImportance[];
}

export function trainModel(train: CustomerRow[]): TrainedModel {
  const labeled = train.filter((r) => r.Churn === 0 || r.Churn === 1);
  const encoder = buildEncoder(labeled);
  const idx = shuffle(labeled.map((_, i) => i), 42);
  const split = Math.max(1, Math.floor(idx.length * 0.8));
  const trainIdx = idx.slice(0, split);
  const testIdx = idx.slice(split);
  const Xall = encodeMatrix(labeled, encoder, true);
  const yall = labeled.map((r) => Number(r.Churn));
  const Xtr = trainIdx.map((i) => Xall[i]);
  const ytr = trainIdx.map((i) => yall[i]);
  const Xte = testIdx.map((i) => Xall[i]);
  const yte = testIdx.map((i) => yall[i]);

  const d = Xtr[0]?.length || 0;
  let weights = Array(d).fill(0);
  let bias = 0;
  const lr = 0.15;
  const l2 = 0.01;
  const epochs = 40;
  for (let ep = 0; ep < epochs; ep++) {
    for (let i = 0; i < Xtr.length; i++) {
      const x = Xtr[i];
      let z = bias;
      for (let j = 0; j < d; j++) z += weights[j] * x[j];
      const p = sigmoid(z);
      const err = p - ytr[i];
      for (let j = 0; j < d; j++) weights[j] -= lr * (err * x[j] + l2 * weights[j]);
      bias -= lr * err;
    }
  }

  const predictProba = (x: number[]) => {
    let z = bias;
    for (let j = 0; j < d; j++) z += weights[j] * x[j];
    return sigmoid(z);
  };

  let tn = 0, fp = 0, fn = 0, tp = 0;
  const scores: { y: number; p: number }[] = [];
  for (let i = 0; i < Xte.length; i++) {
    const p = predictProba(Xte[i]);
    const pred = p >= 0.5 ? 1 : 0;
    const y = yte[i];
    scores.push({ y, p });
    if (y === 0 && pred === 0) tn++;
    else if (y === 0 && pred === 1) fp++;
    else if (y === 1 && pred === 0) fn++;
    else tp++;
  }
  const accuracy = (tn + tp) / Math.max(1, tn + tp + fp + fn);
  scores.sort((a, b) => b.p - a.p);
  // ROC AUC trapezoid
  let auc = 0;
  const fpr: number[] = [0];
  const tpr: number[] = [0];
  const P = scores.filter((s) => s.y === 1).length || 1;
  const N = scores.filter((s) => s.y === 0).length || 1;
  let tpR = 0, fpR = 0;
  let prevF = 0, prevT = 0;
  for (const s of scores) {
    if (s.y === 1) tpR++;
    else fpR++;
    const F = fpR / N;
    const T = tpR / P;
    auc += ((F - prevF) * (T + prevT)) / 2;
    prevF = F;
    prevT = T;
    fpr.push(F);
    tpr.push(T);
  }

  const importance = encoder.names
    .map((feature, i) => ({ feature, importance: Math.abs(weights[i] || 0) }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 15);

  return {
    encoder,
    weights,
    bias,
    metrics: {
      accuracy,
      roc_auc: auc,
      n_train: Xtr.length,
      n_test: Xte.length,
      confusion: { tn, fp, fn, tp },
      roc: { fpr, tpr },
    },
    importance,
  };
}

export function scoreCustomers(model: TrainedModel, rows: CustomerRow[]): CustomerRow[] {
  const X = encodeMatrix(rows, model.encoder, true);
  return rows.map((r, i) => {
    let z = model.bias;
    const x = X[i];
    for (let j = 0; j < model.weights.length; j++) z += model.weights[j] * x[j];
    const p = sigmoid(z);
    return { ...r, risk_score: p, risk_band: riskBand(p) };
  });
}

export function missingColumns(headers: string[], required: string[]): string[] {
  const set = new Set(headers.map((h) => h.trim()));
  return required.filter((c) => !set.has(c));
}
