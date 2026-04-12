"""
Data Store — in-memory collections + Redis feature store
=========================================================
In-memory section  : your existing PRODUCTS, USERS, EVENTS,
                     SESSIONS, COMPETITOR_PRICES (unchanged)
Redis section      : session features, user affinity, price
                     cache — written by stream_worker, read
                     by the Pricing and Recommendation APIs
"""

import json
import random
from datetime import datetime, timedelta
from app.db import get_redis

# ═══════════════════════════════════════════════════════════════
# 📦 PRODUCTS COLLECTION (your existing data — unchanged)
# ═══════════════════════════════════════════════════════════════

PRODUCTS = [
    # Electronics
    {"product_id": "P001", "name": "Wireless Noise-Cancelling Headphones", "category": "Electronics", "base_price": 149.99, "image": "🎧", "description": "Premium ANC headphones with 30hr battery", "stock": 45},
    {"product_id": "P002", "name": "Smart Fitness Watch Pro",               "category": "Electronics", "base_price": 199.99, "image": "⌚", "description": "GPS + heart rate + sleep tracking",         "stock": 30},
    {"product_id": "P003", "name": "Portable Bluetooth Speaker",            "category": "Electronics", "base_price": 79.99,  "image": "🔊", "description": "Waterproof 360° sound speaker",             "stock": 60},
    {"product_id": "P004", "name": "USB-C Fast Charger 65W",                "category": "Electronics", "base_price": 39.99,  "image": "🔌", "description": "GaN charger with 3 ports",                  "stock": 100},

    # Fashion
    {"product_id": "P005", "name": "Premium Leather Jacket",     "category": "Fashion", "base_price": 249.99, "image": "🧥", "description": "Genuine leather, slim fit design",         "stock": 20},
    {"product_id": "P006", "name": "Running Shoes Ultra Boost",  "category": "Fashion", "base_price": 129.99, "image": "👟", "description": "Lightweight with responsive cushioning",   "stock": 50},
    {"product_id": "P007", "name": "Classic Aviator Sunglasses", "category": "Fashion", "base_price": 89.99,  "image": "🕶️", "description": "UV400 polarized lenses",                  "stock": 75},
    {"product_id": "P008", "name": "Canvas Backpack Travel",     "category": "Fashion", "base_price": 59.99,  "image": "🎒", "description": "Water-resistant with laptop sleeve",       "stock": 40},

    # Home & Kitchen
    {"product_id": "P009", "name": "Smart Air Purifier",          "category": "Home & Kitchen", "base_price": 179.99, "image": "🌬️", "description": "HEPA filter with air quality sensor",    "stock": 25},
    {"product_id": "P010", "name": "Automatic Espresso Machine",  "category": "Home & Kitchen", "base_price": 299.99, "image": "☕",  "description": "15-bar pump with milk frother",         "stock": 15},
    {"product_id": "P011", "name": "Robot Vacuum Cleaner",        "category": "Home & Kitchen", "base_price": 349.99, "image": "🤖", "description": "LiDAR navigation + mop function",      "stock": 20},
    {"product_id": "P012", "name": "Smart LED Strip Lights 10m",  "category": "Home & Kitchen", "base_price": 29.99,  "image": "💡", "description": "RGB + warm white, app controlled",     "stock": 120},

    # Books & Learning
    {"product_id": "P013", "name": "Machine Learning Handbook",      "category": "Books", "base_price": 49.99, "image": "📘", "description": "Comprehensive guide to ML algorithms",  "stock": 80},
    {"product_id": "P014", "name": "Python Data Science Cookbook",   "category": "Books", "base_price": 39.99, "image": "📗", "description": "Hands-on recipes for data analysis",    "stock": 90},
    {"product_id": "P015", "name": "System Design Interview Guide",  "category": "Books", "base_price": 44.99, "image": "📙", "description": "Master large-scale system design",      "stock": 70},
    {"product_id": "P016", "name": "Clean Code: A Handbook",         "category": "Books", "base_price": 34.99, "image": "📕", "description": "Writing maintainable software",         "stock": 85},

    # Sports & Outdoors
    {"product_id": "P017", "name": "Yoga Mat Premium 6mm",          "category": "Sports", "base_price": 34.99,  "image": "🧘", "description": "Non-slip, eco-friendly material",        "stock": 60},
    {"product_id": "P018", "name": "Adjustable Dumbbell Set 20kg",  "category": "Sports", "base_price": 89.99,  "image": "🏋️", "description": "Quick-change weight system",            "stock": 35},
    {"product_id": "P019", "name": "Camping Tent 4-Person",         "category": "Sports", "base_price": 159.99, "image": "⛺", "description": "Waterproof, easy 2-minute setup",       "stock": 25},
    {"product_id": "P020", "name": "Insulated Water Bottle 1L",     "category": "Sports", "base_price": 24.99,  "image": "🥤", "description": "Keeps cold 24hrs, hot 12hrs",           "stock": 150},
]

