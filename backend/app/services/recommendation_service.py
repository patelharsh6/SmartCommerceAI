
"""
Recommendation & Pricing Service
Uses product_catalog.csv as the single source of truth.
- Category/Brand Recommendation (Cosine Similarity on catalog features)
- Price Prediction (Ridge Regression — model2/)
- Dynamic Pricing (rule-based adjustments on top of predicted price)

All data is derived from product_catalog.csv — no external datasets required.
"""

import pickle
import numpy as np
import pandas as pd
import ast
import os
import random
from datetime import datetime, date
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

# ═══════════════════════════════════════════════════════════════
# PATH SETUP
# ═══════════════════════════════════════════════════════════════
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
MODEL2_DIR = os.path.join(DATA_DIR, "model2")

def _data_path(filename):
    return os.path.join(DATA_DIR, filename)

def _model2_path(filename):
    return os.path.join(MODEL2_DIR, filename)


# ═══════════════════════════════════════════════════════════════
# 1. LOAD PRODUCT CATALOG
# ═══════════════════════════════════════════════════════════════
print("  [+] Loading product catalog...")
catalog_df = pd.read_csv(_data_path("product_catalog.csv"))

# Clean boolean column
if "is_active" in catalog_df.columns:
    catalog_df["is_active"] = catalog_df["is_active"].map(
        {"TRUE": True, "FALSE": False, True: True, False: False, 1: True, 0: False}
    ).fillna(True)
    catalog_df = catalog_df[catalog_df["is_active"] == True].reset_index(drop=True)

# Fill NaN values
catalog_df["category"] = catalog_df["category"].fillna("Other")
catalog_df["subcategory"] = catalog_df["subcategory"].fillna("General")
catalog_df["brand"] = catalog_df["brand"].fillna("Generic")
catalog_df["product_name"] = catalog_df["product_name"].fillna("Product")
catalog_df["avg_rating"] = catalog_df["avg_rating"].fillna(0)
catalog_df["review_count"] = catalog_df["review_count"].fillna(0).astype(int)
catalog_df["inventory_count"] = catalog_df["inventory_count"].fillna(0).astype(int)
catalog_df["image_url"] = catalog_df["image_url"].fillna("")

# Build product lookup by sku_id
PRODUCT_LOOKUP = {}
for _, row in catalog_df.iterrows():
    PRODUCT_LOOKUP[str(row["sku_id"])] = row.to_dict()

# Get unique categories and brands
ALL_CATEGORIES = sorted(catalog_df["category"].dropna().unique().tolist())
ALL_SUBCATEGORIES = {}
for cat in ALL_CATEGORIES:
    subs = sorted(
        catalog_df[catalog_df["category"] == cat]["subcategory"]
        .dropna().unique().tolist()
    )
    ALL_SUBCATEGORIES[cat] = subs

ALL_BRANDS = sorted(catalog_df["brand"].dropna().unique().tolist())

print(f"     -> {len(catalog_df)} products in catalog")
print(f"     -> {len(ALL_CATEGORIES)} categories, {len(ALL_BRANDS)} brands")


# ═══════════════════════════════════════════════════════════════
# 2. LOAD RIDGE MODEL (Price Prediction — trained on catalog)
# ═══════════════════════════════════════════════════════════════
print("  [+] Loading Ridge price-prediction model...")
try:
    ridge_model = pickle.load(open(_model2_path("ridge_model.pkl"), "rb"))
    ridge_scaler = pickle.load(open(_model2_path("scaler.pkl"), "rb"))
    ridge_encoders = pickle.load(open(_model2_path("encoders.pkl"), "rb"))
    RIDGE_MODEL_LOADED = True
    print("     -> Ridge model loaded successfully")
except Exception as e:
    print(f"  [WARN] Could not load Ridge model: {e}")
    ridge_model = None
    ridge_scaler = None
    ridge_encoders = None
    RIDGE_MODEL_LOADED = False


# ═══════════════════════════════════════════════════════════════
# 3. BUILD COSINE SIMILARITY MATRIX (for Recommendations)
# ═══════════════════════════════════════════════════════════════
print("  [+] Building recommendation similarity matrix...")
_rec_features_df = pd.get_dummies(catalog_df[["category", "subcategory"]])
_cosine_sim_matrix = cosine_similarity(_rec_features_df, _rec_features_df)
print(f"     -> Similarity matrix: {_cosine_sim_matrix.shape}")


