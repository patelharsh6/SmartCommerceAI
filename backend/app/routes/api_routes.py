"""
API Routes — Serves all /api/... endpoints expected by the React frontend.
Uses product_catalog.csv + Ridge model for recommendations and dynamic pricing.
"""

from flask import Blueprint, jsonify, request
from app.services.recommendation_service import (
    get_top_products,
    get_products_by_category,
    get_product_detail,
    format_product,
    recommend_similar_products,
    recommend_by_category,
    recommend_by_brand,
    get_trending,
    get_dynamic_price,
    catalog_df,
    ALL_CATEGORIES,
    ALL_SUBCATEGORIES,
    PRODUCT_LOOKUP,
)
from app.services.product_service import handle_prediction
from datetime import datetime
from collections import Counter, OrderedDict
import pandas as pd
import os as _os

api_bp = Blueprint("api", __name__, url_prefix="/api")

# ═══════════════════════════════════════════════════════════════
# IN-MEMORY SESSION & EVENT TRACKING
# ═══════════════════════════════════════════════════════════════
LIVE_EVENTS = []
SESSIONS = {}


# ═══════════════════════════════════════════════════════════════
# 📦 PRODUCTS   (GET /api/products)
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/products", methods=["GET"])
def api_get_products():
    """Return top products, optionally filtered by category."""
    category = request.args.get("category", None)
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 40, type=int)
    search = request.args.get("search", None)
    subcategory = request.args.get("subcategory", None)

    df = catalog_df.copy()

    # Filter by category
    if category:
        df = df[df["category"].str.lower() == category.lower()]

    # Filter by subcategory
    if subcategory:
        df = df[df["subcategory"].str.lower() == subcategory.lower()]

    # Search
    if search:
        q = search.lower()
        search_mask = pd.Series([False] * len(df), index=df.index)
        if "product_name" in df.columns:
            search_mask |= df["product_name"].astype(str).str.lower().str.contains(q, na=False)
        if "brand" in df.columns:
            search_mask |= df["brand"].astype(str).str.lower().str.contains(q, na=False)
        if "category" in df.columns:
            search_mask |= df["category"].astype(str).str.lower().str.contains(q, na=False)
        df = df[search_mask]

    total = len(df)
    df = df.sort_values(by="review_count", ascending=False)

    # Paginate
    start = (page - 1) * limit
    end = start + limit
    page_df = df.iloc[start:end]

    products = [format_product(row) for row in page_df.to_dict(orient="records")]

    # Build category tree
    categories = [
        {
            "code": cat,
            "name": cat,
            "count": len(ALL_SUBCATEGORIES.get(cat, [])),
            "subcategories": [
                {"code": sub, "name": sub}
                for sub in ALL_SUBCATEGORIES.get(cat, [])
            ]
        }
        for cat in ALL_CATEGORIES
    ]

    return jsonify({
        "products": products,
        "categories": categories,
        "total": total,
        "page": page,
        "has_more": end < total,
    })


