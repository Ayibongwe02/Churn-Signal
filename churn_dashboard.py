import os

# Must run before numpy/pandas/sklearn are imported: on constrained cloud
# containers (e.g. Streamlit Community Cloud), the underlying BLAS library
# and joblib's multiprocessing backend can spawn more native threads/workers
# than the container's CPU quota actually allows. That thread oversubscription
# is a known cause of hard segmentation faults in scikit-learn model training
# — a C-level crash that no Python try/except can catch. Pinning these to 1
# keeps everything single-threaded and avoids it.
for _env_var in ("OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "MKL_NUM_THREADS",
                  "NUMEXPR_NUM_THREADS", "VECLIB_MAXIMUM_THREADS"):
    os.environ.setdefault(_env_var, "1")

import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import streamlit as st
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, roc_auc_score, roc_curve
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

st.set_page_config(page_title="CHURN SIGNAL - Telco Cohort", layout="wide", initial_sidebar_state="expanded")

APP_DIR = Path(__file__).parent
LABEL_COL = "Churn"
ID_COL = "customerID"
REQUIRED_TRAIN_COLS = {"customerID", "tenure", "Contract", "InternetService", "MonthlyCharges", "Churn"}
REQUIRED_SCORE_COLS = {"customerID", "tenure", "Contract", "InternetService", "MonthlyCharges"}

RISK_COLORS = {"Stable": "#5FBF8B", "Watching": "#E8B84B", "At Risk": "#E8873F", "Urgent": "#D64550"}

# Definitions shown in the legend strip and used as tooltip copy anywhere
# a risk band appears. Keep these in sync with risk_band() below.
RISK_DEFINITIONS = {
    "Stable": {"range": "0-25%", "desc": "Low predicted churn probability. No action needed."},
    "Watching": {"range": "25-50%", "desc": "Early signals present. Worth a periodic check-in."},
    "At Risk": {"range": "50-75%", "desc": "Meaningful churn probability. Proactive outreach recommended."},
    "Urgent": {"range": "75-100%", "desc": "High churn probability. Prioritize retention action now."},
}

st.markdown(
    """
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap');

        :root {
            --ink: #10131A;
            --panel: #191D26;
            --panel-border: #262B36;
            --text-primary: #E7E9EE;
            --text-muted: #8A93A6;
            --signal: #00D9C0;
        }

        .stApp { background-color: var(--ink); color: var(--text-primary); font-family: 'IBM Plex Sans', sans-serif; }
        .main .block-container { padding-top: 1.5rem; max-width: 1200px; }

        h1, h2, h3 { font-family: 'Space Grotesk', sans-serif !important; color: var(--text-primary) !important; letter-spacing: -0.01em; }
        h1 { font-weight: 700 !important; }
        h2, h3 { font-weight: 600 !important; }

        [data-testid="stMetricValue"] { font-family: 'IBM Plex Mono', monospace; }
        [data-testid="stSidebar"] { background-color: var(--panel); border-right: 1px solid var(--panel-border); }
        [data-testid="stSidebar"] *:not([data-testid^="stIcon"]) { font-family: 'IBM Plex Sans', sans-serif; }
        [data-testid="stSidebar"] [data-testid^="stIcon"] { font-family: 'Material Symbols Rounded' !important; }

        .stMetric {
            background-color: var(--panel);
            border: 1px solid var(--panel-border);
            border-top: 2px solid var(--signal);
            padding: 1rem 1.1rem;
            border-radius: 6px;
        }

        [data-testid="stDataFrame"] { font-family: 'IBM Plex Mono', monospace; }

        /* --- Header / signature: live pulse mark --- */
        .cs-header { display: flex; align-items: baseline; gap: 0.6rem; margin-bottom: -0.4rem; }
        .cs-pulse-wrap { display: inline-flex; align-items: center; gap: 0.4rem; }
        .cs-pulse {
            width: 9px; height: 9px; border-radius: 50%;
            background: var(--signal);
            box-shadow: 0 0 0 0 rgba(0, 217, 192, 0.6);
            animation: cs-ping 2.2s infinite;
        }
        .cs-live-label {
            font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem; letter-spacing: 0.12em;
            color: var(--signal); text-transform: uppercase;
        }
        @keyframes cs-ping {
            0%   { box-shadow: 0 0 0 0 rgba(0, 217, 192, 0.55); }
            70%  { box-shadow: 0 0 0 7px rgba(0, 217, 192, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 217, 192, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
            .cs-pulse { animation: none; }
        }

        /* --- Risk legend chips --- */
        .cs-legend { display: flex; gap: 0.6rem; flex-wrap: wrap; margin: 0.9rem 0 1.4rem 0; }
        .cs-chip {
            flex: 1 1 200px;
            background: var(--panel);
            border: 1px solid var(--panel-border);
            border-left: 3px solid var(--chip-color, var(--signal));
            border-radius: 4px;
            padding: 0.55rem 0.75rem;
            cursor: help;
        }
        .cs-chip-top { display: flex; align-items: center; justify-content: space-between; }
        .cs-chip-name { font-weight: 600; font-size: 0.86rem; color: var(--text-primary); }
        .cs-chip-range { font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem; color: var(--text-muted); }
        .cs-chip-desc { font-size: 0.74rem; color: var(--text-muted); margin-top: 0.15rem; line-height: 1.25; }
    </style>
    """,
    unsafe_allow_html=True,
)