# ═══════════════════════════════════════════════════════════════
# 4. TF-IDF SEARCH ENGINE (for brand / text search)
# ═══════════════════════════════════════════════════════════════
print("  [+] Building TF-IDF search index...")
_search_text = (
    catalog_df["product_name"].fillna("") + " " +
    catalog_df["brand"].fillna("") + " " +
    catalog_df["category"].fillna("") + " " +
    catalog_df["subcategory"].fillna("")
).str.lower()

_tfidf_vectorizer = TfidfVectorizer(stop_words="english")
_tfidf_matrix = _tfidf_vectorizer.fit_transform(_search_text)


# ═══════════════════════════════════════════════════════════════
# DAILY PRICE CACHE
# ═══════════════════════════════════════════════════════════════
_price_cache = {}
_price_cache_date = None


def _get_today():
    return date.today()


def _invalidate_if_new_day():
    global _price_cache, _price_cache_date
    today = _get_today()
    if _price_cache_date != today:
        _price_cache = {}
        _price_cache_date = today
        print(f"  [CACHE] Price cache cleared for new day: {today}")


# ═══════════════════════════════════════════════════════════════
# CATEGORY EMOJI MAPPING
# ═══════════════════════════════════════════════════════════════
CATEGORY_EMOJIS = {
    "Electronics": "📱",
    "Beauty & Health": "💄",
    "Home & Garden": "🏠",
    "Sports & Outdoors": "⚽",
    "Fashion": "👕",
    "Toys & Games": "🧸",
    "Books": "📚",
    "Automotive": "🚗",
    "Food & Beverages": "🍔",
    "Office Supplies": "📎",
    "Pet Supplies": "🐾",
}

def _get_category_emoji(category):
    if not category:
        return "📦"
    return CATEGORY_EMOJIS.get(category, "📦")


# ═══════════════════════════════════════════════════════════════
# FORMAT PRODUCT FOR FRONTEND
# ═══════════════════════════════════════════════════════════════

def format_product(product_dict):
    """Format a raw catalog row dict for the frontend."""
    sku = str(product_dict.get("sku_id", ""))
    cat = str(product_dict.get("category", "Other"))
    sub = str(product_dict.get("subcategory", "General"))
    brand = str(product_dict.get("brand", "Generic"))
    name = str(product_dict.get("product_name", f"{brand} {sub}"))
    img = str(product_dict.get("image_url", ""))

    base_price = round(float(product_dict.get("current_price_usd", product_dict.get("base_price_usd", 0))), 2)
    original_price = round(float(product_dict.get("base_price_usd", base_price)), 2)

    return {
        "product_id": sku,
        "name": name,
        "category": cat,
        "subcategory": sub,
        "brand": brand,
        "base_price": base_price,
        "original_price": original_price,
        "image": img or _get_category_emoji(cat),
        "image_url": img,
        "img_url": img,
        "description": f"{brand} {sub}",
        "stock": int(product_dict.get("inventory_count", 0)),
        "avg_rating": float(product_dict.get("avg_rating", 0)) if pd.notna(product_dict.get("avg_rating")) else 0,
        "review_count": int(product_dict.get("review_count", 0)),
        "popularity": int(product_dict.get("review_count", 0)),
    }


# ═══════════════════════════════════════════════════════════════
# PRODUCT CATALOG QUERIES
# ═══════════════════════════════════════════════════════════════

def get_top_products(n=20):
    """Return top N products sorted by review count (popularity proxy)."""
    temp = catalog_df.sort_values(by="review_count", ascending=False)
    temp = temp.drop_duplicates(subset=["sku_id"])
    return [format_product(row) for row in temp.head(n).to_dict(orient="records")]


def get_products_by_category(category, n=10):
    """Return top products in a specific category."""
    temp = catalog_df[catalog_df["category"] == category].copy()
    temp = temp.sort_values(by="review_count", ascending=False)
    return [format_product(row) for row in temp.head(n).to_dict(orient="records")]


def get_product_detail(product_id):
    """Get a single product's formatted data by sku_id."""
    product = PRODUCT_LOOKUP.get(str(product_id))
    if not product:
        return None
    return format_product(product)


# ═══════════════════════════════════════════════════════════════
# TRENDING (by review count + rating)
# ═══════════════════════════════════════════════════════════════

def get_trending(top_n=5):
    """Return top trending products by weighted score."""
    temp = catalog_df.copy()
    temp["trending_score"] = temp["review_count"] * temp["avg_rating"]
    temp = temp.sort_values(by="trending_score", ascending=False)
    temp = temp.drop_duplicates(subset=["sku_id"])
    results = temp.head(top_n).to_dict(orient="records")

    formatted = []
    for rank, item in enumerate(results, 1):
        prod = format_product(item)
        prod["trending_rank"] = f"#{rank}"
        prod["view_count"] = int(item.get("review_count", 0))
        formatted.append(prod)
    return formatted


