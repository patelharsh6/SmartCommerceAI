"""
category_reco_model.py
======================
- Training script (runs when executed directly: python -m app.models.category_reco_model)
- ProductEngine class for inference (imported by product_service.py)
"""

import pandas as pd
import numpy as np
import ast
import pickle
import os

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.metrics.pairwise import cosine_similarity

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

FEATURE_COLUMNS = [
    'category', 'subcategory', 'brand',
    'base_price_usd', 'cost_price_usd',
    'inventory_count', 'avg_rating', 'review_count', 'weight_kg',
    'is_active', 'launch_year', 'tags_count',
    'price_margin', 'inventory_value', 'rating_weighted'
]


# ═══════════════════════════════════════════════════════════════
# ProductEngine — Inference class (used by product_service.py)
# ═══════════════════════════════════════════════════════════════

class ProductEngine:
    """
    Loads the pre-trained Ridge model + catalog and provides:
      - preprocess_from_sku(sku_id)  → (features_array, raw_row_dict)
      - get_price_prediction(features) → float
      - get_recommendations(sku_id, top_n) → list[dict]
    """

    def __init__(self):
        data_dir = os.path.join(PROJECT_ROOT, 'data')
        model_dir = os.path.join(data_dir, 'model2')

        # ── Load catalog ──
        catalog_path = os.path.join(data_dir, 'product_catalog.csv')
        self.catalog = pd.read_csv(catalog_path)
        self.catalog['sku_id'] = self.catalog['sku_id'].astype(str)

        # ── Load Ridge model artifacts ──
        try:
            self.model = pickle.load(open(os.path.join(model_dir, 'ridge_model.pkl'), 'rb'))
            self.scaler = pickle.load(open(os.path.join(model_dir, 'scaler.pkl'), 'rb'))
            self.encoders = pickle.load(open(os.path.join(model_dir, 'encoders.pkl'), 'rb'))
            self.features = pickle.load(open(os.path.join(model_dir, 'features.pkl'), 'rb'))
            self._model_loaded = True
        except Exception as e:
            print(f"  [WARN] ProductEngine: Could not load Ridge model: {e}")
            self.model = None
            self.scaler = None
            self.encoders = None
            self.features = FEATURE_COLUMNS
            self._model_loaded = False

        # ── Build cosine-similarity matrix for recommendations ──
        try:
            rec_df = pd.get_dummies(self.catalog[['category', 'subcategory']])
            self._sim_matrix = cosine_similarity(rec_df, rec_df)
        except Exception:
            self._sim_matrix = None

        # ── SKU lookup ──
        self._sku_index = {
            str(row['sku_id']): idx for idx, row in self.catalog.iterrows()
        }

    # ────────────────────────────────────────────────────────────
    def preprocess_from_sku(self, sku_id):
        """
        Look up a product by sku_id, engineer features and return
        (scaled_features_array, raw_row_dict).
        Returns (None, error_string) on failure.
        """
        sku_id = str(sku_id)
        idx = self._sku_index.get(sku_id)
        if idx is None:
            return None, f"SKU '{sku_id}' not found in catalog"

        row = self.catalog.iloc[idx]
        raw_data = row.to_dict()

        if not self._model_loaded:
            return None, "Ridge model not loaded — cannot preprocess"

        try:
            # Date
            launch_date = pd.to_datetime(
                raw_data.get('launch_date'), format='mixed', dayfirst=True, errors='coerce'
            )
            launch_year = launch_date.year if pd.notna(launch_date) else 0

            # Tags
            try:
                tags_count = len(ast.literal_eval(raw_data['tags'])) if isinstance(raw_data.get('tags'), str) else 0
            except Exception:
                tags_count = 0

            # Encode categoricals
            cat_enc = self.encoders['category'].transform([str(raw_data.get('category', 'Unknown'))])[0]
            sub_enc = self.encoders['subcategory'].transform([str(raw_data.get('subcategory', 'Unknown'))])[0]
            brand_enc = self.encoders['brand'].transform([str(raw_data.get('brand', 'Unknown'))])[0]

            is_active = 1 if raw_data.get('is_active') in [True, 'TRUE', 'True', 1] else 0
            base_price = float(raw_data.get('base_price_usd', 0))
            cost_price = float(raw_data.get('cost_price_usd', 0))
            inventory = int(raw_data.get('inventory_count', 0))
            rating = float(raw_data.get('avg_rating', 0))
            reviews = int(raw_data.get('review_count', 0))
            weight = float(raw_data.get('weight_kg', 0))

            features = np.array([[
                cat_enc, sub_enc, brand_enc,
                base_price, cost_price,
                inventory, rating, reviews, weight,
                is_active, launch_year, tags_count,
                base_price - cost_price,       # price_margin
                inventory * cost_price,        # inventory_value
                rating * reviews               # rating_weighted
            ]])

            scaled = self.scaler.transform(features)
            return scaled, raw_data

        except Exception as e:
            return None, f"Preprocessing failed: {e}"

    # ────────────────────────────────────────────────────────────
    def get_price_prediction(self, features):
        """Predict current_price_usd from preprocessed (scaled) features."""
        if not self._model_loaded or self.model is None:
            return 0.0
        predicted = self.model.predict(features)[0]
        return max(0.01, round(float(predicted), 2))

    # ────────────────────────────────────────────────────────────
    def get_recommendations(self, sku_id, top_n=10):
        """Return top_n similar products using cosine similarity."""
        sku_id = str(sku_id)
        idx = self._sku_index.get(sku_id)
        if idx is None or self._sim_matrix is None:
            return []

        sim_scores = list(enumerate(self._sim_matrix[idx]))
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)

        # Skip the product itself (index 0 in sorted list)
        results = []
        for i, score in sim_scores[1:top_n + 1]:
            row = self.catalog.iloc[i]
            results.append({
                'sku_id': str(row['sku_id']),
                'product_name': str(row.get('product_name', '')),
                'category': str(row.get('category', '')),
                'subcategory': str(row.get('subcategory', '')),
                'brand': str(row.get('brand', '')),
                'current_price_usd': float(row.get('current_price_usd', 0)),
                'similarity_score': round(float(score), 4),
            })
        return results


