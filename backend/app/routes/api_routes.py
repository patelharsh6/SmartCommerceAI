"""
API Routes — Serves all /api/... endpoints expected by the React frontend.
Uses real ML models for recommendations and dynamic pricing.
"""

from flask import Blueprint, jsonify, request
from app.services.recommendation_service import (
    get_top_products,
    get_products_by_category,
    get_product_detail,
    format_product,
    recommend_by_category,
    recommend_similar_products,
    recommend_by_association,
    recommend_by_brand,
    get_trending,
    get_dynamic_price,
    classify_user,
    ALL_CATEGORIES,
    PRODUCT_LOOKUP,
    cat_data,
    raw_events_df,
    _format_category_name,
)
from datetime import datetime
from collections import Counter

api_bp = Blueprint("api", __name__, url_prefix="/api")

# ═══════════════════════════════════════════════════════════════
# IN-MEMORY SESSION & EVENT TRACKING
# ═══════════════════════════════════════════════════════════════
LIVE_EVENTS = []    # Events recorded during this server session
SESSIONS = {}       # user_id -> {products_viewed: [...], last_active: ...}

# Pre-built user personas for demo (mapped to real user_ids from Dataset)
DEMO_USERS = {}

def _build_demo_users():
    """Pick 4 real users from the dataset with different spending patterns."""
    global DEMO_USERS

    # Get unique user_ids that have purchase events
    purchasers = raw_events_df[raw_events_df['event_type'] == 'purchase']['user_id'].unique()
    browsers = raw_events_df[raw_events_df['event_type'] == 'view']['user_id'].unique()

    # Classify a sample
    classified = {}
    for uid in purchasers[:200]:
        seg = classify_user(int(uid))
        if seg not in classified:
            classified[seg] = int(uid)
        if len(classified) >= 3:
            break

    # Find a browser-only user
    for uid in browsers:
        if uid not in purchasers:
            classified['browser'] = int(uid)
            break

    # If we don't have enough variety, use synthetic IDs
    user_templates = [
        {"user_type": "premium",     "name": "Alex Premium",   "avatar": "👨‍💼"},
        {"user_type": "regular",     "name": "Sam Regular",    "avatar": "👩‍💻"},
        {"user_type": "low_spender", "name": "Jordan Budget",  "avatar": "🧑‍🎓"},
        {"user_type": "new_user",    "name": "Taylor New",     "avatar": "👤"},
    ]

    for template in user_templates:
        seg = template["user_type"]
        real_uid = classified.get(seg)
        if real_uid:
            uid_str = str(real_uid)
        else:
            # Create a synthetic user ID
            uid_str = "U_" + seg
            real_uid = None

        DEMO_USERS[uid_str] = {
            "user_id": uid_str,
            "real_user_id": real_uid,
            "name": template["name"],
            "user_type": seg,
            "avatar": template["avatar"],
        }

        # Pre-build sessions from real data
        if real_uid:
            user_events = raw_events_df[raw_events_df['user_id'] == real_uid]
            viewed_pids = user_events['product_id'].unique()[:5].tolist()
            SESSIONS[uid_str] = {
                "user_id": uid_str,
                "products_viewed": [str(pid) for pid in viewed_pids],
                "last_active": datetime.now().isoformat()
            }

_build_demo_users()