PRODUCT_MAP = {p["product_id"]: p for p in PRODUCTS}

# ═══════════════════════════════════════════════════════════════
# 👤 USERS COLLECTION (your existing data — unchanged)
# ═══════════════════════════════════════════════════════════════

USERS = {
    "U001": {"user_id": "U001", "name": "Alex Premium",  "user_type": "premium",     "total_spent": 5200.00, "avatar": "👨‍💼"},
    "U002": {"user_id": "U002", "name": "Sam Regular",   "user_type": "regular",     "total_spent": 1500.00, "avatar": "👩‍💻"},
    "U003": {"user_id": "U003", "name": "Jordan Budget", "user_type": "low_spender", "total_spent": 320.00,  "avatar": "🧑‍🎓"},
    "U004": {"user_id": "U004", "name": "Taylor New",    "user_type": "new_user",    "total_spent": 0.00,    "avatar": "👤"},
}

# ═══════════════════════════════════════════════════════════════
# 📊 EVENTS STORE (your existing data — unchanged)
# ═══════════════════════════════════════════════════════════════

EVENTS = []

def _seed_events():
    event_types = ["view", "click", "add_to_cart"]
    user_ids    = list(USERS.keys())

    popularity_weights = {
        "P001": 55, "P002": 70, "P003": 30, "P006": 65,
        "P010": 45, "P011": 80, "P013": 40, "P017": 35,
        "P005": 25, "P009": 20, "P019": 50, "P020": 15,
        "P004": 10, "P007": 12, "P008": 18, "P012": 22,
        "P014": 8,  "P015": 14, "P016": 6,  "P018": 28,
    }

    for product_id, count in popularity_weights.items():
        for _ in range(count):
            EVENTS.append({
                "event_id"   : f"E{len(EVENTS)+1:05d}",
                "user_id"    : random.choice(user_ids),
                "product_id" : product_id,
                "event_type" : random.choice(event_types),
                "timestamp"  : (datetime.now() - timedelta(hours=random.randint(1, 72))).isoformat(),
            })

_seed_events()

# ═══════════════════════════════════════════════════════════════
# 🔐 SESSIONS STORE (your existing data — unchanged)
# ═══════════════════════════════════════════════════════════════

SESSIONS = {
    "U001": {"user_id": "U001", "products_viewed": ["P001", "P002", "P010"], "last_active": datetime.now().isoformat()},
    "U002": {"user_id": "U002", "products_viewed": ["P006", "P013", "P017"], "last_active": datetime.now().isoformat()},
    "U003": {"user_id": "U003", "products_viewed": ["P012", "P020"],         "last_active": datetime.now().isoformat()},
    "U004": {"user_id": "U004", "products_viewed": [],                       "last_active": datetime.now().isoformat()},
}

# ═══════════════════════════════════════════════════════════════
# 💰 COMPETITOR PRICES (your existing data — unchanged)
# ═══════════════════════════════════════════════════════════════

COMPETITOR_PRICES = {}
for p in PRODUCTS:
    variation = random.uniform(0.85, 1.15)
    COMPETITOR_PRICES[p["product_id"]] = round(p["base_price"] * variation, 2)


# ═══════════════════════════════════════════════════════════════
# ⚡ REDIS FEATURE STORE (new — read/write ML features)
#
# Key schema
#   session:{session_id}:features  HASH  TTL 30 min
#   user:{user_id}:affinity        HASH  TTL 24 hrs
#   price:{product_id}:{user_id}   STR   TTL 60 sec
#   competitor:{product_id}        HASH  TTL 6 hrs
# ═══════════════════════════════════════════════════════════════

TTL_SESSION   = 30 * 60
TTL_AFFINITY  = 24 * 60 * 60
TTL_PRICE     = 60
TTL_COMPETITOR = 6 * 60 * 60

# ── Session features ──────────────────────────────────────────
# Written by: stream_worker  |  Read by: Pricing API, Intent model

