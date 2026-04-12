import pandas as pd
import numpy as np
import ast
import pickle
import os

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

# =========================
# LOAD DATA
# =========================
df = pd.read_csv(os.path.join(PROJECT_ROOT, 'data', 'product_catalog.csv'))

# =========================
# PREPROCESSING
# =========================

# Date
df['launch_date'] = pd.to_datetime(df['launch_date'], format='%d/%m/%y', errors='coerce')
df['launch_year'] = df['launch_date'].dt.year
df['launch_year'] = df['launch_year'].fillna(df['launch_year'].median()).fillna(0)

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

# =========================
# ENCODING
# =========================
cat_cols = ['category', 'subcategory', 'brand']
encoders = {}

for col in cat_cols:
    df[col] = df[col].fillna("Unknown")
    le = LabelEncoder()
    df[col] = le.fit_transform(df[col])
    encoders[col] = le

# =========================
# FEATURE SELECTION (IMPORTANT 🔥)
# =========================

FEATURE_COLUMNS = [
    'category','subcategory','brand',
    'base_price_usd','cost_price_usd',
    'inventory_count','avg_rating','review_count','weight_kg',
    'is_active','launch_year','tags_count',
    'price_margin','inventory_value','rating_weighted'
]

X = df[FEATURE_COLUMNS]

y = df['current_price_usd']

# Handle missing values
X = X.fillna(X.median(numeric_only=True)).fillna(0)

# =========================
# TRAIN TEST SPLIT
# =========================
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# =========================
# SCALING
# =========================
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# =========================
# MODEL
# =========================
model = Ridge(alpha=10)
model.fit(X_train_scaled, y_train)

# =========================
# EVALUATION
# =========================
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

# =========================
# SAVE
# =========================
save_path = os.path.join(PROJECT_ROOT, 'data', 'model2')
os.makedirs(save_path, exist_ok=True)

pickle.dump(model, open(os.path.join(save_path, 'ridge_model.pkl'), 'wb'))
pickle.dump(scaler, open(os.path.join(save_path, 'scaler.pkl'), 'wb'))
pickle.dump(encoders, open(os.path.join(save_path, 'encoders.pkl'), 'wb'))
pickle.dump(metrics, open(os.path.join(save_path, 'metrics.pkl'), 'wb'))
pickle.dump(FEATURE_COLUMNS, open(os.path.join(save_path, 'features.pkl'), 'wb'))

print(f"✅ Model + Metrics saved in {save_path}")