# ═══════════════════════════════════════════════════════════════
# 📦 PRODUCTS   (GET /api/products)
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/products", methods=["GET"])
def api_get_products():
    """Return top products with formatted data, optionally filtered by category."""
    category = request.args.get("category", None)

    if category:
        # Support both exact match and prefix match (parent category)
        exact = cat_data[cat_data['category_code'] == category]
        if len(exact) > 0:
            products = get_products_by_category(category, n=20)
        else:
            # Prefix match for parent categories like "electronics"
            matched = cat_data[cat_data['category_code'].str.startswith(category + '.')]
            sub_codes = matched['category_code'].unique()
            products = []
            for sc in sub_codes:
                products.extend(get_products_by_category(sc, n=3))
            # Sort by final_score and take top 20
            products = sorted(products, key=lambda x: x.get('final_score', 0), reverse=True)[:20]

        # If still no products, fall back to unfiltered
        if not products:
            products = get_top_products(n=40)
    else:
        products = get_top_products(n=40)

    # Build grouped categories: top-level parents WITH subcategories
    from collections import OrderedDict
    parent_groups = OrderedDict()
    for c in ALL_CATEGORIES:
        parts = c.split('.')
        parent = parts[0]
        if parent not in parent_groups:
            parent_groups[parent] = []
        parent_groups[parent].append({
            "code": c,
            "name": _format_category_name(c)
        })

    categories = [
        {
            "code": parent,
            "name": parent.replace('_', ' ').title(),
            "count": len(subs),
            "subcategories": subs
        }
        for parent, subs in parent_groups.items()
    ]

    return jsonify({
        "products": products,
        "categories": categories,
        "total": len(products)
    })


@api_bp.route("/products/<product_id>", methods=["GET"])
def api_get_product(product_id):
    """Return a single product by ID."""
    product = get_product_detail(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    return jsonify(product)


# ═══════════════════════════════════════════════════════════════
# 🛍️ PRODUCT CATALOG   (GET /api/catalog)
# ═══════════════════════════════════════════════════════════════

import pandas as pd
import os as _os

_CATALOG_CSV = _os.path.join(
    _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))),
    "data",
    "product_catalog.csv",
)

try:
    _catalog_df = pd.read_csv(_CATALOG_CSV)
    # Only keep active products
    if "is_active" in _catalog_df.columns:
        _catalog_df = _catalog_df[_catalog_df["is_active"] == True].reset_index(drop=True)
except Exception as e:
    print(f"Error loading catalog CSV: {e}")
    _catalog_df = pd.DataFrame()

# Build unique category / subcategory lists once
_catalog_categories = []
_catalog_subcategories = {}
if not _catalog_df.empty and "category" in _catalog_df.columns:
    _catalog_categories = sorted(_catalog_df["category"].dropna().unique().tolist())
    if "subcategory" in _catalog_df.columns:
        for cat in _catalog_categories:
            subs = sorted(
                _catalog_df[_catalog_df["category"] == cat]["subcategory"]
                .dropna()
                .unique()
                .tolist()
            )
            _catalog_subcategories[cat] = subs


@api_bp.route("/catalog", methods=["GET"])
def api_get_catalog():
    """
    Paginated product catalog from product_catalog.csv.
    Query params:
        page   (int, default 1)
        limit  (int, default 20)
        category     (str, optional)
        subcategory  (str, optional)
        search       (str, optional)
    """
    if _catalog_df.empty:
        return jsonify({"products": [], "total": 0, "page": 1, "has_more": False})

    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 20, type=int)
    category = request.args.get("category", None)
    subcategory = request.args.get("subcategory", None)
    search = request.args.get("search", None)

    df = _catalog_df.copy()

    # Filter by category / subcategory
    if category and "category" in df.columns:
        df = df[df["category"].str.lower() == category.lower()]
    if subcategory and "subcategory" in df.columns:
        df = df[df["subcategory"].str.lower() == subcategory.lower()]
    if search:
        q = search.lower()
        search_mask = pd.Series([False]*len(df), index=df.index)
        
        if "product_name" in df.columns:
            search_mask |= df["product_name"].astype(str).str.lower().str.contains(q, na=False)
        if "brand" in df.columns:
            search_mask |= df["brand"].astype(str).str.lower().str.contains(q, na=False)
        if "category" in df.columns:
            search_mask |= df["category"].astype(str).str.lower().str.contains(q, na=False)
            
        df = df[search_mask]

    total = len(df)
    total_pages = max(1, -(-total // limit))  # ceil division

    start = (page - 1) * limit
    end = start + limit
    page_df = df.iloc[start:end]

    products = []
    for _, row in page_df.iterrows():
        products.append({
            "product_id": row.get("sku_id", ""),
            "name": row.get("product_name", ""),
            "category": row.get("category", ""),
            "subcategory": row.get("subcategory", ""),
            "brand": row.get("brand", ""),
            "base_price": round(float(row.get("current_price_usd", row.get("base_price_usd", 0))), 2),
            "original_price": round(float(row.get("base_price_usd", 0)), 2),
            "image": row.get("image_url", ""),
            "img_url": row.get("image_url", ""),
            "image_url": row.get("image_url", ""),
            "avg_rating": float(row.get("avg_rating", 0)) if pd.notna(row.get("avg_rating")) else None,
            "review_count": int(row.get("review_count", 0)) if pd.notna(row.get("review_count")) else 0,
            "stock": int(row.get("inventory_count", 0)) if pd.notna(row.get("inventory_count")) else 0,
            "description": f"{row.get('brand', '')} {row.get('subcategory', '')}",
        })

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
                "subcategories": _catalog_subcategories.get(cat, []),
            }
            for cat in _catalog_categories
        ],
    })


