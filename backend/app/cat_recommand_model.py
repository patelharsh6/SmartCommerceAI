import pandas as pd
import numpy as np
import ast
import pickle

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import Ridge

# =========================
# LOAD DATA
# =========================
df = pd.read_csv('data/product_catalog.csv')

# Drop useless column
df.drop(['restock_days'], axis=1, inplace=True)

# Date
df['launch_date'] = pd.to_datetime(df['launch_date'], format='%d/%m/%y', errors='coerce')
df['launch_year'] = df['launch_date'].dt.year
df['launch_year'] = df['launch_year'].fillna(df['launch_year'].median()).fillna(0)
df.drop(['launch_date'], axis=1, inplace=True)

# Boolean
df['is_active'] = df['is_active'].map({'TRUE': 1, 'FALSE': 0, True: 1, False: 0}).fillna(0)

# Tags
def count_tags(x):
    try:
        return len(ast.literal_eval(x))
    except:
        return 0

df['tags_count'] = df['tags'].apply(count_tags)

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

# Features
X = df.drop([
    'sku_id','product_name','tags','current_price_usd',
    'base_price_usd','min_price_usd','max_price_usd'
], axis=1)

y = df['current_price_usd']

X = X.fillna(X.median(numeric_only=True)).fillna(0)

# Scaling
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# Train model
model = Ridge(alpha=10)
model.fit(X_scaled, y)

# =========================
# SAVE FILES
# =========================
pickle.dump(model, open("data/ridge_model.pkl", "wb"))
pickle.dump(scaler, open("data/scaler.pkl", "wb"))
pickle.dump(encoders, open("data/encoders.pkl", "wb"))

print("✅ Model files saved in /data folder")