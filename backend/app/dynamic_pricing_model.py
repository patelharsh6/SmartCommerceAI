# =========================================
# IMPORTS
# =========================================
import pandas as pd
import numpy as np
import joblib
import os

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingRegressor

# =========================================
# LOAD DATA
# =========================================
df = pd.read_csv("./data/Dataset.csv")

# =========================
# FIX DATA TYPES
# =========================
df['product_id'] = df['product_id'].astype(int)

# =========================================
# FEATURE ENGINEERING
# =========================================
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

# =========================================
# TARGET (FACTOR MODEL)
# =========================================
agg_df['price_factor'] = (
    1
    + 0.5 * agg_df['conversion_rate']
    + 0.3 * agg_df['cart_ratio']
)

agg_df['price_factor'] = agg_df['price_factor'].clip(0.7, 1.5)
agg_df['target'] = np.log1p(agg_df['price_factor'])

# =========================================
# FEATURES
# =========================================
features = [
    'views',
    'purchases',
    'cart',
    'log_demand',
    'conversion_rate',
    'cart_ratio'
]

X = agg_df[features]
y = agg_df['target']

# =========================================
# TRAIN
# =========================================
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

scaler = StandardScaler()
X_train = scaler.fit_transform(X_train)

model = GradientBoostingRegressor()
model.fit(X_train, y_train)

# =========================================
# SAVE FILES
# =========================================
os.makedirs("data", exist_ok=True)

joblib.dump(model, "data/model.pkl")
joblib.dump(scaler, "data/scaler.pkl")
joblib.dump(features, "data/features.pkl")
agg_df.to_csv("data/pricing_data.csv", index=False)

print("✅ Model, scaler, features, CSV saved!")