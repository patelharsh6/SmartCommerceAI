from flask import Blueprint, request, jsonify
import pandas as pd
import numpy as np
import ast
import pickle
import os

category_model = Blueprint('category_model', __name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

# =========================
# LOAD DATA + MODEL
# =========================
df = pd.read_csv(os.path.join(PROJECT_ROOT, 'data', 'product_catalog.csv'))

model = pickle.load(open(os.path.join(PROJECT_ROOT, 'data', 'model2', 'ridge_model.pkl'), 'rb'))
scaler = pickle.load(open(os.path.join(PROJECT_ROOT, 'data', 'model2', 'scaler.pkl'), 'rb'))
encoders = pickle.load(open(os.path.join(PROJECT_ROOT, 'data', 'model2', 'encoders.pkl'), 'rb'))
FEATURE_COLUMNS = pickle.load(open(os.path.join(PROJECT_ROOT, 'data', 'model2', 'features.pkl'), 'rb'))
metrics = pickle.load(open(os.path.join(PROJECT_ROOT, 'data', 'model2', 'metrics.pkl'), 'rb'))

# =========================
# PREPROCESS FUNCTION
# =========================
def preprocess(row):

    row['launch_date'] = pd.to_datetime(row['launch_date'], format='%d/%m/%y', errors='coerce')
    row['launch_year'] = row['launch_date'].year if pd.notnull(row['launch_date']) else 0

    row['is_active'] = 1 if str(row['is_active']).upper() == 'TRUE' else 0

    try:
        row['tags_count'] = len(ast.literal_eval(row['tags']))
    except:
        row['tags_count'] = 0

    row['price_margin'] = row['base_price_usd'] - row['cost_price_usd']
    row['inventory_value'] = row['inventory_count'] * row['cost_price_usd']
    row['rating_weighted'] = row['avg_rating'] * row['review_count']

    # Encode categorical
    for col in ['category', 'subcategory', 'brand']:
        if row[col] in encoders[col].classes_:
            row[col] = encoders[col].transform([row[col]])[0]
        else:
            row[col] = 0

    return row

# =========================
# GET METRICS
# =========================
@category_model.route('/metrics', methods=['GET'])
def get_metrics():
    return jsonify(metrics)

# =========================
# GET PRODUCT DETAILS
# =========================
@category_model.route('/product/<sku_id>', methods=['GET'])
def get_product(sku_id):

    product = df[df['sku_id'] == sku_id]

    if product.empty:
        return jsonify({"error": "Product not found"}), 404

    product = product.iloc[0]

    return jsonify({
        "sku_id": str(product['sku_id']),
        "product_name": str(product['product_name']),
        "category": str(product['category']),
        "subcategory": str(product['subcategory']),
        "brand": str(product['brand'])
    })

# =========================
# PREDICT + RECOMMEND
# =========================
@category_model.route('/recommendations/<sku_id>', methods=['GET'])
def get_recommendations(sku_id):

    user_id = request.args.get("user_id")

    product_df = df[df['sku_id'] == sku_id]

    if product_df.empty:
        return jsonify({"error": "Product not found"}), 404

    product = product_df.iloc[0]

    # =========================
    # CATEGORY BASED 🔥 (MAIN FIX)
    # =========================
    category_recs = df[
        (df['category'] == product['category']) &
        (df['sku_id'] != sku_id)
    ].copy()

    category_recs = category_recs.head(6)

    # =========================
    # FREQUENTLY BOUGHT (DUMMY)
    # =========================
    freq_recs = df.sample(n=6)

    # =========================
    # SESSION BASED (DUMMY)
    # =========================
    session_recs = df.sample(n=6)

    # =========================
    # TRENDING
    # =========================
    trending_recs = df.sort_values(
        by="review_count", ascending=False
    ).head(6)

    # =========================
    # FORMAT FUNCTION
    # =========================
    def format_products(data):
        return [
            {
                "product_id": str(row['sku_id']),   # 🔥 IMPORTANT
                "name": row['product_name'],
                "category": row['category'],
                "base_price": float(row['base_price_usd']),
                "image": "",  # optional
            }
            for _, row in data.iterrows()
        ]

    # =========================
    # FINAL RESPONSE (MATCH FRONTEND)
    # =========================
    return jsonify({
        "category_based": {
            "products": format_products(category_recs),
            "explanation": f"Similar products from {product['category']}"
        },
        "frequently_bought": {
            "products": format_products(freq_recs),
            "explanation": "Customers also bought"
        },
        "session_based": {
            "products": format_products(session_recs),
            "explanation": "Based on your activity"
        },
        "trending": {
            "products": format_products(trending_recs),
            "explanation": "Trending products"
        }
    })