# ═══════════════════════════════════════════════════════════════
# CATEGORY-BASED RECOMMENDATIONS (Cosine Similarity)
# ═══════════════════════════════════════════════════════════════

def recommend_similar_products(product_id, top_n=5):
    """Recommend products similar to the given product using cosine similarity."""
    sku = str(product_id)
    try:
        idx_matches = catalog_df.index[catalog_df["sku_id"] == sku].tolist()
        if not idx_matches:
            return []
        idx = idx_matches[0]
        sim_scores = list(enumerate(_cosine_sim_matrix[idx]))
        sim_scores = sorted(sim_scores, key=lambda x: x[1], reverse=True)
        # Skip first (itself)
        sim_indices = [i[0] for i in sim_scores[1:top_n + 1]]
        return [format_product(catalog_df.iloc[i].to_dict()) for i in sim_indices]
    except Exception:
        return []


def recommend_by_category(category, top_n=5):
    """Return top products in a category."""
    return get_products_by_category(category, n=top_n)


# ═══════════════════════════════════════════════════════════════
# BRAND / TEXT SEARCH RECOMMENDATIONS (TF-IDF)
# ═══════════════════════════════════════════════════════════════

def recommend_by_brand(query: str, top_n=10):
    """
    1. Identify the product from the query using TF-IDF + Cosine Similarity.
    2. Extract its brand.
    3. Return ALL products belonging to the SAME brand.
    """
    query_vec = _tfidf_vectorizer.transform([query.lower()])
    scores = cosine_similarity(query_vec, _tfidf_matrix).flatten()

    best_idx = int(np.argmax(scores))
    best_score = float(scores[best_idx])

    if best_score < 0.05:
        return {
            "query": query,
            "detected_product": None,
            "brand": None,
            "recommendations": [],
            "explanation": "No matching product or brand found for your search."
        }

    matched_row = catalog_df.iloc[best_idx]
    detected_brand = str(matched_row["brand"])
    detected_product_name = str(matched_row["product_name"])

    brand_products = catalog_df[
        catalog_df["brand"].str.lower() == detected_brand.lower()
    ].copy()
    brand_products = brand_products.sort_values(by="review_count", ascending=False)
    brand_products = brand_products.drop_duplicates(subset=["sku_id"])

    recs = [format_product(row) for row in brand_products.head(top_n).to_dict(orient="records")]

    return {
        "query": query,
        "detected_product": detected_product_name,
        "brand": detected_brand,
        "recommendations": recs,
        "explanation": f"Showing top products from {detected_brand}"
    }


# ═══════════════════════════════════════════════════════════════
# PRICE PREDICTION (Ridge Model)
# ═══════════════════════════════════════════════════════════════

def _predict_price(product_dict):
    """Use the Ridge model to predict a price for a product."""
    if not RIDGE_MODEL_LOADED:
        return float(product_dict.get("current_price_usd", product_dict.get("base_price_usd", 0)))

    try:
        # Feature engineering matching cat_recommand_model.py
        launch_date = pd.to_datetime(product_dict.get("launch_date"), format="mixed", dayfirst=True, errors="coerce")
        launch_year = launch_date.year if pd.notna(launch_date) else 0

        try:
            tags_count = len(ast.literal_eval(product_dict["tags"])) if isinstance(product_dict.get("tags"), str) else 0
        except Exception:
            tags_count = 0

        cat_encoded = ridge_encoders["category"].transform([str(product_dict.get("category", "Unknown"))])[0]
        sub_encoded = ridge_encoders["subcategory"].transform([str(product_dict.get("subcategory", "Unknown"))])[0]
        brand_encoded = ridge_encoders["brand"].transform([str(product_dict.get("brand", "Unknown"))])[0]

        is_active = 1 if product_dict.get("is_active") in [True, "TRUE", "True", 1] else 0
        base_price = float(product_dict.get("base_price_usd", 0))
        cost_price = float(product_dict.get("cost_price_usd", 0))
        inventory = int(product_dict.get("inventory_count", 0))
        rating = float(product_dict.get("avg_rating", 0))
        reviews = int(product_dict.get("review_count", 0))
        weight = float(product_dict.get("weight_kg", 0))

        features = np.array([[
            cat_encoded, sub_encoded, brand_encoded,
            cost_price, inventory,
            rating, reviews, weight,
            is_active,
            launch_year, tags_count,
            base_price - cost_price,          # price_margin
            inventory * cost_price,            # inventory_value
            rating * reviews                   # rating_weighted
        ]])

        scaled = ridge_scaler.transform(features)
        predicted = ridge_model.predict(scaled)[0]
        return max(0.01, round(float(predicted), 2))

    except Exception as e:
        print(f"  [WARN] Price prediction failed for {product_dict.get('sku_id')}: {e}")
        return float(product_dict.get("current_price_usd", product_dict.get("base_price_usd", 0)))


