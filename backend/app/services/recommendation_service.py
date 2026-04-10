"""
Recommendation & Pricing Service
Loads all three trained ML models and provides real predictions.
- Category Recommendation Model (Polynomial Regression)
- Product Recommendation Model (Apriori / Association Rules)
- Dynamic Pricing Model (GradientBoosting Regressor)

Pricing is cached daily — recalculates only once per calendar day.
"""

import joblib
import numpy as np
import pandas as pd
import os
import random
from datetime import datetime, date
from collections import Counter
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
# ═══════════════════════════════════════════════════════════════
# PATH SETUP
# ═══════════════════════════════════════════════════════════════
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

def _data_path(filename):
    return os.path.join(DATA_DIR, filename)


# ═══════════════════════════════════════════════════════════════
# 1. LOAD CATEGORY RECOMMENDATION DATA
# ═══════════════════════════════════════════════════════════════
print("  📂 Loading category recommendation data...")
cat_data = pd.read_csv(_data_path("catrecommandprocessed_data.csv"))
cat_model = joblib.load(_data_path("catrecommandmodel.pkl"))

# Build product lookup by product_id (int)
cat_data['product_id'] = cat_data['product_id'].astype(int)
PRODUCT_LOOKUP = {}
for _, row in cat_data.iterrows():
    PRODUCT_LOOKUP[int(row['product_id'])] = row.to_dict()

# Get unique categories and brands
ALL_CATEGORIES = sorted(cat_data['category_code'].dropna().unique().tolist())
ALL_BRANDS = sorted(cat_data['brand'].dropna().unique().tolist())


# ═══════════════════════════════════════════════════════════════
# 2. LOAD APRIORI ASSOCIATION RULES (Product Recommendations)
# ═══════════════════════════════════════════════════════════════
print("  🔗 Loading association rules...")
apriori_rules_df = pd.read_csv(_data_path("apriori_rules.csv"))
apriori_rules_df['antecedents'] = apriori_rules_df['antecedents'].astype(int)
apriori_rules_df['consequents'] = apriori_rules_df['consequents'].astype(int)

# Build dict: product_id -> [(recommended_id, confidence, lift), ...]
ASSOCIATION_MAP = {}
for _, row in apriori_rules_df.iterrows():
    ant = int(row['antecedents'])
    con = int(row['consequents'])
    conf = float(row['confidence'])
    lift = float(row['lift'])
    if ant not in ASSOCIATION_MAP:
        ASSOCIATION_MAP[ant] = []
    ASSOCIATION_MAP[ant].append((con, conf, lift))

# Sort by confidence descending
for key in ASSOCIATION_MAP:
    ASSOCIATION_MAP[key] = sorted(ASSOCIATION_MAP[key], key=lambda x: x[1], reverse=True)


# ═══════════════════════════════════════════════════════════════
# 3. LOAD DYNAMIC PRICING MODEL
# ═══════════════════════════════════════════════════════════════
print("  💰 Loading dynamic pricing model...")
pricing_model = joblib.load(_data_path("model.pkl"))
pricing_scaler = joblib.load(_data_path("scaler.pkl"))
pricing_features = joblib.load(_data_path("features.pkl"))
pricing_data = pd.read_csv(_data_path("pricing_data.csv"))
pricing_data['product_id'] = pricing_data['product_id'].astype(int)

# Build pricing lookup
PRICING_LOOKUP = {}
for _, row in pricing_data.iterrows():
    PRICING_LOOKUP[int(row['product_id'])] = row.to_dict()


# ═══════════════════════════════════════════════════════════════
# 4. LOAD RAW EVENTS (for user classification)
# ═══════════════════════════════════════════════════════════════
print("  📊 Loading raw events data...")
raw_events_df = pd.read_csv(_data_path("Dataset.csv"))
raw_events_df['product_id'] = raw_events_df['product_id'].astype(int)
raw_events_df['user_id'] = raw_events_df['user_id'].astype(int)


# ═══════════════════════════════════════════════════════════════
# DAILY PRICE CACHE
# ═══════════════════════════════════════════════════════════════
_price_cache = {}       # key: (product_id, user_segment) -> cached result
_price_cache_date = None  # date when cache was last populated


