import pandas as pd
import numpy as np
import pickle
import ast
import os
from sklearn.metrics.pairwise import cosine_similarity

# Setup paths relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, "data")

class ProductEngine:
    def __init__(self):
        self.model = pickle.load(open(os.path.join(DATA_PATH, "ridge_model.pkl"), "rb"))
        self.scaler = pickle.load(open(os.path.join(DATA_PATH, "scaler.pkl"), "rb"))
        self.encoders = pickle.load(open(os.path.join(DATA_PATH, "encoders.pkl"), "rb"))
        self.df = pd.read_csv(os.path.join(DATA_PATH, "product_catalog.csv"))
        
        # Pre-compute similarity matrix for recommendations
        rec_features = pd.get_dummies(self.df[['category', 'subcategory']])
        self.cosine_sim = cosine_similarity(rec_features, rec_features)

    def preprocess_from_sku(self, sku_id):
        row = self.df[self.df['sku_id'] == sku_id]
        if row.empty:
            return None, "SKU not found"

        data = row.iloc[0].to_dict()

        # Feature Engineering
        launch_date = pd.to_datetime(data['launch_date'], dayfirst=True, errors='coerce')
        launch_year = launch_date.year if pd.notna(launch_date) else 0

        try:
            tags_count = len(ast.literal_eval(data['tags'])) if isinstance(data['tags'], str) else 0
        except:
            tags_count = 0

        # Encoding
        try:
            cat = self.encoders['category'].transform([str(data['category'])])[0]
            sub = self.encoders['subcategory'].transform([str(data['subcategory'])])[0]
            brand = self.encoders['brand'].transform([str(data['brand'])])[0]
        except Exception as e:
            return None, f"Encoding error: {str(e)}"

        features = np.array([[
            cat, sub, brand,
            data['cost_price_usd'], data['inventory_count'],
            data['avg_rating'], data['review_count'], data['weight_kg'],
            1 if data['is_active'] in [True, 'TRUE', 1] else 0,
            launch_year, tags_count,
            data['base_price_usd'] - data['cost_price_usd'], # margin
            data['inventory_count'] * data['cost_price_usd'], # inv_value
            data['avg_rating'] * data['review_count'] # weighted_rating
        ]])

        return self.scaler.transform(features), data

    def get_price_prediction(self, scaled_features):
        return self.model.predict(scaled_features)[0]

    def get_recommendations(self, sku_id, top_n=10):
        try:
            idx = self.df.index[self.df['sku_id'] == sku_id][0]
            sim_scores = list(enumerate(self.cosine_sim[idx]))
            sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
            # Skip first one as it is the product itself
            sim_indices = [i[0] for i in sim_scores[1:top_n+1]]
            return self.df[['sku_id', 'product_name', 'category', 'subcategory', 'current_price_usd']].iloc[sim_indices].to_dict(orient='records')
        except:
            return []