def risk_legend_html() -> str:
    """Render the Stable/Watching/At Risk/Urgent chips with their score
    ranges and one-line definitions, so the labels never need explaining
    twice."""
    chips = []
    for band in ["Stable", "Watching", "At Risk", "Urgent"]:
        info = RISK_DEFINITIONS[band]
        color = RISK_COLORS[band]
        chips.append(
            f'<div class="cs-chip" style="--chip-color:{color}" title="{info["desc"]}">'
            f'  <div class="cs-chip-top">'
            f'    <span class="cs-chip-name">{band}</span>'
            f'    <span class="cs-chip-range">{info["range"]}</span>'
            f'  </div>'
            f'  <div class="cs-chip-desc">{info["desc"]}</div>'
            f'</div>'
        )
    return f'<div class="cs-legend">{"".join(chips)}</div>'


st.markdown(
    '<div class="cs-header"><h1 style="margin-bottom:0">CHURN SIGNAL</h1>'
    '<span class="cs-pulse-wrap"><span class="cs-pulse"></span>'
    '<span class="cs-live-label">live model</span></span></div>',
    unsafe_allow_html=True,
)
st.subheader("Telco Customer Churn Prediction Dashboard")
st.caption("Predictions are generated live by a Random Forest classifier trained in-app — not pre-computed.")
st.markdown(risk_legend_html(), unsafe_allow_html=True)


def _find_data_file(filename: str) -> Path:
    """Look in data/ first, then fall back to the repo root (handles a
    flat GitHub 'Add files via upload' layout)."""
    for candidate in (APP_DIR / "data" / filename, APP_DIR / filename):
        if candidate.exists():
            return candidate
    return APP_DIR / "data" / filename


TRAINING_CSV = _find_data_file("churn_customers.csv")


@st.cache_data
def load_training_data():
    if not TRAINING_CSV.exists():
        st.error(
            f"**Training data file not found:** `{TRAINING_CSV}`\n\n"
            "The model needs historical customers with a known `Churn` outcome "
            "to train on. Check that this file was committed and pushed "
            "(`git ls-files data/`), or upload a labeled CSV below."
        )
        return pd.DataFrame(columns=list(REQUIRED_TRAIN_COLS))
    return pd.read_csv(TRAINING_CSV)


def validate_csv(df: pd.DataFrame, required: set, label: str) -> bool:
    missing = required - set(df.columns)
    if missing:
        st.sidebar.error(f"{label} is missing column(s): {', '.join(sorted(missing))}")
        return False
    return True


def risk_band(prob: float) -> str:
    if prob >= 0.75:
        return "Urgent"
    if prob >= 0.50:
        return "At Risk"
    if prob >= 0.25:
        return "Watching"
    return "Stable"


