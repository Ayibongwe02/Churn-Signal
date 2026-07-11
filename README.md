# CHURN SIGNAL — Telco Customer Churn Dashboard

An interactive Streamlit app that **trains a real churn classifier live**
(scikit-learn RandomForest) on historical customer data with known outcomes,
then predicts risk for any customer file you give it — plus a leaderboard,
segment analysis, model performance page, and a live SQL explorer.

## This isn't just a display layer — it predicts

The original version displayed a `risk_score` from a CSV that was assumed
to already be scored by some model elsewhere. That's not actually
predicting anything — swap in a different pre-scored file and you're just
looking at different pre-baked numbers.

This version instead:
1. **Trains** a `RandomForestClassifier` in-app on `data/churn_customers.csv`,
   which has real historical `Churn` outcomes (0/1) — an 80/20 train/test
   split, evaluated with accuracy and ROC-AUC on the held-out test set.
2. **Scores** whichever customer data is currently active — the training
   cohort itself, or a separate file of new customers you upload (no
   `Churn` label needed for those, since that's exactly what's being
   predicted).
3. Shows the model's actual performance — confusion matrix, ROC curve,
   feature importances — on a dedicated **Model Performance** page, not
   just the predictions.

## What was hardened from the original

- **Flexible dependency versions** (`>=` ranges, not exact pins) so pip can
  resolve to a package with a prebuilt install available regardless of the
  deploy host's Python version.
- **Path resolution** checks both `data/<file>.csv` and `<file>.csv` at the
  repo root, so it works whether you `git push` (preserves folders) or use
  GitHub's one-by-one "Add files via upload" (flattens to root).
- **Graceful missing-data handling** — a clear in-app message instead of an
  unhandled crash if the training CSV isn't present.
- **Missing-column resilience when scoring** — if an uploaded file is
  missing some feature columns the model was trained on, they're filled
  with sensible defaults (median/mode from training data) instead of
  crashing.
- Removed the obsolete `version:` key from `docker-compose.yml` and added a
  container healthcheck.

## Pages

- **Overview** — total customers, high-risk count, average predicted risk, revenue at risk, risk distribution and revenue-by-band charts
- **High Risk Leaderboard** — top 50 customers by predicted risk score, searchable by ID
- **Segment Analysis** — average predicted risk and charges by contract type and internet service
- **Model Performance** — accuracy, ROC-AUC, confusion matrix, ROC curve, top feature importances
- **SQL Explorer** — run arbitrary SQL against the in-memory, live-scored `customer_churn_predictions` table

## Run it

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
streamlit run churn_dashboard.py
```

Or with Docker:

```bash
docker compose up --build
```

Open **http://localhost:8501**.

## Using your own data

Upload in the sidebar:
- **Labeled training CSV** (optional — replaces the bundled sample as the
  model's training set): needs a `Churn` column (0/1) plus
  `customerID, tenure, Contract, InternetService, MonthlyCharges, ...` —
  any other Telco-style columns become model features automatically.
- **New customers to score** (optional): same feature columns, **no**
  `Churn` column needed — this is what gets predicted on. If omitted, the
  app scores the training cohort itself so there's always something to look at.

## Troubleshooting (Streamlit Community Cloud)

**Dependency install fails:** `requirements.txt` already uses minimum-version
ranges to avoid this. Don't rely on a `runtime.txt` to force a Python
version — it's currently unreliable on Cloud; set it explicitly in
"Advanced settings" at deploy time instead.

**Missing-data message on startup:** confirm the training CSV is actually
committed with `git ls-files data/` — if that prints nothing, run
`git add data/ && git commit && git push`.

## Tech stack

- **App/UI:** Streamlit, Plotly
- **Model:** scikit-learn RandomForestClassifier, trained live in-app
- **Data:** pandas, SQLite (in-memory, rebuilt from live predictions each run)
- **Deployment:** Docker / docker-compose, plain Python, or Streamlit Community Cloud