# ═══════════════════════════════════════════════════════════════
# DYNAMIC PRICING
# ═══════════════════════════════════════════════════════════════

def get_dynamic_price(product_id, user_id=None):
    """
    Calculate dynamic price using the trained Ridge model + rule-based adjustments.
    Prices are cached per (product_id, user_segment) and refresh daily.
    """
    _invalidate_if_new_day()

    sku = str(product_id)
    user_segment = "anonymous"
    cache_key = (sku, user_segment)

    if cache_key in _price_cache:
        return _price_cache[cache_key]

    product = PRODUCT_LOOKUP.get(sku)
    if not product:
        return None

    base_price = float(product.get("base_price_usd", 0))
    current_price = float(product.get("current_price_usd", base_price))
    inventory = int(product.get("inventory_count", 0))
    rating = float(product.get("avg_rating", 0))
    reviews = int(product.get("review_count", 0))

    adjustments = []

    # ── ML Prediction ──
    ml_predicted_price = _predict_price(product)
    ml_factor = ml_predicted_price / current_price if current_price > 0 else 1.0
    ml_factor = max(0.7, min(ml_factor, 1.5))
    final_price = current_price * ml_factor

    adjustments.append({
        "factor": "ML Price Model",
        "description": f"Ridge Regression prediction (factor: {ml_factor:.3f})",
        "impact": f"{'+' if ml_factor >= 1 else ''}{round((ml_factor - 1) * 100, 1)}%",
        "icon": "🤖"
    })

    # ── Inventory-based adjustment ──
    if inventory < 20:
        adj = 1.08
        final_price *= adj
        adjustments.append({
            "factor": "Low Stock Premium",
            "description": f"Only {inventory} units left — scarcity pricing applied",
            "impact": "+8%",
            "icon": "📉"
        })
    elif inventory > 500:
        adj = 0.95
        final_price *= adj
        adjustments.append({
            "factor": "Overstock Discount",
            "description": f"{inventory} units in stock — clearance discount applied",
            "impact": "-5%",
            "icon": "📦"
        })

    # ── Rating-based adjustment ──
    if rating >= 4.5 and reviews > 100:
        adj = 1.05
        final_price *= adj
        adjustments.append({
            "factor": "Premium Rating",
            "description": f"Rated {rating}★ with {reviews} reviews — high confidence pricing",
            "impact": "+5%",
            "icon": "⭐"
        })
    elif rating < 2.5 and reviews > 20:
        adj = 0.92
        final_price *= adj
        adjustments.append({
            "factor": "Rating Discount",
            "description": f"Rated {rating}★ — promotional discount to boost sales",
            "impact": "-8%",
            "icon": "📊"
        })

    # ── Safety floor — never below 70% of base ──
    final_price = max(final_price, base_price * 0.70)
    final_price = round(final_price, 2)

    total_savings = round(current_price - final_price, 2)
    savings_pct = round((total_savings / current_price) * 100, 1) if current_price > 0 else 0

    if savings_pct > 0:
        explanation = (
            f"Price reduced by {savings_pct}% — ML model + {len(adjustments)} pricing factors "
            f"analyzed for today ({_price_cache_date})"
        )
    elif savings_pct < 0:
        explanation = (
            f"Price increased by {abs(savings_pct)}% — strong demand and premium signals "
            f"detected for today ({_price_cache_date})"
        )
    else:
        explanation = f"Base price maintained — balanced supply and demand for today ({_price_cache_date})"

    result = {
        "product_id": sku,
        "base_price": round(current_price, 2),
        "final_price": final_price,
        "total_savings": total_savings,
        "savings_percent": savings_pct,
        "explanation": explanation,
        "adjustments": adjustments,
        "user_segment": user_segment,
        "demand_stats": {
            "inventory": inventory,
            "avg_rating": rating,
            "review_count": reviews,
        },
        "ml_factor": round(ml_factor, 4),
        "cache_date": str(_price_cache_date)
    }

    _price_cache[cache_key] = result
    return result


print("  [OK] All models loaded successfully!")
print(f"     -> {len(PRODUCT_LOOKUP)} products in catalog")
print(f"     -> {len(ALL_CATEGORIES)} categories")
print(f"     -> Ridge model: {'LOADED' if RIDGE_MODEL_LOADED else 'FALLBACK MODE'}")