# ═══════════════════════════════════════════════════════════════
# 👤 USERS   (GET /api/users)
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/users", methods=["GET"])
def api_get_users():
    """Return demo user profiles."""
    return jsonify({
        "users": list(DEMO_USERS.values())
    })


# ═══════════════════════════════════════════════════════════════
# 🧭 SESSIONS   (GET /api/session/<user_id>)
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/session/<user_id>", methods=["GET"])
def api_get_session(user_id):
    """Return session data for a user with journey explanation."""
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
    """Return trending products based on real ML popularity scores."""
    limit = request.args.get("limit", 5, type=int)
    trending_raw = get_trending(top_n=limit)
    trending = [format_product(item) for item in trending_raw]

    # Add rank & view_count to formatted items
    for i, item in enumerate(trending):
        item['trending_rank'] = f"#{i+1}"
        item['view_count'] = trending_raw[i].get('view_count', trending_raw[i].get('interaction_count', 0))

    return jsonify({"trending": trending})


# ═══════════════════════════════════════════════════════════════
# 💰 DYNAMIC PRICING   (GET /api/price/<product_id>[/<user_id>])
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/price/<product_id>", methods=["GET"])
@api_bp.route("/price/<product_id>/<user_id>", methods=["GET"])
def api_get_price(product_id, user_id=None):
    """
    Calculate dynamic price using the trained GradientBoosting model.
    Prices are cached daily — same product+user_segment returns cached result
    until the next calendar day.
    """
    # Resolve real user_id from demo users
    real_uid = None
    if user_id and user_id in DEMO_USERS:
        real_uid = DEMO_USERS[user_id].get("real_user_id")
    elif user_id:
        try:
            real_uid = int(user_id)
        except (ValueError, TypeError):
            real_uid = None

    result = get_dynamic_price(product_id, real_uid)

    if result is None:
        return jsonify({"error": "Product not found in pricing model"}), 404

    return jsonify(result)