def _get_today():
    """Return today's date for cache invalidation."""
    return date.today()


def _invalidate_if_new_day():
    """Clear the price cache if a new day has started."""
    global _price_cache, _price_cache_date
    today = _get_today()
    if _price_cache_date != today:
        _price_cache = {}
        _price_cache_date = today
        print(f"  🔄 Price cache cleared for new day: {today}")


# ═══════════════════════════════════════════════════════════════
# USER CLASSIFICATION
# ═══════════════════════════════════════════════════════════════

def classify_user(user_id):
    """Classify a user based on their purchase history in the dataset."""
    user_data = raw_events_df[raw_events_df['user_id'] == user_id]

    if user_data.empty:
        return "new_user"

    user_purchases = user_data[user_data['event_type'] == 'purchase']

    if user_purchases.empty:
        return "browser"   # views but never buys

    total_spent = user_purchases['price'].sum()
    order_count = len(user_purchases)
    aov = total_spent / order_count

    if aov >= 200:
        return "premium"
    elif aov >= 50:
        return "regular"
    else:
        return "low_spender"


# ═══════════════════════════════════════════════════════════════
# CATEGORY-BASED RECOMMENDATIONS (Model 1)
# ═══════════════════════════════════════════════════════════════

def recommend_by_category(category, top_n=5):
    """Return top products in a category sorted by ML final_score."""
    temp = cat_data[cat_data['category_code'] == category].copy()
    temp = temp.sort_values(by='final_score', ascending=False)
    return temp.head(top_n).to_dict(orient='records')


def recommend_similar_products(product_id, top_n=5):
    """Recommend products in the same category as the given product."""
    product = PRODUCT_LOOKUP.get(int(product_id))
    if not product:
        return []

    category = product['category_code']
    temp = cat_data[
        (cat_data['category_code'] == category) &
        (cat_data['product_id'] != int(product_id))
    ].copy()
    temp = temp.sort_values(by='final_score', ascending=False)
    return temp.head(top_n).to_dict(orient='records')


# ═══════════════════════════════════════════════════════════════
# PRODUCT-BASED RECOMMENDATIONS (Model 2 — Apriori)
# ═══════════════════════════════════════════════════════════════

def recommend_by_association(product_id, top_n=5):
    """Recommend products using trained association rules (frequently bought together)."""
    pid = int(product_id)
    rules = ASSOCIATION_MAP.get(pid, [])

    results = []
    for rec_id, confidence, lift in rules[:top_n]:
        product_info = PRODUCT_LOOKUP.get(rec_id)
        if product_info:
            results.append({
                **product_info,
                "confidence": round(confidence, 3),
                "lift": round(lift, 2)
            })
    return results


# ═══════════════════════════════════════════════════════════════
# BRAND-BASED RECOMMENDATIONS (Model 4 — TF-IDF text search)
# ═══════════════════════════════════════════════════════════════

_tfidf_vectorizer = None
_tfidf_matrix = None
_brand_product_lookup = None

def _init_brand_model():
    global _tfidf_vectorizer, _tfidf_matrix, _brand_product_lookup
    print("  🏷️ Initializing brand recommendation TF-IDF model...")
    # Drop duplicates to avoid bias
    df = cat_data.drop_duplicates(subset=['product_id']).copy()
    
    # Create the search text by simulating 'name', 'brand', and 'category'
    df['brand_lower'] = df['brand'].fillna('generic').str.lower()
    df['cat_lower'] = df['category_code'].fillna('unknown').str.replace('.', ' ').str.lower()
    df['name_lower'] = df['brand_lower'] + ' ' + df['cat_lower'].apply(lambda x: x.split()[-1] if isinstance(x, str) else '')
    
    df['text'] = df['name_lower'] + ' ' + df['brand_lower'] + ' ' + df['cat_lower']
    
    _brand_product_lookup = df[['product_id', 'brand_lower', 'name_lower', 'text']].copy()
    
    _tfidf_vectorizer = TfidfVectorizer(stop_words='english')
    _tfidf_matrix = _tfidf_vectorizer.fit_transform(_brand_product_lookup['text'])


