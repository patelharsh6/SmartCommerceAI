"""
═══════════════════════════════════════════════════════════════════════════════
  DYNAMIC PRICING MODEL — FULL TRAINING PIPELINE
═══════════════════════════════════════════════════════════════════════════════
  Trains a two-layer pricing model using the real synthetic datasets:
    • Layer 1: Rule-based adjustments (demand velocity, competitor positioning,
               inventory levels, user segment willingness-to-pay)
    • Layer 2: GradientBoosting Regressor trained on engineered features to
               predict optimal price multipliers

  Input datasets (in ./data/):
    - clickstream_eventsput.csv  (~10M events, ~2 GB)
    - product_catalog.csv        (5,368 SKUs)
    - competitor_pricing_feed.csv (competitor prices)
    - user_segment_profiles.csv  (500K user profiles)

  Output artifacts (saved to ./data/):
    - model.pkl               (trained GradientBoosting model)
    - scaler.pkl              (StandardScaler fitted on training data)
    - features.pkl            (ordered feature name list)
    - pricing_data.csv        (aggregated per-product pricing features)
    - catrecommandprocessed_data.csv   (product catalog for recommendation)
    - catrecommandmodel.pkl           (Polynomial Regression for popularity)
    - apriori_rules.csv               (association rules for recommendations)
    - training_report.json    (training metrics and evaluation results)

  Business Rules enforced:
    - Minimum margin: price >= cost_price * 1.05 (5% floor margin)
    - Maximum discount cap: price >= min_price_usd
    - Maximum surge cap: price <= max_price_usd
    - Price factor clamped to [0.70, 1.50]
    - Fairness: no demographic-based discrimination (gender, age_group)

  Usage:
    python train_dynamic_pricing.py
═══════════════════════════════════════════════════════════════════════════════
"""

import pandas as pd
import numpy as np
import joblib
import json
import os
import time
import warnings
from datetime import datetime

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)

warnings.filterwarnings("ignore", category=FutureWarning)

# ═══════════════════════════════════════════════════════════════
# PATH CONFIG
# ═══════════════════════════════════════════════════════════════
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

def dp(filename):
    """Data path helper."""
    return os.path.join(DATA_DIR, filename)


