# Chance Signal Hub

Live telco churn intelligence — React 19 + TypeScript + Vite.

Trains a classifier on labeled history, scores any customer cohort in-browser,
and surfaces risk bands, leaderboards, segments, and model metrics.

**No accounts · No database · Session-only uploads**

## Pages

| Tab | Purpose |
|-----|---------|
| **Overview** | Totals, high-risk share, avg risk, revenue at risk, charts |
| **Leaderboard** | Top 50 by predicted risk, searchable |
| **Segments** | Risk by contract and internet service |
| **Model** | Holdout accuracy, ROC, confusion matrix, feature weights |
| **Explorer** | Filter cohort by band, contract, min risk |
| **Guide** | Onboarding — how to use the system |

## Local development

```bash
npm install
npm run dev
```

## Production

```bash
npm run build
npm start
# serves dist on $PORT (default 10000)
```

## Docker

```bash
docker build -t chance-signal-hub .
docker run --rm -p 10000:10000 chance-signal-hub
# or: docker compose up --build
```

## Deploy to Render (free)

1. Push this folder to GitHub/GitLab.
2. **New → Blueprint** and connect the repo (`render.yaml`), **or** create a
   Docker **Web Service** with Dockerfile `./Dockerfile`, health check `/`,
   free plan. No secrets required.

## Data

- **Training CSV** must include `Churn` (0/1) plus
  `customerID, tenure, Contract, InternetService, MonthlyCharges` (and any
  other telco-style features).
- **Scoring CSV** uses the same features without `Churn`.

Bundled sample: `public/data/churn_customers.csv` (2,500 customers).

## Model note

The original Streamlit app used scikit-learn `RandomForestClassifier`.
This hub trains a **logistic regression** on one-hot + numeric features in
pure TypeScript so it runs entirely in the browser with no Python service.
Risk-band thresholds match the original (25 / 50 / 75%).