def recommend_by_brand(query: str, top_n=10):
    """
    1. Identify the product from the query using TF-IDF + Cosine Similarity.
    2. Extract its brand.
    3. Return ALL products belonging to the SAME brand.
    """
    global _tfidf_vectorizer, _tfidf_matrix
    if _tfidf_vectorizer is None or _tfidf_matrix is None:
        _init_brand_model()
        
    query_vec = _tfidf_vectorizer.transform([query.lower()])
    cosine_sim = cosine_similarity(query_vec, _tfidf_matrix).flatten()
    
    best_idx = int(np.argmax(cosine_sim))
    best_score = float(cosine_sim[best_idx])
    
    if best_score < 0.1:
        return {
            "query": query,
            "detected_product": None,
            "brand": None,
            "recommendations": [],
            "explanation": "No matching product or brand found for the phrase."
        }
        
    matched_row = _brand_product_lookup.iloc[best_idx]
    detected_brand = matched_row['brand_lower']
    detected_product_name = matched_row['name_lower'].title()
    
    # Filter products from cat_data matching the detected brand
    brand_products = cat_data[cat_data['brand'].fillna('').str.lower() == detected_brand].copy()
    
    # Sort by final_score (if available and relevant, otherwise popularity)
    brand_products = brand_products.sort_values(by='final_score', ascending=False)
    brand_products = brand_products.drop_duplicates(subset=['product_id'])
    
    recs = [format_product(row) for row in brand_products.head(top_n).to_dict(orient='records')]
    
    brand_display = detected_brand.title() if detected_brand != 'generic' else 'Generic'
    
    return {
        "query": query,
        "detected_product": detected_product_name,
        "brand": brand_display,
        "recommendations": recs,
        "explanation": f"Showing top products from {brand_display}"
    }


# ═══════════════════════════════════════════════════════════════
# TRENDING (from real data)
# ═══════════════════════════════════════════════════════════════

def get_trending(top_n=5):
    """Return top trending products by ML popularity score."""
    temp = cat_data.sort_values(by='popularity', ascending=False)
    temp = temp.drop_duplicates(subset=['product_id'])
    results = temp.head(top_n).to_dict(orient='records')

    for rank, item in enumerate(results, 1):
        item['trending_rank'] = f"#{rank}"
        item['view_count'] = int(item.get('interaction_count', 0))
    return results


# ═══════════════════════════════════════════════════════════════
# DYNAMIC PRICING (Model 3 — GradientBoosting + daily cache)
# ═══════════════════════════════════════════════════════════════