@api_bp.route("/products/<product_id>", methods=["GET"])
def api_get_product(product_id):
    """Return a single product by sku_id."""
    product = get_product_detail(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    return jsonify(product)


# ═══════════════════════════════════════════════════════════════
# 🛍️ PRODUCT CATALOG   (GET /api/catalog) — Paginated
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/catalog", methods=["GET"])
def api_get_catalog():
    """
    Paginated product catalog from product_catalog.csv.
    Query params: page, limit, category, subcategory, search
    """
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)
    category = request.args.get("category", None)
    subcategory = request.args.get("subcategory", None)
    search = request.args.get("search", None)

    df = catalog_df.copy()

    if category and "category" in df.columns:
        df = df[df["category"].str.lower() == category.lower()]
    if subcategory and "subcategory" in df.columns:
        df = df[df["subcategory"].str.lower() == subcategory.lower()]
    if search:
        q = search.lower()
        search_mask = pd.Series([False] * len(df), index=df.index)
        if "product_name" in df.columns:
            search_mask |= df["product_name"].astype(str).str.lower().str.contains(q, na=False)
        if "brand" in df.columns:
            search_mask |= df["brand"].astype(str).str.lower().str.contains(q, na=False)
        if "category" in df.columns:
            search_mask |= df["category"].astype(str).str.lower().str.contains(q, na=False)
        df = df[search_mask]

    total = len(df)
    total_pages = max(1, -(-total // limit))

    start = (page - 1) * limit
    end = start + limit
    page_df = df.iloc[start:end]

    products = [format_product(row) for row in page_df.to_dict(orient="records")]

    return jsonify({
        "products": products,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": total_pages,
        "has_more": page < total_pages,
        "categories": [
            {
                "name": cat,
                "subcategories": ALL_SUBCATEGORIES.get(cat, []),
            }
            for cat in ALL_CATEGORIES
        ],
    })


# ═══════════════════════════════════════════════════════════════
# 👤 USERS   (GET /api/users)
# ═══════════════════════════════════════════════════════════════

# Demo users for the ML demo panel
DEMO_USERS = {
    "U_premium":     {"user_id": "U_premium",     "name": "Alex Premium",  "user_type": "premium",     "avatar": "👨‍💼"},
    "U_regular":     {"user_id": "U_regular",      "name": "Sam Regular",   "user_type": "regular",     "avatar": "👩‍💻"},
    "U_low_spender": {"user_id": "U_low_spender",  "name": "Jordan Budget", "user_type": "low_spender", "avatar": "🧑‍🎓"},
    "U_new_user":    {"user_id": "U_new_user",     "name": "Taylor New",    "user_type": "new_user",    "avatar": "👤"},
}

@api_bp.route("/users", methods=["GET"])
def api_get_users():
    """Return demo user profiles."""
    return jsonify({"users": list(DEMO_USERS.values())})


# ═══════════════════════════════════════════════════════════════
# 🧭 SESSIONS   (GET /api/session/<user_id>)
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/session/<user_id>", methods=["GET"])
def api_get_session(user_id):
    """Return session data for a user."""
    session = SESSIONS.get(user_id, {})
    viewed_pids = session.get("products_viewed", [])

    enriched = []
    categories_seen = []
    for pid in viewed_pids:
        product = get_product_detail(pid)
        if product:
            enriched.append(product)
            categories_seen.append(product["category"])

    total_views = len(enriched)
    if total_views == 0:
        journey = "Start browsing to build your personalized journey!"
    else:
        cat_counts = Counter(categories_seen)
        top_cat = cat_counts.most_common(1)[0][0]
        journey = (
            f"You've explored {total_views} product(s), showing strong interest "
            f"in {top_cat}. We're tailoring recommendations based on your journey."
        )

    return jsonify({
        "user_id": user_id,
        "products_viewed": enriched,
        "total_views": total_views,
        "journey_explanation": journey,
        "last_active": session.get("last_active")
    })


# ═══════════════════════════════════════════════════════════════
# 📊 EVENTS   (POST /api/events)
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/events", methods=["POST"])
def api_record_event():
    """Record a user interaction event and update session."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400

    user_id = str(data.get("user_id", ""))
    product_id = str(data.get("product_id", ""))
    event_type = data.get("event_type", "view")

    if not user_id or not product_id:
        return jsonify({"error": "user_id and product_id required"}), 400

    event = {
        "event_id": f"E{len(LIVE_EVENTS)+1:05d}",
        "user_id": user_id,
        "product_id": product_id,
        "event_type": event_type,
        "timestamp": datetime.now().isoformat()
    }
    LIVE_EVENTS.append(event)

    # Update session
    if user_id not in SESSIONS:
        SESSIONS[user_id] = {
            "user_id": user_id,
            "products_viewed": [],
            "last_active": datetime.now().isoformat()
        }
    session = SESSIONS[user_id]
    if product_id not in session["products_viewed"]:
        session["products_viewed"].append(product_id)
    session["last_active"] = datetime.now().isoformat()

    return jsonify({"status": "ok", "event": event}), 201


# ═══════════════════════════════════════════════════════════════
# 🔥 TRENDING   (GET /api/trending)
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/trending", methods=["GET"])
def api_get_trending():
    """Return trending products."""
    limit = request.args.get("limit", 5, type=int)
    trending = get_trending(top_n=limit)
    return jsonify({"trending": trending})


# ═══════════════════════════════════════════════════════════════
# 💰 DYNAMIC PRICING   (GET /api/price/<product_id>[/<user_id>])
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/price/<product_id>", methods=["GET"])
@api_bp.route("/price/<product_id>/<user_id>", methods=["GET"])
def api_get_price(product_id, user_id=None):
    """Calculate dynamic price using the trained Ridge model."""
    result = get_dynamic_price(product_id, user_id)
    if result is None:
        return jsonify({"error": "Product not found in pricing model"}), 404
    return jsonify(result)


# ═══════════════════════════════════════════════════════════════
# 🎯 RECOMMENDATIONS   (GET /api/recommendations/<product_id>)
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/recommendations/<product_id>", methods=["GET"])
def api_get_recommendations(product_id):
    """Multi-strategy recommendations."""
    user_id = request.args.get("user_id", None)
    sku = str(product_id)

    product = PRODUCT_LOOKUP.get(sku)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    category = product.get("category", "Other")
    subcategory = product.get("subcategory", "General")

    # 1. Similar products (cosine similarity)
    similar = recommend_similar_products(sku, top_n=5)

    # 2. Same-category products
    cat_recs = recommend_by_category(category, top_n=5)
    # Filter out the current product
    cat_recs = [r for r in cat_recs if r["product_id"] != sku][:5]

    # 3. Session-based
    session_recs = []
    if user_id and user_id in SESSIONS:
        viewed_pids = SESSIONS[user_id].get("products_viewed", [])
        seen_categories = set()
        for vpid in viewed_pids:
            vp = PRODUCT_LOOKUP.get(str(vpid))
            if vp:
                seen_categories.add(vp.get("category", ""))
        for scat in seen_categories:
            if scat != category and scat != "Other":
                recs = recommend_by_category(scat, top_n=2)
                session_recs.extend(recs)
        session_recs = session_recs[:4]

    # 4. Trending
    trending = get_trending(top_n=5)
    trending_recs = [t for t in trending if t["product_id"] != sku][:4]

    return jsonify({
        "product_id": product_id,
        "category_based": {
            "explanation": f"Similar products in {category} > {subcategory} (ML cosine similarity)",
            "products": similar
        },
        "frequently_bought": {
            "explanation": f"Top rated products in {category}",
            "products": cat_recs
        },
        "session_based": {
            "explanation": "Based on your browsing history" if session_recs else "Browse more to unlock personalized picks",
            "products": session_recs
        },
        "trending": {
            "explanation": "Most popular products right now (by rating & reviews)",
            "products": trending_recs
        }
    })


# ═══════════════════════════════════════════════════════════════
# 🏷️ BRAND RECOMMENDATIONS   (GET /api/brand-recommend/<query>)
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/brand-recommend/<query>", methods=["GET"])
def api_get_brand_recommendations(query):
    """Find products by brand using TF-IDF search."""
    limit = request.args.get("limit", 10, type=int)
    result = recommend_by_brand(query, top_n=limit)
    return jsonify(result)


# ═══════════════════════════════════════════════════════════════
# 📊 DASHBOARD   (GET /api/dashboard)
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/dashboard", methods=["GET"])
def api_get_dashboard():
    """Return aggregate stats."""
    active_sessions = sum(
        1 for s in SESSIONS.values()
        if len(s.get("products_viewed", [])) > 0
    )

    return jsonify({
        "total_products": len(PRODUCT_LOOKUP),
        "total_events": len(LIVE_EVENTS),
        "total_users": len(DEMO_USERS),
        "active_sessions": active_sessions,
        "categories": ALL_CATEGORIES[:15],
        "dataset_events": 0,
        "live_events": len(LIVE_EVENTS)
    })


# ═══════════════════════════════════════════════════════════════
# 🔮 PREDICT BY SKU   (POST /api/predict-by-sku)
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/predict-by-sku", methods=["POST"])
def predict():
    """Price prediction for a given SKU using the Ridge model."""
    data = request.json
    sku_id = data.get("sku_id")

    if not sku_id:
        return jsonify({"error": "sku_id is required"}), 400

    result = handle_prediction(sku_id)

    if "error" in result:
        return jsonify(result), 404

    return jsonify(result)