@st.cache_resource
def train_model(train_df: pd.DataFrame):
    """Train a Random Forest churn classifier and return the fitted pipeline
    plus held-out evaluation metrics."""
    feature_cols = [c for c in train_df.columns if c not in (ID_COL, LABEL_COL)]
    cat_cols = [c for c in feature_cols if not pd.api.types.is_numeric_dtype(train_df[c])]
    num_cols = [c for c in feature_cols if c not in cat_cols]

    X, y = train_df[feature_cols], train_df[LABEL_COL]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if y.nunique() > 1 else None
    )

    pre = ColumnTransformer([("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols)], remainder="passthrough")
    pipe = Pipeline([("pre", pre), ("clf", RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42, n_jobs=1))])
    pipe.fit(X_train, y_train)

    test_preds = pipe.predict(X_test)
    test_probs = pipe.predict_proba(X_test)[:, 1]
    metrics = {
        "accuracy": accuracy_score(y_test, test_preds),
        "roc_auc": roc_auc_score(y_test, test_probs) if y_test.nunique() > 1 else float("nan"),
        "confusion_matrix": confusion_matrix(y_test, test_preds),
        "roc_curve": roc_curve(y_test, test_probs) if y_test.nunique() > 1 else None,
        "n_train": len(X_train),
        "n_test": len(X_test),
    }

    # Feature importance, mapped back to readable names
    importances = pipe.named_steps["clf"].feature_importances_
    feat_names = pipe.named_steps["pre"].get_feature_names_out()
    feat_names = [f.replace("cat__", "").replace("remainder__", "") for f in feat_names]
    importance_df = pd.DataFrame({"feature": feat_names, "importance": importances}).sort_values(
        "importance", ascending=False
    ).head(15)

    # Sensible per-column fill values, used if a scoring file is missing a feature column
    default_values = {}
    for c in cat_cols:
        default_values[c] = train_df[c].mode().iloc[0] if not train_df[c].mode().empty else "Unknown"
    for c in num_cols:
        default_values[c] = train_df[c].median()

    return pipe, feature_cols, metrics, importance_df, default_values


def score_customers(pipe, feature_cols: list, defaults: dict, df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for c in feature_cols:
        if c not in df.columns:
            df[c] = defaults.get(c, 0)
        else:
            df[c] = df[c].fillna(defaults.get(c, 0))
    probs = pipe.predict_proba(df[feature_cols])[:, 1]
    df["risk_score"] = probs
    df["risk_band"] = [risk_band(p) for p in probs]
    return df


# --- Sidebar: data source ---
st.sidebar.header("Data source")
st.sidebar.caption("The model trains on labeled historical data, then scores whichever customer file is active.")
train_upload = st.sidebar.file_uploader("Labeled training CSV (must include Churn)", type="csv", key="train_upload")
score_upload = st.sidebar.file_uploader("New customers to score (optional, no Churn needed)", type="csv", key="score_upload")
with st.sidebar.expander("Expected CSV columns"):
    st.markdown(
        "**Training data** (used once to fit the model): needs a `Churn` "
        "column (0/1) plus `customerID, tenure, Contract, InternetService, "
        "MonthlyCharges, ...` — any other Telco-style columns are used as "
        "features automatically.\n\n"
        "**Scoring data** (optional): same feature columns, no `Churn` "
        "needed — this is what the trained model predicts on."
    )

def _read_uploaded_csv(uploaded_file):
    """Read an st.file_uploader object safely across script reruns.

    Streamlit reruns the whole script on every interaction (including just
    switching sidebar pages), but keeps handing back the *same* underlying
    BytesIO-backed file object rather than a fresh one. Once pandas has read
    it, its position sits at EOF — the next rerun's pd.read_csv() then raises
    EmptyDataError and crashes the app. Seeking back to 0 first fixes that.
    """
    uploaded_file.seek(0)
    try:
        return pd.read_csv(uploaded_file)
    except pd.errors.EmptyDataError:
        return pd.DataFrame()


bundled_train = load_training_data()

if train_upload is not None:
    train_raw = _read_uploaded_csv(train_upload)
    if train_raw.empty:
        st.sidebar.error("Training CSV appears empty or unreadable — falling back to bundled sample data.")
        train_raw = bundled_train
    elif validate_csv(train_raw, REQUIRED_TRAIN_COLS, "Training CSV"):
        st.sidebar.success(f"Training on uploaded data ({len(train_raw)} rows).")
    else:
        train_raw = bundled_train
else:
    train_raw = bundled_train
    if not train_raw.empty:
        st.sidebar.caption("Training on bundled sample data.")

if train_raw.empty:
    st.warning("No labeled training data available — upload a CSV with a `Churn` column in the sidebar.")
    st.stop()

with st.spinner("Training churn classifier..."):
    pipe, feature_cols, metrics, importance_df, defaults = train_model(train_raw)

if score_upload is not None:
    score_raw = _read_uploaded_csv(score_upload)
    if score_raw.empty:
        st.sidebar.error("Scoring CSV appears empty or unreadable — scoring the training cohort instead.")
        score_df = train_raw
    elif validate_csv(score_raw, REQUIRED_SCORE_COLS, "Scoring CSV"):
        score_df = score_raw
        st.sidebar.success(f"Scoring uploaded customers ({len(score_df)} rows).")
    else:
        score_df = train_raw
else:
    score_df = train_raw
    st.sidebar.caption("Scoring the training cohort itself (no separate scoring file uploaded).")

merged_df = score_customers(pipe, feature_cols, defaults, score_df)

# SQLite in-memory DB, rebuilt whenever the scored data changes
conn = sqlite3.connect(":memory:", check_same_thread=False)
merged_df.to_sql("customer_churn_predictions", conn, index=False, if_exists="replace")

st.sidebar.divider()
st.sidebar.markdown(
    '<span style="font-family:\'IBM Plex Mono\',monospace; font-size:0.72rem; '
    'letter-spacing:0.12em; color:var(--text-muted); text-transform:uppercase;">Channels</span>',
    unsafe_allow_html=True,
)
page = st.sidebar.radio(
    "Go to",
    ["Overview", "High Risk Leaderboard", "Segment Analysis", "Model Performance", "SQL Explorer"],
    label_visibility="collapsed",
    key="page_nav",
)


def render_overview():
    st.header("Overview")

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("Total Customers", f"{len(merged_df):,}")
    with col2:
        high_risk = len(merged_df[merged_df["risk_band"].isin(["At Risk", "Urgent"])])
        high_risk_pct = (high_risk / len(merged_df) * 100) if len(merged_df) else 0.0
        st.metric("High Risk", high_risk, f"{high_risk_pct:.1f}%",
                   help="Customers in the At Risk or Urgent bands — see the definitions above.")
    with col3:
        st.metric("Avg Predicted Risk", f"{merged_df['risk_score'].mean():.1%}",
                   help="Mean predicted churn probability across the current cohort.")
    with col4:
        revenue_risk = merged_df[merged_df["risk_band"].isin(["At Risk", "Urgent"])]["MonthlyCharges"].sum()
        st.metric("Revenue at Risk", f"${revenue_risk:,.0f}",
                   help="Monthly recurring revenue held by At Risk and Urgent customers.")

    st.subheader("Risk Distribution")
    risk_counts = merged_df["risk_band"].value_counts().reindex(["Stable", "Watching", "At Risk", "Urgent"]).fillna(0)
    fig = px.bar(x=risk_counts.index, y=risk_counts.values, color=risk_counts.index,
                 color_discrete_map=RISK_COLORS, labels={"x": "Risk Band", "y": "Count"},
                 title="Customer Count by Predicted Risk Band")
    fig.update_layout(showlegend=False)
    st.plotly_chart(fig, width="stretch", key="chart_risk_count")

    revenue_by_band = merged_df.groupby("risk_band")["MonthlyCharges"].sum().reset_index()
    fig2 = px.pie(revenue_by_band, names="risk_band", values="MonthlyCharges",
                  title="Monthly Revenue by Risk Band", color="risk_band", color_discrete_map=RISK_COLORS)
    st.plotly_chart(fig2, width="stretch", key="chart_revenue_by_band")


def render_leaderboard():
    st.header("High-Risk Leaderboard")
    search = st.text_input("Search Customer ID", "", key="leaderboard_search")

    top_risk = merged_df.nlargest(50, "risk_score").copy()
    if search:
        top_risk = top_risk[top_risk[ID_COL].str.contains(search, case=False, na=False)]

    display_cols = [c for c in [ID_COL, "risk_score", "risk_band", "tenure", "Contract", "MonthlyCharges"]
                     if c in top_risk.columns]
    column_config = {
        "risk_score": st.column_config.ProgressColumn(
            "risk_score", help="Predicted churn probability (0-1).", format="%.2f", min_value=0, max_value=1,
        ),
        "risk_band": st.column_config.TextColumn(
            "risk_band",
            help=" · ".join(f"{b}: {RISK_DEFINITIONS[b]['desc']}" for b in ["Stable", "Watching", "At Risk", "Urgent"]),
        ),
    }
    st.dataframe(top_risk[display_cols], width="stretch", hide_index=True,
                 column_config=column_config, key="table_leaderboard")


def render_segments():
    st.header("Segment Analysis")

    if "Contract" in merged_df.columns:
        contract_df = pd.read_sql(
            """
            SELECT Contract, COUNT(*) as customers,
                   ROUND(AVG(risk_score), 3) as avg_predicted_risk,
                   ROUND(AVG(MonthlyCharges), 2) as avg_charges
            FROM customer_churn_predictions GROUP BY Contract
            """,
            conn,
        )
        st.subheader("By Contract Type")
        st.dataframe(contract_df, width="stretch", hide_index=True, key="table_by_contract")

    if "InternetService" in merged_df.columns:
        internet_df = pd.read_sql(
            """
            SELECT InternetService, COUNT(*) as customers,
                   ROUND(AVG(risk_score), 3) as avg_predicted_risk
            FROM customer_churn_predictions GROUP BY InternetService
            """,
            conn,
        )
        st.subheader("By Internet Service")
        st.dataframe(internet_df, width="stretch", hide_index=True, key="table_by_internet")


def render_model_performance():
    st.header("Model Performance")
    st.caption(f"Random Forest classifier, evaluated on a held-out 20% test split "
               f"({metrics['n_train']} train / {metrics['n_test']} test rows).")

    m1, m2 = st.columns(2)
    m1.metric("Accuracy", f"{metrics['accuracy']:.1%}")
    m2.metric("ROC-AUC", f"{metrics['roc_auc']:.3f}" if not np.isnan(metrics["roc_auc"]) else "n/a")

    col1, col2 = st.columns(2)
    with col1:
        st.subheader("Confusion Matrix")
        cm = metrics["confusion_matrix"]
        fig = go.Figure(data=go.Heatmap(
            z=cm, x=["Predicted: Stay", "Predicted: Churn"], y=["Actual: Stay", "Actual: Churn"],
            colorscale="Blues", text=cm, texttemplate="%{text}",
        ))
        fig.update_layout(height=350, margin=dict(t=10, l=10, r=10, b=10))
        st.plotly_chart(fig, width="stretch", key="chart_confusion_matrix")

    with col2:
        if metrics["roc_curve"] is not None:
            st.subheader("ROC Curve")
            fpr, tpr, _ = metrics["roc_curve"]
            fig2 = go.Figure()
            fig2.add_trace(go.Scatter(x=fpr, y=tpr, name="Model", line=dict(color="#60a5fa")))
            fig2.add_trace(go.Scatter(x=[0, 1], y=[0, 1], name="Random baseline", line=dict(dash="dash", color="gray")))
            fig2.update_layout(height=350, margin=dict(t=10, l=10, r=10, b=10),
                                xaxis_title="False Positive Rate", yaxis_title="True Positive Rate")
            st.plotly_chart(fig2, width="stretch", key="chart_roc_curve")

    st.subheader("Top Feature Importances")
    fig3 = px.bar(importance_df.sort_values("importance"), x="importance", y="feature", orientation="h")
    fig3.update_layout(height=420, margin=dict(t=10, l=10, r=10, b=10))
    st.plotly_chart(fig3, width="stretch", key="chart_feature_importance")


def render_sql_explorer():
    st.header("Live SQL Explorer")
    st.caption("Table name: `customer_churn_predictions` (includes live-predicted risk_score / risk_band)")
    query = st.text_area("Write SQL Query", height=150,
                          value="SELECT * FROM customer_churn_predictions LIMIT 10", key="sql_query_box")
    if st.button("Run Query", key="sql_run_button"):
        try:
            result = pd.read_sql(query, conn)
            st.dataframe(result, width="stretch", key="table_sql_result")
        except Exception as e:
            st.error(f"Query Error: {e}")


PAGE_RENDERERS = {
    "Overview": render_overview,
    "High Risk Leaderboard": render_leaderboard,
    "Segment Analysis": render_segments,
    "Model Performance": render_model_performance,
    "SQL Explorer": render_sql_explorer,
}

# Each page renders inside its own try/except so that an error on one page
# (e.g. from an unusual uploaded CSV) shows as an inline message rather than
# crashing the whole app on the next rerun triggered by switching pages.
try:
    PAGE_RENDERERS[page]()
except Exception as e:
    st.error(
        f"Something went wrong rendering the **{page}** page: `{type(e).__name__}: {e}`\n\n"
        "Try switching to another page and back, or check the uploaded CSV. "
        "If this keeps happening, please share this exact message so it can be fixed."
    )
    with st.expander("Full error details"):
        st.exception(e)

st.sidebar.divider()
st.sidebar.caption("Model: scikit-learn RandomForestClassifier · trained live, not pre-computed")