def get_dynamic_price(product_id, user_id=None):
    """
    Calculate dynamic price using the trained ML model.
    Prices are cached per (product_id, user_segment) and refresh daily.

    Returns: dict with full pricing breakdown
    """
    _invalidate_if_new_day()

    pid = int(product_id)
    uid = int(user_id) if user_id is not None else None

    # Determine user segment
    user_segment = classify_user(uid) if uid else "anonymous"
    cache_key = (pid, user_segment)

    # Check cache
    if cache_key in _price_cache:
        return _price_cache[cache_key]

    # ── Product lookup ──
    pricing_row = PRICING_LOOKUP.get(pid)
    if not pricing_row:
        return None

    base_price = float(pricing_row['price'])
    demand = int(pricing_row.get('demand', 0))
    views = int(pricing_row.get('views', 0))
    purchases = int(pricing_row.get('purchases', 0))
    cart_adds = int(pricing_row.get('cart', 0))
    conversion = float(pricing_row.get('conversion_rate', 0))

    adjustments = []

    # ── ML Prediction (core price factor) ──
    try:
        input_data = np.array([[pricing_row[f] for f in pricing_features]])
        input_scaled = pricing_scaler.transform(input_data)
        ml_factor = float(np.expm1(pricing_model.predict(input_scaled))[0])
        ml_factor = max(0.7, min(ml_factor, 1.5))  # safety clamp
        ml_price = base_price * ml_factor
    except Exception:
        ml_factor = 1.0
        ml_price = base_price

    adjustments.append({
        "factor": "ML Price Model",
        "description": f"GradientBoosting model prediction (factor: {ml_factor:.3f})",
        "impact": f"{'+' if ml_factor >= 1 else ''}{round((ml_factor - 1) * 100, 1)}%",
        "icon": "🤖"
    })

    final_price = ml_price

    # ── Demand-based adjustment ──
    if demand > 100:
        adj = 1.10
        final_price *= adj
        adjustments.append({
            "factor": "Very High Demand",
            "description": f"{demand} total interactions ({views} views, {purchases} purchases, {cart_adds} cart adds)",
            "impact": "+10%",
            "icon": "📈"
        })
    elif demand > 50:
        adj = 1.05
        final_price *= adj
        adjustments.append({
            "factor": "High Demand",
            "description": f"{demand} interactions — moderate surge pricing",
            "impact": "+5%",
            "icon": "📊"
        })
    elif demand < 10:
        adj = 0.90
        final_price *= adj
        adjustments.append({
            "factor": "Low Demand",
            "description": f"Only {demand} interactions — promotional discount applied",
            "impact": "-10%",
            "icon": "📉"
        })

    # ── Conversion-rate based ──
    if conversion > 0.15:
        adj = 1.06
        final_price *= adj
        adjustments.append({
            "factor": "High Conversion",
            "description": f"Conversion rate {conversion:.1%} — strong purchase intent detected",
            "impact": "+6%",
            "icon": "🎯"
        })

    # ── User segment personalization ──
    if user_segment == "premium":
        adj = 0.90
        final_price *= adj
        adjustments.append({
            "factor": "Premium Member",
            "description": "Exclusive 10% loyalty discount for high-value customers",
            "impact": "-10%",
            "icon": "👑"
        })
    elif user_segment == "new_user":
        adj = 0.93
        final_price *= adj
        adjustments.append({
            "factor": "Welcome Offer",
            "description": "7% welcome discount to encourage first purchase",
            "impact": "-7%",
            "icon": "🎉"
        })
    elif user_segment == "browser":
        adj = 0.95
        final_price *= adj
        adjustments.append({
            "factor": "Engagement Boost",
            "description": "5% discount to convert browsing into a purchase",
            "impact": "-5%",
            "icon": "👀"
        })
    elif user_segment == "low_spender":
        adj = 0.95
        final_price *= adj
        adjustments.append({
            "factor": "Budget Friendly",
            "description": "5% discount tailored for value-conscious shoppers",
            "impact": "-5%",
            "icon": "💚"
        })

    # ── Safety floor — never below 70% of base ──
    final_price = max(final_price, base_price * 0.70)
    final_price = round(final_price, 2)

    total_savings = round(base_price - final_price, 2)
    savings_pct = round((total_savings / base_price) * 100, 1) if base_price > 0 else 0

    if savings_pct > 0:
        explanation = (
            f"Price reduced by {savings_pct}% — ML model + {len(adjustments)} pricing factors "
            f"analyzed for today ({_price_cache_date})"
        )
    elif savings_pct < 0:
        explanation = (
            f"Price increased by {abs(savings_pct)}% — high demand and strong conversion signals "
            f"detected for today ({_price_cache_date})"
        )
    else:
        explanation = f"Base price maintained — balanced supply and demand for today ({_price_cache_date})"

    result = {
        "product_id": pid,
        "base_price": round(base_price, 2),
        "final_price": final_price,
        "total_savings": total_savings,
        "savings_percent": savings_pct,
        "explanation": explanation,
        "adjustments": adjustments,
        "user_segment": user_segment,
        "demand_stats": {
            "views": views,
            "purchases": purchases,
            "cart_adds": cart_adds,
            "total_demand": demand,
            "conversion_rate": round(conversion, 4)
        },
        "ml_factor": round(ml_factor, 4),
        "cache_date": str(_price_cache_date)
    }

    # Cache the result
    _price_cache[cache_key] = result
    return result