# ═══════════════════════════════════════════════════════════════
# 🎯 RECOMMENDATIONS   (GET /api/recommendations/<product_id>)
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/recommendations/<product_id>", methods=["GET"])
def api_get_recommendations(product_id):
    """
    Multi-strategy recommendations using real ML models:
    1. Category-based (Polynomial Regression model)
    2. Frequently bought together (Apriori association rules)
    3. Trending (popularity from ML model)
    """
    user_id = request.args.get("user_id", None)
    pid = int(product_id)

    product = PRODUCT_LOOKUP.get(pid)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    category = product.get('category_code', 'unknown')

    # 1. Category-based recommendations (ML model)
    cat_recs_raw = recommend_similar_products(pid, top_n=5)
    cat_recs = [format_product(r) for r in cat_recs_raw]

    # 2. Association rules (Apriori model)
    assoc_recs_raw = recommend_by_association(pid, top_n=5)
    assoc_recs = [format_product(r) for r in assoc_recs_raw]

    # 3. Session-based (from user's browsing history)
    session_recs = []
    if user_id and user_id in SESSIONS:
        viewed_pids = SESSIONS[user_id].get("products_viewed", [])
        seen_categories = set()
        for vpid in viewed_pids:
            vp = PRODUCT_LOOKUP.get(int(vpid)) if vpid.isdigit() else None
            if vp:
                seen_categories.add(vp.get('category_code', ''))

        for scat in seen_categories:
            if scat != category and scat != 'unknown':
                recs = recommend_by_category(scat, top_n=2)
                session_recs.extend([format_product(r) for r in recs])
        session_recs = session_recs[:4]

    # 4. Trending
    trending_raw = get_trending(top_n=5)
    trending_recs = [format_product(r) for r in trending_raw if int(r['product_id']) != pid][:4]

    return jsonify({
        "product_id": product_id,
        "category_based": {
            "explanation": f"Similar products in {_format_category_name(category)} (ML scored)",
            "products": cat_recs
        },
        "frequently_bought": {
            "explanation": "Customers who viewed this also bought (Apriori model)",
            "products": assoc_recs
        },
        "session_based": {
            "explanation": "Based on your browsing history" if session_recs else "Browse more to unlock personalized picks",
            "products": session_recs
        },
        "trending": {
            "explanation": "Most popular products right now (by ML popularity score)",
            "products": trending_recs
        }
    })


# ═══════════════════════════════════════════════════════════════
# 🏷️ BRAND RECOMMENDATIONS   (GET /api/brand-recommend/<query>)
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/brand-recommend/<query>", methods=["GET"])
def api_get_brand_recommendations(query):
    """
    Finds the closest matching product using TF-IDF + Cosine Similarity,
    extracts its brand, and returns all products of that same brand.
    """
    limit = request.args.get("limit", 10, type=int)
    result = recommend_by_brand(query, top_n=limit)
# """
# API Routes — Serves all /api/... endpoints expected by the React frontend.
# Uses real ML models for recommendations and dynamic pricing.
# """

# from flask import Blueprint, jsonify, request
# from app.services.recommendation_service import (
#     get_top_products,
#     get_products_by_category,
#     get_product_detail,
#     format_product,
#     recommend_by_category,
#     recommend_similar_products,
#     recommend_by_association,
#     get_trending,
#     get_dynamic_price,
#     classify_user,
#     ALL_CATEGORIES,
#     PRODUCT_LOOKUP,
#     cat_data,
#     raw_events_df,
#     _format_category_name,
# )
# from datetime import datetime
# from collections import Counter

# api_bp = Blueprint("api", __name__, url_prefix="/api")

# # ═══════════════════════════════════════════════════════════════
# # IN-MEMORY SESSION & EVENT TRACKING
# # ═══════════════════════════════════════════════════════════════
# LIVE_EVENTS = []    # Events recorded during this server session
# SESSIONS = {}       # user_id -> {products_viewed: [...], last_active: ...}

# # Pre-built user personas for demo (mapped to real user_ids from Dataset)
# DEMO_USERS = {}

# def _build_demo_users():
#     """Pick 4 real users from the dataset with different spending patterns."""
#     global DEMO_USERS

#     # Get unique user_ids that have purchase events
#     purchasers = raw_events_df[raw_events_df['event_type'] == 'purchase']['user_id'].unique()
#     browsers = raw_events_df[raw_events_df['event_type'] == 'view']['user_id'].unique()

#     # Classify a sample
#     classified = {}
#     for uid in purchasers[:200]:
#         seg = classify_user(int(uid))
#         if seg not in classified:
#             classified[seg] = int(uid)
#         if len(classified) >= 3:
#             break

#     # Find a browser-only user
#     for uid in browsers:
#         if uid not in purchasers:
#             classified['browser'] = int(uid)
#             break

#     # If we don't have enough variety, use synthetic IDs
#     user_templates = [
#         {"user_type": "premium",     "name": "Alex Premium",   "avatar": "👨‍💼"},
#         {"user_type": "regular",     "name": "Sam Regular",    "avatar": "👩‍💻"},
#         {"user_type": "low_spender", "name": "Jordan Budget",  "avatar": "🧑‍🎓"},
#         {"user_type": "new_user",    "name": "Taylor New",     "avatar": "👤"},
#     ]

