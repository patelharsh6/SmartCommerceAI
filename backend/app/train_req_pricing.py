import pandas as pd
import numpy as np
import joblib
import os
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import GradientBoostingRegressor

def minmax(series):
    mn, mx = series.min(), series.max()
    if mx == mn:
        return pd.Series(0.5, index=series.index)
    return (series - mn) / (mx - mn)

print("Loading pricing_data.csv...")
df = pd.read_csv("backend/app/data/pricing_data.csv")

print("Synthesizing Time-Based Pricing features...")
# To train time-based capabilities, we'll duplicate the dataset for 4 different time-slots
# Peak (18-22), Regular (10-18), Low (0-6), Morning (6-10)

time_scenarios = [
    {"hour_of_day": 20, "time_multiplier": 1.10}, # Peak surge
    {"hour_of_day": 14, "time_multiplier": 1.00}, # Regular
    {"hour_of_day": 4,  "time_multiplier": 0.90}, # Low sleep hours = discount
    {"hour_of_day": 8,  "time_multiplier": 0.98}, # Morning
]

expanded_dfs = []
for scenario in time_scenarios:
    temp_df = df.copy()
    temp_df["hour_of_day"] = scenario["hour_of_day"]
    temp_df["time_multiplier"] = scenario["time_multiplier"]
    expanded_dfs.append(temp_df)

df = pd.concat(expanded_dfs, ignore_index=True)

print("Engineering optimal price factor target based on 4 criteria...")
# 🔹 1. Demand-Based Pricing
# 🔹 2. Time-Based Pricing 
# 🔹 3. Competitive Pricing
# 🔹 4. Inventory-Based Pricing

# Base factor initialized with Time-Based Pricing
factor = df["time_multiplier"]

# 🔹 1. Demand (Higher demand = increase price)
factor += 0.15 * minmax(np.log1p(df["demand_velocity"].fillna(0)))

# 🔹 3. Competitive Pricing (If we have a huge advantage, we can raise, if disadvantage, lower)
factor += 0.10 * df["comp_advantage"].fillna(0).clip(-0.5, 0.5) 

# 🔹 4. Inventory (Scarcity = premium, overstock = clearance discount)
factor += 0.10 * np.where(df["inventory_count"].fillna(0) < 20, 1.0, 0.0) # Scarcity
factor -= 0.05 * np.where(df["inventory_count"].fillna(0) > 500, 1.0, 0.0) # Overstock

# Willingness To Pay / Segmentation
factor += 0.05 * (df["weighted_wtp"].fillna(1.0) - 1.0)

# Clip between sensible business margins (30% discount max, 50% surge max)
df["target_factor"] = factor.clip(0.70, 1.50)
df["target_log"] = np.log1p(df["target_factor"])

# Selecting features that ML uses exactly mapping to the requirements
features = [
    "demand_velocity",    # 1. Demand
    "conversion_rate",    # 1. Demand
    "hour_of_day",        # 2. Time
    "comp_advantage",     # 3. Competitive
    "price_vs_comp_avg",  # 3. Competitive
    "inventory_count",    # 4. Inventory
    "inventory_urgency",  # 4. Inventory
    "weighted_wtp"        # ML WTP Estimate
]

X = df[features].fillna(0)
y = df["target_log"]

print(f"Training Regression Model on {len(X)} combinations with features: {features}")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# Gradient Boosting for nonlinear relationships between demand and inventory
model = GradientBoostingRegressor(n_estimators=150, max_depth=5, learning_rate=0.1, random_state=42)
model.fit(X_train_scaled, y_train)

score = model.score(X_test_scaled, y_test)
print(f"✅ Model R^2 Test Score: {score:.4f}")

# Save the trained artifacts over the legacy files
os.makedirs("backend/app/data", exist_ok=True)
joblib.dump(model, "backend/app/data/model.pkl")
joblib.dump(scaler, "backend/app/data/scaler.pkl")
joblib.dump(features, "backend/app/data/features.pkl")

print("🎯 SUCCESS! Model trained securely according to specifications and saved to model.pkl")