# ═══════════════════════════════════════════════════════════════
# PRODUCT CATALOG HELPERS
# ═══════════════════════════════════════════════════════════════

# Emoji mapping for categories
CATEGORY_EMOJIS = {
    "electronics.smartphone": "📱",
    "electronics.tablet": "📲",
    "electronics.audio": "🎧",
    "electronics.video.tv": "📺",
    "electronics.camera": "📷",
    "electronics.camera.video": "📹",
    "electronics.audio.microphone": "🎤",
    "computers.notebook": "💻",
    "computers.desktop": "🖥️",
    "computers.peripherals": "⌨️",
    "computers.peripherals.printer": "🖨️",
    "computers.peripherals.monitor": "🖥️",
    "appliances.kitchen": "🍳",
    "appliances.kitchen.hood": "🏠",
    "appliances.kitchen.refrigerator": "🧊",
    "appliances.kitchen.washer": "🧺",
    "appliances.environment": "🌡️",
    "appliances.personal": "💇",
    "furniture.living_room": "🛋️",
    "furniture.bedroom": "🛏️",
    "furniture.bathroom": "🚿",
    "accessories.bag": "👜",
    "accessories.umbrella": "☂️",
    "apparel": "👕",
    "sport": "⚽",
    "kids": "🧸",
    "country_yard": "🏡",
    "medicine": "💊",
    "stationery": "📝",
    "construction": "🔨",
    "auto": "🚗",
}

def _get_category_emoji(category_code):
    """Get emoji for a category, checking prefix matches."""
    if not category_code or category_code == 'unknown':
        return "📦"
    for prefix, emoji in CATEGORY_EMOJIS.items():
        if category_code.startswith(prefix):
            return emoji
    return "📦"


def _format_category_name(category_code):
    """Make a category code human-readable."""
    if not category_code or category_code == 'unknown':
        return "Other"
    parts = category_code.split('.')
    return ' › '.join(p.replace('_', ' ').title() for p in parts)


def format_product(product_dict):
    """Format a raw product dict for the frontend."""
    pid = int(product_dict['product_id'])
    cat = str(product_dict.get('category_code', 'unknown'))
    return {
        "product_id": str(pid),
        "name": f"{product_dict.get('brand', 'Generic').title()} {_format_category_name(cat).split(' › ')[-1]}",
        "category": _format_category_name(cat),
        "category_code": cat,
        "brand": str(product_dict.get('brand', 'generic')).title(),
        "base_price": round(float(product_dict.get('price', 0)), 2),
        "image": _get_category_emoji(cat),
        "description": f"Score: {product_dict.get('final_score', 0):.0f} | "
                       f"Popularity: {product_dict.get('popularity', 0)} | "
                       f"Brand: {str(product_dict.get('brand', 'generic')).title()}",
        "stock": max(5, 200 - int(product_dict.get('popularity', 0))),
        "popularity": int(product_dict.get('popularity', 0)),
        "final_score": round(float(product_dict.get('final_score', 0)), 2),
    }


def get_top_products(n=20):
    """Return the top N products by final_score for the catalog page."""
    temp = cat_data.sort_values(by='final_score', ascending=False)
    temp = temp.drop_duplicates(subset=['product_id'])
    return [format_product(row) for row in temp.head(n).to_dict(orient='records')]


def get_products_by_category(category_code, n=10):
    """Return top products in a specific category."""
    temp = cat_data[cat_data['category_code'] == category_code].copy()
    temp = temp.sort_values(by='final_score', ascending=False)
    return [format_product(row) for row in temp.head(n).to_dict(orient='records')]


def get_product_detail(product_id):
    """Get a single product's formatted data."""
    product = PRODUCT_LOOKUP.get(int(product_id))
    if not product:
        return None
    return format_product(product)


print("  ✅ All models loaded successfully!")
print(f"     📂 {len(cat_data)} products in recommendation data")
print(f"     🔗 {len(ASSOCIATION_MAP)} products have association rules")
print(f"     💰 {len(PRICING_LOOKUP)} products in pricing model")
print(f"     📊 {len(ALL_CATEGORIES)} unique categories")