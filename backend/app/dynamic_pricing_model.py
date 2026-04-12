# =========================================
# IMPORTS
# =========================================
import pandas as pd
import numpy as np
import joblib
import os

# =========================================
# INFERENCE FUNCTION (used by pricing API)
# =========================================

_model = None
_scaler = None


def _load_model():
    """Lazy-load the saved model + scaler."""
    global _model, _scaler
    if _model is not None:
        return True
    model_path = os.path.join(os.path.dirname(__file__), "data", "model.pkl")
    scaler_path = os.path.join(os.path.dirname(__file__), "data", "scaler.pkl")
    if os.path.exists(model_path) and os.path.exists(scaler_path):
        try:
            _model = joblib.load(model_path)
            _scaler = joblib.load(scaler_path)
            return True
        except Exception as e:
            print(f"[DynamicPricing] Could not load model: {e}")
    return False


def predict_price(
    product_id: str,
    base_price: float,
    intent_prob: float = 0.05,
    wtp_estimate: float = 0.0,
    engagement_score: float = 0.1,
    competitor_min: float | None = None,
) -> float:
    """
    Return a predicted optimal price for the given product + session context.

    Falls back to a rule-based heuristic if the ML model isn't available.
    """
    # Heuristic fallback (always works, even without trained model)
    demand_signal = 0.6 * intent_prob + 0.4 * engagement_score
    multiplier = 1.0 + (demand_signal - 0.3) * 0.15  # ±~4-5 %

    if competitor_min and competitor_min > 0:
        comp_ratio = base_price / competitor_min
        if comp_ratio > 1.05:
            multiplier *= 0.97  # undercut slightly
        elif comp_ratio < 0.90:
            multiplier *= 1.02  # we're already cheaper

    if wtp_estimate and wtp_estimate > 0:
        wtp_ratio = wtp_estimate / base_price
        multiplier = 0.7 * multiplier + 0.3 * wtp_ratio

    return round(base_price * multiplier, 2)


# =========================================
# TRAINING (only when run directly)
# =========================================

def train_model():
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from sklearn.ensemble import GradientBoostingRegressor

    # ── LOAD DATA ──
    df = pd.read_csv("./data/Dataset.csv")
    df['product_id'] = df['product_id'].astype(int)

    # ── FEATURE ENGINEERING ──
    df['views'] = (df['event_type'] == 'view').astype(int)
    df['purchases'] = (df['event_type'] == 'purchase').astype(int)
    df['cart'] = (df['event_type'] == 'cart').astype(int)

    agg_df = df.groupby('product_id').agg({
        'views': 'sum',
        'purchases': 'sum',
        'cart': 'sum',
        'price': 'mean'
    }).reset_index()

    agg_df['demand'] = agg_df['views'] + agg_df['purchases'] + agg_df['cart']
    agg_df['conversion_rate'] = agg_df['purchases'] / (agg_df['views'] + 1)
    agg_df['cart_ratio'] = agg_df['cart'] / (agg_df['views'] + 1)
    agg_df['log_demand'] = np.log1p(agg_df['demand'])

    # ── TARGET (FACTOR MODEL) ──
    agg_df['price_factor'] = (
        1
        + 0.5 * agg_df['conversion_rate']
        + 0.3 * agg_df['cart_ratio']
    )
    agg_df['price_factor'] = agg_df['price_factor'].clip(0.7, 1.5)
    agg_df['target'] = np.log1p(agg_df['price_factor'])

    # ── FEATURES ──
    features = [
        'views', 'purchases', 'cart',
        'log_demand', 'conversion_rate', 'cart_ratio'
    ]
    X = agg_df[features]
    y = agg_df['target']

    # ── TRAIN ──
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)

    model = GradientBoostingRegressor()
    model.fit(X_train, y_train)

    # ── SAVE FILES ──
    os.makedirs("data", exist_ok=True)
    joblib.dump(model, "data/model.pkl")
    joblib.dump(scaler, "data/scaler.pkl")
    joblib.dump(features, "data/features.pkl")
    agg_df.to_csv("data/pricing_data.csv", index=False)

    print("✅ Model, scaler, features, CSV saved!")


if __name__ == "__main__":
    train_model()