# ═══════════════════════════════════════════════════════════════
# TRAINING SCRIPT — only runs when executed directly
# ═══════════════════════════════════════════════════════════════

def _count_tags(x):
    try:
        return len(ast.literal_eval(x))
    except Exception:
        return 0


def train_model():
    """Train the Ridge price-prediction model and save artifacts."""
    df = pd.read_csv(os.path.join(PROJECT_ROOT, 'data', 'product_catalog.csv'))

    # Date
    df['launch_date'] = pd.to_datetime(df['launch_date'], format='%d/%m/%y', errors='coerce')
    df['launch_year'] = df['launch_date'].dt.year
    df['launch_year'] = df['launch_year'].fillna(df['launch_year'].median()).fillna(0)

    # Boolean
    df['is_active'] = df['is_active'].map({'TRUE': 1, 'FALSE': 0, True: 1, False: 0}).fillna(0)

    # Tags
    df['tags_count'] = df['tags'].apply(_count_tags)

    # Feature Engineering
    df['price_margin'] = df['base_price_usd'] - df['cost_price_usd']
    df['inventory_value'] = df['inventory_count'] * df['cost_price_usd']
    df['rating_weighted'] = df['avg_rating'] * df['review_count']

    # Encoding
    cat_cols = ['category', 'subcategory', 'brand']
    encoders = {}
    for col in cat_cols:
        df[col] = df[col].fillna("Unknown")
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col])
        encoders[col] = le

    X = df[FEATURE_COLUMNS]
    y = df['current_price_usd']
    X = X.fillna(X.median(numeric_only=True)).fillna(0)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = Ridge(alpha=10)
    model.fit(X_train_scaled, y_train)

    # Evaluation
    y_pred = model.predict(X_test_scaled)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    wmape = np.sum(np.abs(y_test - y_pred)) / np.sum(y_test)
    cv_scores = cross_val_score(model, X_train_scaled, y_train, cv=5, scoring='r2')

    metrics = {
        "MAE": float(mae),
        "RMSE": float(rmse),
        "R2": float(r2),
        "WMAPE": float(wmape),
        "Accuracy": float((1 - wmape) * 100),
        "CV_R2_mean": float(cv_scores.mean())
    }
    print("✅ METRICS:", metrics)

    # Save
    save_path = os.path.join(PROJECT_ROOT, 'data', 'model2')
    os.makedirs(save_path, exist_ok=True)

    pickle.dump(model, open(os.path.join(save_path, 'ridge_model.pkl'), 'wb'))
    pickle.dump(scaler, open(os.path.join(save_path, 'scaler.pkl'), 'wb'))
    pickle.dump(encoders, open(os.path.join(save_path, 'encoders.pkl'), 'wb'))
    pickle.dump(metrics, open(os.path.join(save_path, 'metrics.pkl'), 'wb'))
    pickle.dump(FEATURE_COLUMNS, open(os.path.join(save_path, 'features.pkl'), 'wb'))

    print(f"✅ Model + Metrics saved in {save_path}")


if __name__ == "__main__":
    train_model()