def set_session_features(session_id: str, features: dict):
    """
    features dict keys:
        engagement_score   float  0-1
        intent_probability float  0-1
        wtp_estimate       float  rupees / dollars
        category_affinity  list   [(category, score), ...]
        session_length     int
        last_event_type    str    page_view|search|cart|purchase
        last_product_id    str
    """
    r = get_redis()
    flat = {
        k: json.dumps(v) if isinstance(v, (list, dict)) else str(v)
        for k, v in features.items()
    }
    r.hset(f"session:{session_id}:features", mapping=flat)
    r.expire(f"session:{session_id}:features", TTL_SESSION)


def get_session_features(session_id: str) -> dict | None:
    raw = get_redis().hgetall(f"session:{session_id}:features")
    if not raw:
        return None
    result = {}
    for k, v in raw.items():
        try:
            result[k] = json.loads(v)
        except (json.JSONDecodeError, ValueError):
            result[k] = v
    return result


def update_session_feature(session_id: str, field: str, value):
    """Update a single field without rewriting the whole hash."""
    r = get_redis()
    key = f"session:{session_id}:features"
    r.hset(key, field, json.dumps(value) if isinstance(value, (list, dict)) else str(value))
    r.expire(key, TTL_SESSION)


def increment_session_length(session_id: str):
    get_redis().hincrby(f"session:{session_id}:features", "session_length", 1)


def get_session_features_or_default(session_id: str) -> dict:
    """Always returns a valid dict — use this in API routes."""
    return get_session_features(session_id) or {
        "engagement_score"   : 0.1,
        "intent_probability" : 0.05,
        "wtp_estimate"       : 0.0,
        "category_affinity"  : [],
        "session_length"     : 0,
        "last_event_type"    : "page_view",
        "last_product_id"    : "",
    }


# ── User affinity ─────────────────────────────────────────────
# Written by: stream_worker  |  Read by: Recommendation API

def set_user_affinity(user_id: str, affinity: dict):
    """
    affinity dict example:
        {"Electronics": 0.85, "Fashion": 0.42, "top_category": "Electronics"}
    """
    r = get_redis()
    r.hset(f"user:{user_id}:affinity", mapping={k: str(v) for k, v in affinity.items()})
    r.expire(f"user:{user_id}:affinity", TTL_AFFINITY)


def get_user_affinity(user_id: str) -> dict | None:
    raw = get_redis().hgetall(f"user:{user_id}:affinity")
    if not raw:
        return None
    result = {}
    for k, v in raw.items():
        try:
            result[k] = float(v)
        except ValueError:
            result[k] = v
    return result


def increment_category_affinity(user_id: str, category: str, delta: float = 0.1):
    """Nudge a category score up after any user interaction."""
    r = get_redis()
    r.hincrbyfloat(f"user:{user_id}:affinity", category, delta)
    r.expire(f"user:{user_id}:affinity", TTL_AFFINITY)


# ── Price cache ───────────────────────────────────────────────
# Written by: Pricing API  |  Read by: Pricing API (cache hit)

def set_price_cache(product_id: str, user_id: str, price: float, reason: str = ""):
    get_redis().setex(
        f"price:{product_id}:{user_id}",
        TTL_PRICE,
        json.dumps({"price": price, "reason": reason}),
    )


def get_price_cache(product_id: str, user_id: str) -> dict | None:
    """Returns {"price": float, "reason": str} or None on cache miss."""
    raw = get_redis().get(f"price:{product_id}:{user_id}")
    return json.loads(raw) if raw else None


def invalidate_price_cache(product_id: str, user_id: str):
    get_redis().delete(f"price:{product_id}:{user_id}")


# ── Competitor price cache ────────────────────────────────────
# Written by: stream_worker  |  Read by: Dynamic Pricing model

def set_competitor_price_redis(product_id: str, prices: dict):
    """
    prices dict example:
        {"amazon": 499.0, "flipkart": 479.0, "min": 479.0, "max": 520.0}
    """
    r = get_redis()
    r.hset(f"competitor:{product_id}", mapping={k: str(v) for k, v in prices.items()})
    r.expire(f"competitor:{product_id}", TTL_COMPETITOR)


def get_competitor_price_redis(product_id: str) -> dict | None:
    """
    Returns Redis competitor prices if available.
    Falls back to in-memory COMPETITOR_PRICES if Redis has nothing.
    """
    raw = get_redis().hgetall(f"competitor:{product_id}")
    if raw:
        result = {}
        for k, v in raw.items():
            try:
                result[k] = float(v)
            except ValueError:
                result[k] = v
        return result

    # Fallback: use the in-memory dict seeded at startup
    price = COMPETITOR_PRICES.get(product_id)
    return {"min": price, "max": price} if price else None