#     for template in user_templates:
#         seg = template["user_type"]
#         real_uid = classified.get(seg)
#         if real_uid:
#             uid_str = str(real_uid)
#         else:
#             # Create a synthetic user ID
#             uid_str = "U_" + seg
#             real_uid = None

#         DEMO_USERS[uid_str] = {
#             "user_id": uid_str,
#             "real_user_id": real_uid,
#             "name": template["name"],
#             "user_type": seg,
#             "avatar": template["avatar"],
#         }

#         # Pre-build sessions from real data
#         if real_uid:
#             user_events = raw_events_df[raw_events_df['user_id'] == real_uid]
#             viewed_pids = user_events['product_id'].unique()[:5].tolist()
#             SESSIONS[uid_str] = {
#                 "user_id": uid_str,
#                 "products_viewed": [str(pid) for pid in viewed_pids],
#                 "last_active": datetime.now().isoformat()
#             }

# _build_demo_users()


# # ═══════════════════════════════════════════════════════════════
# # 📦 PRODUCTS   (GET /api/products)
# # ═══════════════════════════════════════════════════════════════

# @api_bp.route("/products", methods=["GET"])
# def api_get_products():
#     """Return top products with formatted data, optionally filtered by category."""
#     category = request.args.get("category", None)

#     if category:
#         # Support both exact match and prefix match (parent category)
#         exact = cat_data[cat_data['category_code'] == category]
#         if len(exact) > 0:
#             products = get_products_by_category(category, n=20)
#         else:
#             # Prefix match for parent categories like "electronics"
#             matched = cat_data[cat_data['category_code'].str.startswith(category + '.')]
#             sub_codes = matched['category_code'].unique()
#             products = []
#             for sc in sub_codes:
#                 products.extend(get_products_by_category(sc, n=3))
#             # Sort by final_score and take top 20
#             products = sorted(products, key=lambda x: x.get('final_score', 0), reverse=True)[:20]

#         # If still no products, fall back to unfiltered
#         if not products:
#             products = get_top_products(n=40)
#     else:
#         products = get_top_products(n=40)

#     # Build grouped categories: top-level parents WITH subcategories
#     from collections import OrderedDict
#     parent_groups = OrderedDict()
#     for c in ALL_CATEGORIES:
#         parts = c.split('.')
#         parent = parts[0]
#         if parent not in parent_groups:
#             parent_groups[parent] = []
#         parent_groups[parent].append({
#             "code": c,
#             "name": _format_category_name(c)
#         })

#     categories = [
#         {
#             "code": parent,
#             "name": parent.replace('_', ' ').title(),
#             "count": len(subs),
#             "subcategories": subs
#         }
#         for parent, subs in parent_groups.items()
#     ]

#     return jsonify({
#         "products": products,
#         "categories": categories,
#         "total": len(products)
#     })


# @api_bp.route("/products/<product_id>", methods=["GET"])
# def api_get_product(product_id):
#     """Return a single product by ID."""
#     product = get_product_detail(product_id)
#     if not product:
#         return jsonify({"error": "Product not found"}), 404
#     return jsonify(product)


# # ═══════════════════════════════════════════════════════════════
# # 👤 USERS   (GET /api/users)
# # ═══════════════════════════════════════════════════════════════

# @api_bp.route("/users", methods=["GET"])
# def api_get_users():
#     """Return demo user profiles."""
#     return jsonify({
#         "users": list(DEMO_USERS.values())
#     })


# # ═══════════════════════════════════════════════════════════════
# # 🧭 SESSIONS   (GET /api/session/<user_id>)
# # ═══════════════════════════════════════════════════════════════

# @api_bp.route("/session/<user_id>", methods=["GET"])
# def api_get_session(user_id):
#     """Return session data for a user with journey explanation."""
#     session = SESSIONS.get(user_id, {})
#     viewed_pids = session.get("products_viewed", [])

