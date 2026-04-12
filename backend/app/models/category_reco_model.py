import pandas as pd
import numpy as np
import ast
import pickle
import os

class ProductEngine:

    def __init__(self):

        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        PROJECT_ROOT = os.path.dirname(os.path.dirname(BASE_DIR))

        DATA_PATH = os.path.join(PROJECT_ROOT, 'app', 'data')

        # =========================
        # LOAD DATA
        # =========================
        self.df = pd.read_csv(os.path.join(DATA_PATH, 'product_catalog.csv'))

        # =========================
        # LOAD MODEL FILES
        # =========================
        self.model = pickle.load(open(os.path.join(DATA_PATH, 'model2', 'ridge_model.pkl'), 'rb'))
        self.scaler = pickle.load(open(os.path.join(DATA_PATH, 'model2', 'scaler.pkl'), 'rb'))
        self.encoders = pickle.load(open(os.path.join(DATA_PATH, 'model2', 'encoders.pkl'), 'rb'))
        self.FEATURE_COLUMNS = pickle.load(open(os.path.join(DATA_PATH, 'model2', 'features.pkl'), 'rb'))

    # =========================
    # PREPROCESS FROM SKU
    # =========================
    def preprocess_from_sku(self, sku_id):

        product_df = self.df[self.df['sku_id'] == sku_id]

        if product_df.empty:
            return None, "Product not found"

        product = product_df.iloc[0].copy()
        row = product.copy()

        # Date
        row['launch_date'] = pd.to_datetime(row['launch_date'], format='%d/%m/%y', errors='coerce')
        row['launch_year'] = row['launch_date'].year if pd.notnull(row['launch_date']) else 0

        # Boolean
        row['is_active'] = 1 if str(row['is_active']).upper() == 'TRUE' else 0

        # Tags
        try:
            row['tags_count'] = len(ast.literal_eval(row['tags']))
        except:
            row['tags_count'] = 0

        # Feature engineering
        row['price_margin'] = row['base_price_usd'] - row['cost_price_usd']
        row['inventory_value'] = row['inventory_count'] * row['cost_price_usd']
        row['rating_weighted'] = row['avg_rating'] * row['review_count']

        # Encoding (IMPORTANT)
        for col in ['category','subcategory','brand']:
            if row[col] in self.encoders[col].classes_:
                row[col] = self.encoders[col].transform([row[col]])[0]
            else:
                row[col] = 0

        # Feature input
        X = pd.DataFrame([row])
        X = X[self.FEATURE_COLUMNS]
        X = X.fillna(0)

        return X, product

    # =========================
    # PRICE PREDICTION
    # =========================
    def get_price_prediction(self, X):

        X_scaled = self.scaler.transform(X)
        pred = self.model.predict(X_scaled)[0]

        return float(pred)

    # =========================
    # RECOMMENDATION (FIXED 🔥)
    # =========================
    def get_recommendations(self, sku_id, top_n=10):

        product_df = self.df[self.df['sku_id'] == sku_id]

        if product_df.empty:
            return []

        product = product_df.iloc[0]

        # IMPORTANT: use ORIGINAL STRING values
        category = product['category']
        subcategory = product['subcategory']

        # =========================
        # LEVEL 1: SAME SUBCATEGORY
        # =========================
        recs = self.df[
            (self.df['subcategory'] == subcategory) &
            (self.df['sku_id'] != sku_id)
        ].copy()

        # =========================
        # LEVEL 2: SAME CATEGORY
        # =========================
        if recs.empty:
            recs = self.df[
                (self.df['category'] == category) &
                (self.df['sku_id'] != sku_id)
            ].copy()

        # =========================
        # LEVEL 3: GLOBAL FALLBACK
        # =========================
        if recs.empty:
            recs = self.df[self.df['sku_id'] != sku_id].copy()

        # =========================
        # RANKING
        # =========================
        recs['score'] = (
            recs['avg_rating'] * 0.6 +
            np.log1p(recs['review_count']) * 0.3 +
            (recs['inventory_count'] / (recs['inventory_count'].max() + 1)) * 0.1
        )

        recs = recs.sort_values(by='score', ascending=False).head(top_n)

        return [
            {
                "sku_id": str(row['sku_id']),
                "product_name": str(row['product_name']),
                "brand": str(row['brand'])
            }
            for _, row in recs.iterrows()
        ]