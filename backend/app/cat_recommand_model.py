import pandas as pd
import numpy as np
import joblib
import os
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression

# =========================
# 1. LOAD DATA
# =========================
DATA_PATH = "./data/Dataset.csv"
if not os.path.exists(DATA_PATH):
    raise FileNotFoundError(f"Please place {DATA_PATH} in the root directory.")

df = pd.read_csv(DATA_PATH)

# =========================
# 2. PREPROCESSING
# =========================
# Standardize types and clean price
df['event_time'] = pd.to_datetime(df['event_time'])
df['category_code'] = df['category_code'].fillna('unknown').astype(str)
df = df[df['price'] > 0]
df = df.dropna(subset=['product_id', 'event_type'])

# Event scoring
event_weight = {"view": 1, "cart": 3, "purchase": 5}
df['event_score'] = df['event_type'].map(event_weight).fillna(1)

# =========================
# 3. FEATURE ENGINEERING
# =========================
# Calculate Popularity (Target variable)
popularity_df = df.groupby(['product_id'])['event_score'].sum().reset_index()
popularity_df.rename(columns={'event_score': 'popularity'}, inplace=True)

# Product Info (Features)
product_info = df.groupby('product_id').agg({
    'category_code': 'first',
    'brand': 'first',
    'price': 'mean'
}).reset_index()

# Interaction count (Proxy for brand strength/visibility)
brand_stats = df.groupby('product_id').agg({'brand': 'count'}).reset_index()
brand_stats.rename(columns={'brand': 'interaction_count'}, inplace=True)

# =========================
# 4. MERGE & CLEAN
# =========================
data = pd.merge(popularity_df, product_info, on='product_id', how='left')
data = pd.merge(data, brand_stats, on='product_id', how='left')

# Final Data Cleaning
data = data.drop_duplicates(subset=['product_id'])
data['brand'] = data['brand'].fillna('generic')

# =========================
# 5. TRAIN MODEL
# =========================
# Using interaction_count and price to predict popularity
X = data[['price', 'interaction_count']]
y = data['popularity']

model = Pipeline([
    ('poly', PolynomialFeatures(degree=2)),
    ('linear', LinearRegression())
])

model.fit(X, y)

# =========================
# 6. HYBRID SCORING
# =========================
# Add prediction to dataframe
data['predicted_score'] = model.predict(X)

# Hybrid score: Balance between real history (popularity) and predicted potential
# We normalize them slightly to ensure they are on a similar scale
data['final_score'] = (
    (0.6 * data['predicted_score']) + 
    (0.4 * data['popularity'])
)

# =========================
# 7. SAVE FOR FLASK
# =========================
# Ensure data folder exists
if not os.path.exists('data'):
    os.makedirs('data')

joblib.dump(model, "data/catrecommandmodel.pkl")
data.to_csv("data/catrecommandprocessed_data.csv", index=False)

print("✅ Training Complete.")
print(f"✅ Processed {len(data)} unique products.")
print("✅ Saved: data/catrecommandmodel.pkl & data/catrecommandprocessed_data.csv")