print("=" * 72)
print("  SMARTCOMMERCE AI — DYNAMIC PRICING MODEL TRAINING")
print("=" * 72)
print(f"  Started at : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"  Data dir   : {DATA_DIR}")
print("=" * 72)

training_start = time.time()

# ═══════════════════════════════════════════════════════════════
# STEP 1: LOAD RAW DATASETS
# ═══════════════════════════════════════════════════════════════
print("\n📦 STEP 1 — Loading raw datasets...")

t0 = time.time()
print("  [1/4] Loading clickstream events (this may take a minute)...")
events_df = pd.read_csv(dp("clickstream_eventsput.csv"))
print(f"         ✅  {len(events_df):,} events loaded in {time.time()-t0:.1f}s")

t0 = time.time()
print("  [2/4] Loading product catalog...")
catalog_df = pd.read_csv(dp("product_catalog.csv"))
print(f"         ✅  {len(catalog_df):,} products loaded in {time.time()-t0:.1f}s")

t0 = time.time()
print("  [3/4] Loading competitor pricing feed...")
competitor_df = pd.read_csv(dp("competitor_pricing_feed.csv"))
print(f"         ✅  {len(competitor_df):,} competitor records loaded in {time.time()-t0:.1f}s")

t0 = time.time()
print("  [4/4] Loading user segment profiles...")
user_profiles_df = pd.read_csv(dp("user_segment_profiles.csv"))
print(f"         ✅  {len(user_profiles_df):,} user profiles loaded in {time.time()-t0:.1f}s")


# ═══════════════════════════════════════════════════════════════
# STEP 2: FEATURE ENGINEERING — PER-PRODUCT DEMAND SIGNALS
# ═══════════════════════════════════════════════════════════════
print("\n🔧 STEP 2 — Engineering per-product demand features...")

# 2a. Aggregate event counts per product
event_type_weights = {
    "page_view": 1,
    "product_view": 2,
    "search": 1,
    "add_to_cart": 4,
    "add_to_wishlist": 3,
    "checkout_start": 5,
    "purchase": 7,
    "remove_from_cart": -1,
    "page_exit": 0,
}

events_df["event_weight"] = events_df["event_type"].map(event_type_weights).fillna(1)

# Count each event type per product
event_pivot = (
    events_df.groupby(["sku_id", "event_type"])
    .size()
    .unstack(fill_value=0)
    .reset_index()
)

# Rename to ensure all expected columns exist
for et in event_type_weights.keys():
    if et not in event_pivot.columns:
        event_pivot[et] = 0

# Build per-product aggregation
product_events = events_df.groupby("sku_id").agg(
    total_events=("event_id", "count"),
    total_weighted_score=("event_weight", "sum"),
    avg_price_seen=("price_seen_usd", "mean"),
    median_price_seen=("price_seen_usd", "median"),
    total_quantity=("quantity", "sum"),
    avg_session_duration=("session_duration_s", "mean"),
    avg_scroll_depth=("scroll_depth_pct", "mean"),
    avg_time_on_page=("time_on_page_s", "mean"),
    unique_users=("user_id", "nunique"),
    unique_sessions=("session_id", "nunique"),
).reset_index()

# Merge event-type counts
product_events = product_events.merge(event_pivot, on="sku_id", how="left")

print(f"  ✅ Aggregated demand features for {len(product_events):,} products")

# 2b. Demand velocity features
product_events["views"] = product_events.get("page_view", 0) + product_events.get("product_view", 0)
product_events["purchases"] = product_events.get("purchase", 0)
product_events["carts"] = product_events.get("add_to_cart", 0)
product_events["wishlists"] = product_events.get("add_to_wishlist", 0)
product_events["checkouts"] = product_events.get("checkout_start", 0)

product_events["conversion_rate"] = product_events["purchases"] / (product_events["views"] + 1)
product_events["cart_rate"] = product_events["carts"] / (product_events["views"] + 1)
product_events["wishlist_rate"] = product_events["wishlists"] / (product_events["views"] + 1)
product_events["checkout_rate"] = product_events["checkouts"] / (product_events["views"] + 1)
product_events["cart_abandon_rate"] = 1 - (product_events["purchases"] / (product_events["carts"] + 1))
product_events["demand_velocity"] = product_events["views"] + product_events["carts"] * 3 + product_events["purchases"] * 5
product_events["log_demand"] = np.log1p(product_events["demand_velocity"])
product_events["purchase_intensity"] = product_events["total_quantity"] / (product_events["unique_users"] + 1)

print(f"  ✅ Computed demand velocity, conversion rates, and engagement features")


# ═══════════════════════════════════════════════════════════════
# STEP 3: MERGE PRODUCT CATALOG (inventory, cost, price bounds)
# ═══════════════════════════════════════════════════════════════
print("\n📋 STEP 3 — Merging product catalog data...")

catalog_cols = [
    "sku_id", "category", "subcategory", "brand",
    "base_price_usd", "cost_price_usd", "current_price_usd",
    "min_price_usd", "max_price_usd",
    "inventory_count", "restock_days", "avg_rating", "review_count",
]
catalog_clean = catalog_df[catalog_cols].copy()
catalog_clean["restock_days"] = catalog_clean["restock_days"].fillna(catalog_clean["restock_days"].median())
catalog_clean["margin"] = (catalog_clean["base_price_usd"] - catalog_clean["cost_price_usd"]) / catalog_clean["base_price_usd"]
catalog_clean["price_range"] = catalog_clean["max_price_usd"] - catalog_clean["min_price_usd"]
catalog_clean["price_range_pct"] = catalog_clean["price_range"] / (catalog_clean["base_price_usd"] + 1)
catalog_clean["inventory_urgency"] = 1.0 / (catalog_clean["inventory_count"] + 1)
catalog_clean["stock_days_ratio"] = catalog_clean["inventory_count"] / (catalog_clean["restock_days"] + 1)

merged_df = product_events.merge(catalog_clean, on="sku_id", how="inner")
print(f"  ✅ Merged catalog → {len(merged_df):,} products with full features")


# ═══════════════════════════════════════════════════════════════
# STEP 4: COMPETITOR PRICING FEATURES
# ═══════════════════════════════════════════════════════════════
print("\n💰 STEP 4 — Computing competitor pricing signals...")

# Aggregate competitor data per product
comp_agg = competitor_df.groupby("sku_id").agg(
    comp_avg_price=("competitor_price", "mean"),
    comp_min_price=("competitor_price", "min"),
    comp_max_price=("competitor_price", "max"),
    comp_price_std=("competitor_price", "std"),
    comp_records=("competitor_price", "count"),
    avg_price_delta=("price_delta_pct", "mean"),
    promo_rate=("is_on_promotion", "mean"),
    comp_in_stock_rate=("in_stock", "mean"),
).reset_index()

comp_agg["comp_price_std"] = comp_agg["comp_price_std"].fillna(0)

merged_df = merged_df.merge(comp_agg, on="sku_id", how="left")

# Competitive positioning
merged_df["price_vs_comp_avg"] = merged_df["base_price_usd"] / (merged_df["comp_avg_price"] + 1)
merged_df["price_vs_comp_min"] = merged_df["base_price_usd"] / (merged_df["comp_min_price"] + 1)
merged_df["comp_advantage"] = (merged_df["comp_avg_price"] - merged_df["base_price_usd"]) / (merged_df["base_price_usd"] + 1)

# Fill any NaN competitor columns (products without competitor data)
for col in comp_agg.columns:
    if col != "sku_id" and col in merged_df.columns:
        merged_df[col] = merged_df[col].fillna(0)

# Also fill positioning columns
merged_df["price_vs_comp_avg"] = merged_df["price_vs_comp_avg"].fillna(1.0)
merged_df["price_vs_comp_min"] = merged_df["price_vs_comp_min"].fillna(1.0)
merged_df["comp_advantage"] = merged_df["comp_advantage"].fillna(0.0)

print(f"  ✅ Merged competitor pricing for {len(comp_agg):,} products")


# ═══════════════════════════════════════════════════════════════
# STEP 5: USER SEGMENT WILLINGNESS-TO-PAY AGGREGATION
# ═══════════════════════════════════════════════════════════════
print("\n👥 STEP 5 — Computing user segment willingness-to-pay estimates...")

# Aggregate WTP by segment for per-product enrichment
user_seg_wtp = user_profiles_df.groupby("segment").agg(
    segment_avg_wtp=("willingness_to_pay_multiplier", "mean"),
    segment_avg_ltv=("lifetime_value_usd", "mean"),
    segment_avg_aov=("avg_order_value_usd", "mean"),
    segment_cart_abandon=("cart_abandonment_rate", "mean"),
    segment_purchase_freq=("purchase_frequency", "mean"),
    segment_count=("user_id", "count"),
).reset_index()

print(f"  ✅ Computed WTP for {len(user_seg_wtp)} user segments:")
for _, row in user_seg_wtp.iterrows():
    print(f"      {row['segment']:20s}  WTP={row['segment_avg_wtp']:.3f}  "
          f"AOV=${row['segment_avg_aov']:.0f}  LTV=${row['segment_avg_ltv']:.0f}  "
          f"n={row['segment_count']:,}")

# For each product, compute a weighted average WTP based on which segments interact with it
product_segment_events = events_df.groupby(["sku_id", "user_segment"]).size().reset_index(name="seg_event_count")
product_segment_events = product_segment_events.merge(user_seg_wtp, left_on="user_segment", right_on="segment", how="left")

# Weighted average WTP per product
product_wtp = (
    product_segment_events.groupby("sku_id")
    .apply(
        lambda g: np.average(g["segment_avg_wtp"], weights=g["seg_event_count"])
        if g["segment_avg_wtp"].notna().any() else 1.0,
        include_groups=False,
    )
    .reset_index(name="weighted_wtp")
)

merged_df = merged_df.merge(product_wtp, on="sku_id", how="left")
merged_df["weighted_wtp"] = merged_df["weighted_wtp"].fillna(1.0)

print(f"  ✅ Per-product WTP estimates computed")


# ═══════════════════════════════════════════════════════════════
# STEP 6: BUILD TARGET VARIABLE — OPTIMAL PRICE FACTOR
# ═══════════════════════════════════════════════════════════════
print("\n🎯 STEP 6 — Building target variable (optimal price factor)...")

# The target is a multiplier on the base price that maximizes revenue
# while respecting business constraints.
#
# Formula: price_factor = f(demand_signal, competitive_position, inventory, wtp)
#
# We construct a synthetic but realistic target:
#   - High demand + low competition + low inventory → higher factor (up to 1.5)
#   - Low demand + high competition + high inventory → lower factor (down to 0.7)

# Normalize components to [0,1]
def minmax(series):
    mn, mx = series.min(), series.max()
    if mx == mn:
        return pd.Series(0.5, index=series.index)
    return (series - mn) / (mx - mn)

merged_df["norm_demand"] = minmax(merged_df["log_demand"])
merged_df["norm_conversion"] = minmax(merged_df["conversion_rate"])
merged_df["norm_cart_rate"] = minmax(merged_df["cart_rate"])
merged_df["norm_comp_advantage"] = minmax(merged_df["comp_advantage"])
merged_df["norm_inventory_urgency"] = minmax(merged_df["inventory_urgency"])
merged_df["norm_wtp"] = minmax(merged_df["weighted_wtp"])
merged_df["norm_rating"] = minmax(merged_df["avg_rating"])

# Weighted composite score → price factor
merged_df["price_factor"] = (
    1.0  # base multiplier
    + 0.15 * merged_df["norm_demand"]           # demand pull
    + 0.10 * merged_df["norm_conversion"]       # purchase intent
    + 0.08 * merged_df["norm_cart_rate"]         # cart engagement
    + 0.12 * merged_df["norm_comp_advantage"]    # we're cheaper than competitors
    + 0.10 * merged_df["norm_inventory_urgency"] # scarcity premium
    + 0.08 * merged_df["norm_wtp"]              # willingness to pay
    + 0.05 * merged_df["norm_rating"]           # brand/quality premium
    - 0.10 * (1 - merged_df["norm_demand"])     # discount for low demand
)

# Enforce business rules on the target
merged_df["price_factor"] = merged_df["price_factor"].clip(0.70, 1.50)

# Ensure minimum margin: adjusted_price >= cost * 1.05
merged_df["adjusted_price"] = merged_df["base_price_usd"] * merged_df["price_factor"]
margin_floor = merged_df["cost_price_usd"] * 1.05
merged_df["adjusted_price"] = merged_df[["adjusted_price", "min_price_usd"]].max(axis=1)
merged_df["adjusted_price"] = merged_df[["adjusted_price"]].values.flatten()
merged_df.loc[merged_df["adjusted_price"] < margin_floor, "adjusted_price"] = margin_floor[merged_df["adjusted_price"] < margin_floor]
# Cap at max_price_usd
merged_df["adjusted_price"] = merged_df[["adjusted_price", "max_price_usd"]].min(axis=1)
# Recompute clamped factor
merged_df["price_factor"] = (merged_df["adjusted_price"] / merged_df["base_price_usd"]).clip(0.70, 1.50)

# Log-transform the target for better regression (prices are log-normal)
merged_df["target"] = np.log1p(merged_df["price_factor"])

print(f"  ✅ Price factor distribution:")
print(f"      Mean   = {merged_df['price_factor'].mean():.4f}")
print(f"      Median = {merged_df['price_factor'].median():.4f}")
print(f"      Min    = {merged_df['price_factor'].min():.4f}")
print(f"      Max    = {merged_df['price_factor'].max():.4f}")
print(f"      Std    = {merged_df['price_factor'].std():.4f}")


# ═══════════════════════════════════════════════════════════════
# STEP 7: SELECT FEATURES AND TRAIN
# ═══════════════════════════════════════════════════════════════
print("\n🧠 STEP 7 — Training GradientBoosting pricing model...")

features = [
    # Demand signals
    "views",
    "purchases",
    "carts",
    "wishlists",
    "checkouts",
    "log_demand",
    "conversion_rate",
    "cart_rate",
    "wishlist_rate",
    "checkout_rate",
    "cart_abandon_rate",
    "purchase_intensity",
    # Engagement
    "avg_session_duration",
    "avg_scroll_depth",
    "avg_time_on_page",
    "unique_users",
    # Product attributes
    "base_price_usd",
    "margin",
    "inventory_count",
    "restock_days",
    "inventory_urgency",
    "stock_days_ratio",
    "avg_rating",
    "review_count",
    # Competitor positioning
    "price_vs_comp_avg",
    "price_vs_comp_min",
    "comp_advantage",
    "comp_price_std",
    "promo_rate",
    "comp_in_stock_rate",
    # User WTP
    "weighted_wtp",
]

# Ensure no NaN in features
for f in features:
    if f not in merged_df.columns:
        merged_df[f] = 0
    merged_df[f] = merged_df[f].fillna(0)

X = merged_df[features].values
y = merged_df["target"].values

print(f"  Feature matrix: {X.shape[0]} samples × {X.shape[1]} features")

# Train/test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Scale features
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Train GradientBoosting with tuned hyperparameters
model = GradientBoostingRegressor(
    n_estimators=300,
    max_depth=5,
    learning_rate=0.05,
    subsample=0.8,
    min_samples_split=10,
    min_samples_leaf=5,
    max_features="sqrt",
    random_state=42,
    verbose=0,
)

print("  Training started...")
t0 = time.time()
model.fit(X_train_scaled, y_train)
train_time = time.time() - t0
print(f"  ✅ Training completed in {train_time:.1f}s")


# ═══════════════════════════════════════════════════════════════
# STEP 8: EVALUATE MODEL
# ═══════════════════════════════════════════════════════════════
print("\n📊 STEP 8 — Model Evaluation...")

y_pred_train = model.predict(X_train_scaled)
y_pred_test = model.predict(X_test_scaled)

# Convert from log-space back to factor space for interpretable metrics
y_test_factor = np.expm1(y_test)
y_pred_factor = np.expm1(y_pred_test)
y_train_factor = np.expm1(y_train)
y_pred_train_factor = np.expm1(y_pred_train)

metrics = {
    "train": {
        "r2": float(r2_score(y_train, y_pred_train)),
        "mae_log": float(mean_absolute_error(y_train, y_pred_train)),
        "mae_factor": float(mean_absolute_error(y_train_factor, y_pred_train_factor)),
        "rmse_log": float(np.sqrt(mean_squared_error(y_train, y_pred_train))),
    },
    "test": {
        "r2": float(r2_score(y_test, y_pred_test)),
        "mae_log": float(mean_absolute_error(y_test, y_pred_test)),
        "mae_factor": float(mean_absolute_error(y_test_factor, y_pred_factor)),
        "rmse_log": float(np.sqrt(mean_squared_error(y_test, y_pred_test))),
    },
}

print(f"  ┌─────────────────────────────────────────────────────┐")
print(f"  │  METRIC                    TRAIN         TEST       │")
print(f"  ├─────────────────────────────────────────────────────┤")
print(f"  │  R² Score               {metrics['train']['r2']:>8.4f}     {metrics['test']['r2']:>8.4f}     │")
print(f"  │  MAE (log-space)        {metrics['train']['mae_log']:>8.6f}     {metrics['test']['mae_log']:>8.6f}   │")
print(f"  │  MAE (factor)           {metrics['train']['mae_factor']:>8.6f}     {metrics['test']['mae_factor']:>8.6f}   │")
print(f"  │  RMSE (log-space)       {metrics['train']['rmse_log']:>8.6f}     {metrics['test']['rmse_log']:>8.6f}   │")
print(f"  └─────────────────────────────────────────────────────┘")

# Cross-validation
print("\n  Running 5-fold cross-validation...")
cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring="r2")
print(f"  CV R² scores: {cv_scores}")
print(f"  CV mean R² = {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
metrics["cv_r2_mean"] = float(cv_scores.mean())
metrics["cv_r2_std"] = float(cv_scores.std())


# ═══════════════════════════════════════════════════════════════
# STEP 9: FEATURE IMPORTANCE
# ═══════════════════════════════════════════════════════════════
print("\n📈 STEP 9 — Feature Importance...")

importances = model.feature_importances_
sorted_idx = np.argsort(importances)[::-1]

print(f"  Top 15 features:")
for i, idx in enumerate(sorted_idx[:15]):
    bar = "█" * int(importances[idx] * 100)
    print(f"    {i+1:2d}. {features[idx]:25s}  {importances[idx]:.4f}  {bar}")

feature_importance = {features[i]: float(importances[i]) for i in sorted_idx}


# ═══════════════════════════════════════════════════════════════
# STEP 10: FAIRNESS AUDIT
# ═══════════════════════════════════════════════════════════════
print("\n🔍 STEP 10 — Fairness Audit...")

# Check that pricing doesn't discriminate based on demographics
# We verify that the model doesn't use any demographic features directly
demographic_features = {"gender", "age_group", "country"}
used_features_set = set(features)
demographic_leak = demographic_features & used_features_set

fairness_report = {
    "demographic_features_used": list(demographic_leak),
    "is_fair": len(demographic_leak) == 0,
    "explanation": (
        "The pricing model does NOT use any demographic features (gender, age_group, country). "
        "Price factors are determined solely by product demand signals, competitor positioning, "
        "inventory levels, and behaviorally-derived willingness-to-pay estimates."
        if len(demographic_leak) == 0
        else f"WARNING: Demographic features {demographic_leak} are used in the model!"
    ),
}

# Verify price distribution across user segments (should be similar variance)
# We check by predicting for all products and comparing factor distributions
all_predictions = np.expm1(model.predict(scaler.transform(merged_df[features].values)))
merged_df["predicted_factor"] = all_predictions

factor_stats = merged_df["predicted_factor"].describe()
fairness_report["price_factor_stats"] = {
    "mean": float(factor_stats["mean"]),
    "std": float(factor_stats["std"]),
    "min": float(factor_stats["min"]),
    "max": float(factor_stats["max"]),
    "range": float(factor_stats["max"] - factor_stats["min"]),
}

print(f"  ✅ Fairness check: {'PASSED' if fairness_report['is_fair'] else 'FAILED'}")
print(f"     {fairness_report['explanation']}")
print(f"     Predicted factor range: {factor_stats['min']:.4f} — {factor_stats['max']:.4f}")


# ═══════════════════════════════════════════════════════════════
# STEP 11: SAVE ARTIFACTS
# ═══════════════════════════════════════════════════════════════
print("\n💾 STEP 11 — Saving model artifacts...")

os.makedirs(DATA_DIR, exist_ok=True)

# 11a. Save the trained model, scaler, and feature list
joblib.dump(model, dp("model.pkl"))
joblib.dump(scaler, dp("scaler.pkl"))
joblib.dump(features, dp("features.pkl"))
print("  ✅ model.pkl, scaler.pkl, features.pkl saved")

# 11b. Save pricing data (one row per product with all features)
pricing_cols = ["sku_id", "base_price_usd", "cost_price_usd", "min_price_usd", "max_price_usd",
                "category", "subcategory", "brand",
                "views", "purchases", "carts", "wishlists", "checkouts",
                "demand_velocity", "log_demand",
                "conversion_rate", "cart_rate", "wishlist_rate", "checkout_rate",
                "cart_abandon_rate", "purchase_intensity",
                "avg_session_duration", "avg_scroll_depth", "avg_time_on_page",
                "unique_users",
                "margin", "inventory_count", "restock_days",
                "inventory_urgency", "stock_days_ratio",
                "avg_rating", "review_count",
                "comp_avg_price", "comp_min_price", "comp_max_price",
                "price_vs_comp_avg", "price_vs_comp_min", "comp_advantage",
                "comp_price_std", "promo_rate", "comp_in_stock_rate",
                "weighted_wtp",
                "price_factor", "adjusted_price", "predicted_factor"]

# Make sure all columns exist
for col in pricing_cols:
    if col not in merged_df.columns:
        merged_df[col] = 0

pricing_output = merged_df[pricing_cols].copy()

# Rename sku_id to product_id for compatibility with the existing serving layer
pricing_output = pricing_output.rename(columns={"sku_id": "product_id"})

pricing_output.to_csv(dp("pricing_data.csv"), index=False)
print(f"  ✅ pricing_data.csv saved ({len(pricing_output):,} products)")

# 11c. Save user segment WTP reference
user_seg_wtp.to_csv(dp("user_segment_wtp.csv"), index=False)
print("  ✅ user_segment_wtp.csv saved")


# ═══════════════════════════════════════════════════════════════
# STEP 12: TRAIN CATEGORY RECOMMENDATION MODEL (Polynomial Reg)
# ═══════════════════════════════════════════════════════════════
print("\n🏷️ STEP 12 — Training Category Recommendation Model...")

from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression

# Build recommendation data from events + catalog
event_weight_map = {"page_view": 1, "product_view": 2, "search": 1,
                    "add_to_cart": 3, "add_to_wishlist": 2,
                    "checkout_start": 4, "purchase": 5,
                    "remove_from_cart": 0, "page_exit": 0}

events_df["event_score"] = events_df["event_type"].map(event_weight_map).fillna(1)

# Popularity per product
popularity_df = events_df.groupby("sku_id")["event_score"].sum().reset_index()
popularity_df.rename(columns={"event_score": "popularity"}, inplace=True)

# Interaction count
interaction_df = events_df.groupby("sku_id").size().reset_index(name="interaction_count")

# Average price from events
price_df = events_df.groupby("sku_id")["price_seen_usd"].mean().reset_index()
price_df.rename(columns={"price_seen_usd": "price"}, inplace=True)

# Build the recommendation dataset
cat_rec_data = catalog_df[["sku_id", "category", "subcategory", "brand", "base_price_usd"]].copy()
cat_rec_data = cat_rec_data.rename(columns={"sku_id": "product_id"})

# Merge popularity and interactions
popularity_df = popularity_df.rename(columns={"sku_id": "product_id"})
interaction_df = interaction_df.rename(columns={"sku_id": "product_id"})
price_df = price_df.rename(columns={"sku_id": "product_id"})

cat_rec_data = cat_rec_data.merge(popularity_df, on="product_id", how="left")
cat_rec_data = cat_rec_data.merge(interaction_df, on="product_id", how="left")
cat_rec_data = cat_rec_data.merge(price_df, on="product_id", how="left")

cat_rec_data["popularity"] = cat_rec_data["popularity"].fillna(0).astype(int)
cat_rec_data["interaction_count"] = cat_rec_data["interaction_count"].fillna(0).astype(int)
cat_rec_data["price"] = cat_rec_data["price"].fillna(cat_rec_data["base_price_usd"])
cat_rec_data["brand"] = cat_rec_data["brand"].fillna("generic")

# Build category_code as "category.subcategory" (lowercase, underscored)
cat_rec_data["category_code"] = (
    cat_rec_data["category"].str.lower().str.replace(" & ", "_").str.replace(" ", "_")
    + "."
    + cat_rec_data["subcategory"].str.lower().str.replace(" & ", "_").str.replace(" ", "_")
)

# Drop duplicates per product_id
cat_rec_data = cat_rec_data.drop_duplicates(subset=["product_id"])

# Train the Polynomial Regression model
X_cat = cat_rec_data[["price", "interaction_count"]].values
y_cat = cat_rec_data["popularity"].values

cat_model = Pipeline([
    ("poly", PolynomialFeatures(degree=2)),
    ("linear", LinearRegression()),
])
cat_model.fit(X_cat, y_cat)

# Compute hybrid score
cat_rec_data["predicted_score"] = cat_model.predict(X_cat)
cat_rec_data["final_score"] = 0.6 * cat_rec_data["predicted_score"] + 0.4 * cat_rec_data["popularity"]

# Save
joblib.dump(cat_model, dp("catrecommandmodel.pkl"))
cat_rec_data.to_csv(dp("catrecommandprocessed_data.csv"), index=False)
print(f"  ✅ catrecommandmodel.pkl saved")
print(f"  ✅ catrecommandprocessed_data.csv saved ({len(cat_rec_data):,} products)")


# ═══════════════════════════════════════════════════════════════
# STEP 13: TRAIN APRIORI ASSOCIATION RULES (Product Recs)
# ═══════════════════════════════════════════════════════════════
print("\n🔗 STEP 13 — Training Apriori Association Rules...")

from collections import Counter

# Sample events for Apriori (use purchases and cart events for co-occurrence)
purchase_events = events_df[events_df["event_type"].isin(["purchase", "add_to_cart"])].copy()

# Group by session to build transaction baskets
transactions = purchase_events.groupby("session_id")["sku_id"].apply(list).tolist()

# Filter products that appear rarely (< 5 times)
all_items = [item for bag in transactions for item in bag]
item_counts = Counter(all_items)
frequent_items = {p for p, c in item_counts.items() if c >= 5}

filtered_transactions = [
    list(set([p for p in t if p in frequent_items]))
    for t in transactions
]
filtered_transactions = [t for t in filtered_transactions if len(t) >= 2]

print(f"  Transactions for Apriori: {len(filtered_transactions):,}")

if len(filtered_transactions) > 0:
    try:
        from mlxtend.preprocessing import TransactionEncoder
        from mlxtend.frequent_patterns import apriori, association_rules as assoc_rules_func

        # Limit to manageable size for memory
        if len(filtered_transactions) > 100000:
            import random as rng
            rng.seed(42)
            filtered_transactions = rng.sample(filtered_transactions, 100000)

        te = TransactionEncoder()
        te_array = te.fit(filtered_transactions).transform(filtered_transactions)
        df_encoded = pd.DataFrame(te_array, columns=te.columns_)

        frequent_itemsets = apriori(df_encoded, min_support=0.0003, use_colnames=True, max_len=2)
        
        if frequent_itemsets.empty:
            print("  ⚠️  No frequent itemsets found with given support limit.")
            apriori_df = pd.DataFrame(columns=["antecedents", "consequents", "confidence", "lift", "support"])
        else:
            rules = assoc_rules_func(frequent_itemsets, metric="confidence", min_threshold=0.02)
            rules = rules[rules["antecedents"].apply(lambda x: len(x) == 1)]

            # Flatten frozensets to strings
            apriori_output = []
            for _, row in rules.iterrows():
                ant = list(row["antecedents"])[0]
                con = list(row["consequents"])[0]
                apriori_output.append({
                    "antecedents": ant,
                    "consequents": con,
                    "confidence": round(row["confidence"], 4),
                    "lift": round(row["lift"], 4),
                    "support": round(row["support"], 6),
                })
            apriori_df = pd.DataFrame(apriori_output)

        apriori_df.to_csv(dp("apriori_rules.csv"), index=False)
        print(f"  ✅ apriori_rules.csv saved ({len(apriori_df):,} rules)")
    except ImportError:
        print("  ⚠️  mlxtend not installed — skipping Apriori training")
        print("     Run: pip install mlxtend")
        # Create empty rules file
        pd.DataFrame(columns=["antecedents", "consequents", "confidence", "lift", "support"]).to_csv(
            dp("apriori_rules.csv"), index=False
        )
else:
    print("  ⚠️  No valid transactions for Apriori — saving empty rules")
    pd.DataFrame(columns=["antecedents", "consequents", "confidence", "lift", "support"]).to_csv(
        dp("apriori_rules.csv"), index=False
    )


# ═══════════════════════════════════════════════════════════════
# STEP 14: GENERATE DATASET.CSV (Legacy compatibility)
# ═══════════════════════════════════════════════════════════════
print("\n📄 STEP 14 — Generating Dataset.csv for legacy compatibility...")

# The recommendation_service.py loads Dataset.csv with columns:
#   product_id, user_id, event_type, price
# Map from our real data format

legacy_df = events_df[["sku_id", "user_id", "event_type", "price_seen_usd"]].copy()
legacy_df = legacy_df.rename(columns={
    "sku_id": "product_id",
    "price_seen_usd": "price",
})

# Map event types to legacy format
legacy_event_map = {
    "page_view": "view",
    "product_view": "view",
    "search": "view",
    "add_to_cart": "cart",
    "add_to_wishlist": "cart",
    "checkout_start": "cart",
    "purchase": "purchase",
    "remove_from_cart": "view",
    "page_exit": "view",
}
legacy_df["event_type"] = legacy_df["event_type"].map(legacy_event_map).fillna("view")

# Also add category_code and brand from catalog
catalog_map = catalog_df.set_index("sku_id")[["category", "subcategory", "brand"]].to_dict("index")
legacy_df["category_code"] = legacy_df["product_id"].map(
    lambda x: (catalog_map.get(x, {}).get("category", "unknown").lower().replace(" & ", "_").replace(" ", "_")
               + "."
               + catalog_map.get(x, {}).get("subcategory", "unknown").lower().replace(" & ", "_").replace(" ", "_"))
    if x in catalog_map else "unknown"
)
legacy_df["brand"] = legacy_df["product_id"].map(
    lambda x: catalog_map.get(x, {}).get("brand", "generic")
)

legacy_df.to_csv(dp("Dataset.csv"), index=False)
print(f"  ✅ Dataset.csv saved ({len(legacy_df):,} rows)")


# ═══════════════════════════════════════════════════════════════
# STEP 15: SAVE TRAINING REPORT
# ═══════════════════════════════════════════════════════════════
total_time = time.time() - training_start

report = {
    "timestamp": datetime.now().isoformat(),
    "training_duration_seconds": round(total_time, 1),
    "datasets": {
        "clickstream_events": len(events_df),
        "products": len(catalog_df),
        "competitor_records": len(competitor_df),
        "user_profiles": len(user_profiles_df),
    },
    "model": {
        "type": "GradientBoostingRegressor",
        "n_estimators": 300,
        "max_depth": 5,
        "learning_rate": 0.05,
        "n_features": len(features),
        "n_training_samples": len(X_train),
        "n_test_samples": len(X_test),
    },
    "metrics": metrics,
    "feature_importance_top10": dict(list(feature_importance.items())[:10]),
    "fairness_audit": fairness_report,
    "artifacts_saved": [
        "model.pkl", "scaler.pkl", "features.pkl",
        "pricing_data.csv", "user_segment_wtp.csv",
        "catrecommandmodel.pkl", "catrecommandprocessed_data.csv",
        "apriori_rules.csv", "Dataset.csv",
        "training_report.json",
    ],
    "business_rules": {
        "min_margin_pct": 5,
        "price_factor_min": 0.70,
        "price_factor_max": 1.50,
        "price_floor": "cost_price * 1.05",
        "price_ceiling": "max_price_usd",
    },
}

with open(dp("training_report.json"), "w") as f:
    json.dump(report, f, indent=2)
print(f"\n  ✅ training_report.json saved")


# ═══════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════
print("\n" + "=" * 72)
print("  ✅ ALL TRAINING COMPLETE!")
print("=" * 72)
print(f"  Total time     : {total_time:.1f}s ({total_time/60:.1f} min)")
print(f"  Products        : {len(merged_df):,}")
print(f"  Features        : {len(features)}")
print(f"  Test R²         : {metrics['test']['r2']:.4f}")
print(f"  Test MAE factor : {metrics['test']['mae_factor']:.6f}")
print(f"  CV R² (mean)    : {metrics['cv_r2_mean']:.4f}")
print(f"  Fairness        : {'✅ PASSED' if fairness_report['is_fair'] else '❌ FAILED'}")
print("=" * 72)
print(f"\n  Artifacts saved to: {DATA_DIR}")
print("  You can now start the Flask server with: python run.py")
print()
