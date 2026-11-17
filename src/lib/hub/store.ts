import { create } from "zustand";
import {
  type CustomerRow,
  type FeatureImportance,
  type ModelMetrics,
  type TrainedModel,
  REQUIRED_SCORE,
  REQUIRED_TRAIN,
  missingColumns,
  parseCustomers,
  scoreCustomers,
  trainModel,
} from "./engine";

interface State {
  ready: boolean;
  loading: boolean;
  trainMsg: string;
  scoreMsg: string;
  trainRows: CustomerRow[];
  scored: CustomerRow[];
  metrics: ModelMetrics | null;
  importance: FeatureImportance[];
  model: TrainedModel | null;
  onboardingDone: boolean;
  init: () => Promise<void>;
  uploadTrain: (text: string) => void;
  uploadScore: (text: string) => void;
  completeOnboarding: () => void;
  retrain: () => void;
}

function headersFromCsv(text: string): string[] {
  const first = text.replace(/\r/g, "").split("\n")[0] || "";
  return first.split(",").map((h) => h.trim());
}

export const useHub = create<State>((set, get) => ({
  ready: false,
  loading: true,
  trainMsg: "Training on bundled sample data",
  scoreMsg: "Scoring the training cohort itself",
  trainRows: [],
  scored: [],
  metrics: null,
  importance: [],
  model: null,
  onboardingDone: false,

  init: async () => {
    if (get().ready) return;
    set({ loading: true });
    try {
      const text = await fetch("/data/churn_customers.csv").then((r) => r.text());
      const trainRows = parseCustomers(text);
      const model = trainModel(trainRows);
      const scored = scoreCustomers(model, trainRows);
      set({
        trainRows,
        model,
        scored,
        metrics: model.metrics,
        importance: model.importance,
        ready: true,
        loading: false,
        trainMsg: `Training on bundled sample data (${trainRows.length} rows)`,
        scoreMsg: "Scoring the training cohort itself",
      });
    } catch (e) {
      set({
        loading: false,
        trainMsg: e instanceof Error ? e.message : "Failed to load sample data",
      });
    }
  },

  completeOnboarding: () => set({ onboardingDone: true }),

  uploadTrain: (text) => {
    const miss = missingColumns(headersFromCsv(text), REQUIRED_TRAIN);
    if (miss.length) {
      set({ trainMsg: `Error: training CSV missing ${miss.join(", ")}. Falling back to current training set.` });
      return;
    }
    const trainRows = parseCustomers(text);
    if (trainRows.length < 20) {
      set({ trainMsg: "Error: need at least 20 labeled rows. Falling back." });
      return;
    }
    set({ trainRows, trainMsg: `Training on uploaded data (${trainRows.length} rows)` });
    get().retrain();
  },

  uploadScore: (text) => {
    const miss = missingColumns(headersFromCsv(text), REQUIRED_SCORE);
    if (miss.length) {
      set({ scoreMsg: `Error: scoring CSV missing ${miss.join(", ")}. Scoring training cohort instead.` });
      return;
    }
    const rows = parseCustomers(text);
    const model = get().model;
    if (!model || !rows.length) {
      set({ scoreMsg: "Error: empty or unreadable scoring CSV." });
      return;
    }
    set({
      scored: scoreCustomers(model, rows),
      scoreMsg: `Scoring uploaded customers (${rows.length} rows)`,
    });
  },

  retrain: () => {
    const { trainRows } = get();
    const model = trainModel(trainRows);
    set({
      model,
      metrics: model.metrics,
      importance: model.importance,
      scored: scoreCustomers(model, trainRows),
      scoreMsg: "Scoring the training cohort itself",
    });
  },
}));