#     enriched = []
#     categories_seen = []
#     for pid in viewed_pids:
#         product = get_product_detail(pid)
#         if product:
#             enriched.append(product)
#             categories_seen.append(product["category"])

#     total_views = len(enriched)
#     if total_views == 0:
#         journey = "Start browsing to build your personalized journey!"
#     else:
#         cat_counts = Counter(categories_seen)
#         top_cat = cat_counts.most_common(1)[0][0]
#         journey = (
#             f"You've explored {total_views} product(s), showing strong interest "
#             f"in {top_cat}. We're tailoring recommendations based on your journey."
#         )

#     return jsonify({
#         "user_id": user_id,
#         "products_viewed": enriched,
#         "total_views": total_views,
#         "journey_explanation": journey,
#         "last_active": session.get("last_active")
#     })


# # ═══════════════════════════════════════════════════════════════
# # 📊 EVENTS   (POST /api/events)
# # ═══════════════════════════════════════════════════════════════

# @api_bp.route("/events", methods=["POST"])
# def api_record_event():
#     """Record a user interaction event and update session."""
#     data = request.get_json()
#     if not data:
#         return jsonify({"error": "Missing JSON body"}), 400

#     user_id = str(data.get("user_id", ""))
#     product_id = str(data.get("product_id", ""))
#     event_type = data.get("event_type", "view")

#     if not user_id or not product_id:
#         return jsonify({"error": "user_id and product_id required"}), 400

#     event = {
#         "event_id": f"E{len(LIVE_EVENTS)+1:05d}",
#         "user_id": user_id,
#         "product_id": product_id,
#         "event_type": event_type,
#         "timestamp": datetime.now().isoformat()
#     }
#     LIVE_EVENTS.append(event)

#     # Update session
#     if user_id not in SESSIONS:
#         SESSIONS[user_id] = {
#             "user_id": user_id,
#             "products_viewed": [],
#             "last_active": datetime.now().isoformat()
#         }
#     session = SESSIONS[user_id]
#     if product_id not in session["products_viewed"]:
#         session["products_viewed"].append(product_id)
#     session["last_active"] = datetime.now().isoformat()

#     return jsonify({"status": "ok", "event": event}), 201


# # ═══════════════════════════════════════════════════════════════
# # 🔥 TRENDING   (GET /api/trending)
# # ═══════════════════════════════════════════════════════════════

# @api_bp.route("/trending", methods=["GET"])
# def api_get_trending():
#     """Return trending products based on real ML popularity scores."""
#     limit = request.args.get("limit", 5, type=int)
#     trending_raw = get_trending(top_n=limit)
#     trending = [format_product(item) for item in trending_raw]

#     # Add rank & view_count to formatted items
#     for i, item in enumerate(trending):
#         item['trending_rank'] = f"#{i+1}"
#         item['view_count'] = trending_raw[i].get('view_count', trending_raw[i].get('interaction_count', 0))

#     return jsonify({"trending": trending})


# # ═══════════════════════════════════════════════════════════════
# # 💰 DYNAMIC PRICING   (GET /api/price/<product_id>[/<user_id>])
# # ═══════════════════════════════════════════════════════════════

# @api_bp.route("/price/<product_id>", methods=["GET"])
# @api_bp.route("/price/<product_id>/<user_id>", methods=["GET"])
# def api_get_price(product_id, user_id=None):
#     """
#     Calculate dynamic price using the trained GradientBoosting model.
#     Prices are cached daily — same product+user_segment returns cached result
#     until the next calendar day.
#     """
#     # Resolve real user_id from demo users
#     real_uid = None
#     if user_id and user_id in DEMO_USERS:
#         real_uid = DEMO_USERS[user_id].get("real_user_id")
#     elif user_id:
#         try:
#             real_uid = int(user_id)
#         except (ValueError, TypeError):
#             real_uid = None

#     result = get_dynamic_price(product_id, real_uid)

#     if result is None:
#         return jsonify({"error": "Product not found in pricing model"}), 404

#     return jsonify(result)


# # ═══════════════════════════════════════════════════════════════
# # 🎯 RECOMMENDATIONS   (GET /api/recommendations/<product_id>)
# # ═══════════════════════════════════════════════════════════════

# @api_bp.route("/recommendations/<product_id>", methods=["GET"])
# def api_get_recommendations(product_id):
#     """
#     Multi-strategy recommendations using real ML models:
#     1. Category-based (Polynomial Regression model)
#     2. Frequently bought together (Apriori association rules)
#     3. Trending (popularity from ML model)
#     """
#     user_id = request.args.get("user_id", None)
#     pid = int(product_id)

#     product = PRODUCT_LOOKUP.get(pid)
#     if not product:
#         return jsonify({"error": "Product not found"}), 404

#     category = product.get('category_code', 'unknown')

#     # 1. Category-based recommendations (ML model)
#     cat_recs_raw = recommend_similar_products(pid, top_n=5)
#     cat_recs = [format_product(r) for r in cat_recs_raw]

#     # 2. Association rules (Apriori model)
#     assoc_recs_raw = recommend_by_association(pid, top_n=5)
#     assoc_recs = [format_product(r) for r in assoc_recs_raw]

#     # 3. Session-based (from user's browsing history)
#     session_recs = []
#     if user_id and user_id in SESSIONS:
#         viewed_pids = SESSIONS[user_id].get("products_viewed", [])
#         seen_categories = set()
#         for vpid in viewed_pids:
#             vp = PRODUCT_LOOKUP.get(int(vpid)) if vpid.isdigit() else None
#             if vp:
#                 seen_categories.add(vp.get('category_code', ''))

#         for scat in seen_categories:
#             if scat != category and scat != 'unknown':
#                 recs = recommend_by_category(scat, top_n=2)
#                 session_recs.extend([format_product(r) for r in recs])
#         session_recs = session_recs[:4]

#     # 4. Trending
#     trending_raw = get_trending(top_n=5)
#     trending_recs = [format_product(r) for r in trending_raw if int(r['product_id']) != pid][:4]

#     return jsonify({
#         "product_id": product_id,
#         "category_based": {
#             "explanation": f"Similar products in {_format_category_name(category)} (ML scored)",
#             "products": cat_recs
#         },
#         "frequently_bought": {
#             "explanation": "Customers who viewed this also bought (Apriori model)",
#             "products": assoc_recs
#         },
#         "session_based": {
#             "explanation": "Based on your browsing history" if session_recs else "Browse more to unlock personalized picks",
#             "products": session_recs
#         },
#         "trending": {
#             "explanation": "Most popular products right now (by ML popularity score)",
#             "products": trending_recs
#         }
#     })


# # ═══════════════════════════════════════════════════════════════
# # 📊 DASHBOARD   (GET /api/dashboard)
# # ═══════════════════════════════════════════════════════════════

# @api_bp.route("/dashboard", methods=["GET"])
# def api_get_dashboard():
#     """Return real aggregate stats from the ML data."""
#     active_sessions = sum(
#         1 for s in SESSIONS.values()
#         if len(s.get("products_viewed", [])) > 0
#     )

#     total_events_in_dataset = len(raw_events_df)
#     total_live_events = len(LIVE_EVENTS)

#     categories = [_format_category_name(c) for c in ALL_CATEGORIES[:15]]

#     return jsonify({
#         "total_products": len(PRODUCT_LOOKUP),
#         "total_events": total_events_in_dataset + total_live_events,
#         "total_users": len(DEMO_USERS),
#         "active_sessions": active_sessions,
#         "categories": categories,
#         "dataset_events": total_events_in_dataset,
#         "live_events": total_live_events
#     })


from flask import Blueprint, request, jsonify
from app.services.product_service import handle_prediction

product_bp = Blueprint('product', __name__)

@product_bp.route('/predict-by-sku', methods=['POST'])
def predict():
    data = request.json
    sku_id = data.get("sku_id")

    if not sku_id:
        return jsonify({"error": "sku_id is required"}), 400

    result = handle_prediction(sku_id)
    
    if "error" in result:
        return jsonify(result), 404
        
    return jsonify(result)
