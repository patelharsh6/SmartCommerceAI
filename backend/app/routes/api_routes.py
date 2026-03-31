"""
API Routes — Serves all /api/... endpoints expected by the React frontend.
Maps frontend calls to the data_store and recommendation_service modules.
"""

from flask import Blueprint, jsonify, request
from app.data_store import (
    PRODUCTS, PRODUCT_MAP, USERS, EVENTS, SESSIONS,
    COMPETITOR_PRICES
)
import random
from datetime import datetime
from collections import Counter

api_bp = Blueprint("api", __name__, url_prefix="/api")


# ═══════════════════════════════════════════════════════════════
# 📦 PRODUCTS
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/products", methods=["GET"])
def get_products():
    """Return all products, optionally filtered by category."""
    category = request.args.get("category", None)

    if category:
        filtered = [p for p in PRODUCTS if p["category"] == category]
    else:
        filtered = PRODUCTS

    categories = sorted(set(p["category"] for p in PRODUCTS))

    return jsonify({
        "products": filtered,
        "categories": categories
    })


@api_bp.route("/products/<product_id>", methods=["GET"])
def get_product(product_id):
    """Return a single product by ID."""
    product = PRODUCT_MAP.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404
    return jsonify(product)


# ═══════════════════════════════════════════════════════════════
# 👤 USERS & SESSIONS
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/users", methods=["GET"])
def get_users():
    """Return all simulated user profiles."""
    return jsonify({
        "users": list(USERS.values())
    })


@api_bp.route("/session/<user_id>", methods=["GET"])
def get_session(user_id):
    """Return session data for a user, including journey explanation."""
    session = SESSIONS.get(user_id)
    if not session:
        return jsonify({
            "user_id": user_id,
            "products_viewed": [],
            "total_views": 0,
            "journey_explanation": "No browsing history yet.",
            "last_active": None
        })

    # Enrich products_viewed with product details
    enriched_products = []
    for pid in session.get("products_viewed", []):
        product = PRODUCT_MAP.get(pid)
        if product:
            enriched_products.append({
                "product_id": pid,
                "name": product["name"],
                "image": product["image"],
                "category": product["category"],
                "base_price": product["base_price"]
            })

    total_views = len(enriched_products)

    # Build journey explanation
    if total_views == 0:
        journey = "Start browsing to build your personalized journey!"
    else:
        cats = [p["category"] for p in enriched_products]
        cat_counts = Counter(cats)
        top_cat = cat_counts.most_common(1)[0][0]
        journey = (
            f"You've explored {total_views} product(s), showing strong interest "
            f"in {top_cat}. We're tailoring recommendations based on your journey."
        )

    return jsonify({
        "user_id": user_id,
        "products_viewed": enriched_products,
        "total_views": total_views,
        "journey_explanation": journey,
        "last_active": session.get("last_active")
    })


# ═══════════════════════════════════════════════════════════════
# 📊 EVENTS
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/events", methods=["POST"])
def record_event():
    """Record a user interaction event and update session."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400

    user_id = data.get("user_id")
    product_id = data.get("product_id")
    event_type = data.get("event_type", "view")

    if not user_id or not product_id:
        return jsonify({"error": "user_id and product_id are required"}), 400

    # Add event
    event = {
        "event_id": f"E{len(EVENTS)+1:05d}",
        "user_id": user_id,
        "product_id": product_id,
        "event_type": event_type,
        "timestamp": datetime.now().isoformat()
    }
    EVENTS.append(event)

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
# 🔥 TRENDING
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/trending", methods=["GET"])
def get_trending():
    """Return trending products based on event activity."""
    limit = request.args.get("limit", 5, type=int)

    # Count interactions per product
    product_counts = Counter(e["product_id"] for e in EVENTS)
    top_products = product_counts.most_common(limit)

    trending = []
    for rank, (pid, count) in enumerate(top_products, 1):
        product = PRODUCT_MAP.get(pid)
        if product:
            trending.append({
                "product_id": pid,
                "name": product["name"],
                "category": product["category"],
                "image": product["image"],
                "base_price": product["base_price"],
                "description": product["description"],
                "stock": product["stock"],
                "view_count": count,
                "trending_rank": f"#{rank}"
            })

    return jsonify({"trending": trending})


# ═══════════════════════════════════════════════════════════════
# 💰 DYNAMIC PRICING
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/price/<product_id>", methods=["GET"])
@api_bp.route("/price/<product_id>/<user_id>", methods=["GET"])
def get_price(product_id, user_id=None):
    """
    Calculate a dynamic price for a product, personalized to a user.
    Uses demand, competitor data, user segment, and stock level.
    """
    product = PRODUCT_MAP.get(product_id)
    if not product:
        return jsonify({"error": "Product not found"}), 404

    base_price = product["base_price"]
    final_price = base_price
    adjustments = []

    # ── 1. Demand factor ──
    product_events = [e for e in EVENTS if e["product_id"] == product_id]
    demand_count = len(product_events)

    if demand_count > 50:
        factor = 1.12
        final_price *= factor
        adjustments.append({
            "factor": "High Demand",
            "description": f"{demand_count} interactions detected — surge pricing applied",
            "impact": f"+{round((factor - 1) * 100)}%",
            "icon": "📈"
        })
    elif demand_count > 20:
        factor = 1.05
        final_price *= factor
        adjustments.append({
            "factor": "Moderate Demand",
            "description": f"{demand_count} interactions — slight price increase",
            "impact": f"+{round((factor - 1) * 100)}%",
            "icon": "📊"
        })
    elif demand_count < 5:
        factor = 0.92
        final_price *= factor
        adjustments.append({
            "factor": "Low Demand",
            "description": "Low interaction count — discount applied to boost sales",
            "impact": f"{round((factor - 1) * 100)}%",
            "icon": "📉"
        })

    # ── 2. Competitor pricing ──
    competitor_price = COMPETITOR_PRICES.get(product_id)
    if competitor_price:
        if final_price > competitor_price * 1.05:
            adj = 0.97
            final_price *= adj
            adjustments.append({
                "factor": "Competitor Match",
                "description": f"Competitor price ${competitor_price} — adjusting to stay competitive",
                "impact": "-3%",
                "icon": "🏪"
            })
        elif final_price < competitor_price * 0.90:
            adj = 1.03
            final_price *= adj
            adjustments.append({
                "factor": "Price Optimization",
                "description": f"Below competitor (${competitor_price}) — slight increase for margin",
                "impact": "+3%",
                "icon": "💹"
            })

    # ── 3. Stock level ──
    stock = product.get("stock", 50)
    if stock < 15:
        factor = 1.08
        final_price *= factor
        adjustments.append({
            "factor": "Low Stock",
            "description": f"Only {stock} units remaining — scarcity premium",
            "impact": f"+{round((factor - 1) * 100)}%",
            "icon": "📦"
        })
    elif stock > 100:
        factor = 0.95
        final_price *= factor
        adjustments.append({
            "factor": "Overstock",
            "description": f"{stock} units in stock — clearance discount",
            "impact": f"{round((factor - 1) * 100)}%",
            "icon": "🏷️"
        })

    # ── 4. User segment personalization ──
    user = USERS.get(user_id) if user_id else None
    if user:
        user_type = user["user_type"]
        if user_type == "premium":
            factor = 0.90
            final_price *= factor
            adjustments.append({
                "factor": "Premium Member",
                "description": "Exclusive 10% loyalty discount for premium members",
                "impact": "-10%",
                "icon": "👑"
            })
        elif user_type == "new_user":
            factor = 0.93
            final_price *= factor
            adjustments.append({
                "factor": "Welcome Offer",
                "description": "7% welcome discount for new users",
                "impact": "-7%",
                "icon": "🎉"
            })
        elif user_type == "low_spender":
            factor = 0.95
            final_price *= factor
            adjustments.append({
                "factor": "Budget Friendly",
                "description": "5% discount to encourage purchase",
                "impact": "-5%",
                "icon": "💚"
            })

    # ── Safety: never go below 70% of base ──
    final_price = max(final_price, base_price * 0.70)
    final_price = round(final_price, 2)

    total_savings = round(base_price - final_price, 2)
    savings_percent = round((total_savings / base_price) * 100, 1) if base_price > 0 else 0

    # Build explanation string
    if savings_percent > 0:
        explanation = f"Price reduced by {savings_percent}% based on {len(adjustments)} factor(s)"
    elif savings_percent < 0:
        explanation = f"Price increased by {abs(savings_percent)}% due to market conditions"
    else:
        explanation = "Base price — no adjustments needed"

    return jsonify({
        "product_id": product_id,
        "base_price": base_price,
        "final_price": final_price,
        "total_savings": total_savings,
        "savings_percent": savings_percent,
        "explanation": explanation,
        "adjustments": adjustments,
        "user_segment": user["user_type"] if user else "anonymous"
    })


# ═══════════════════════════════════════════════════════════════
# 🎯 RECOMMENDATIONS
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/recommendations/<product_id>", methods=["GET"])
def get_recommendations(product_id, user_id=None):
    """
    Return multi-strategy recommendations:
    - category_based: products in the same category
    - session_based: products related to user's browsing session
    - trending: currently popular items
    """
    user_id = request.args.get("user_id", user_id)
    product = PRODUCT_MAP.get(product_id)

    if not product:
        return jsonify({"error": "Product not found"}), 404

    category = product["category"]

    # ── Category-based recommendations ──
    cat_products = [
        p for p in PRODUCTS
        if p["category"] == category and p["product_id"] != product_id
    ]
    random.shuffle(cat_products)
    cat_recs = cat_products[:4]

    # ── Session-based recommendations ──
    session_recs = []
    if user_id and user_id in SESSIONS:
        viewed_ids = SESSIONS[user_id].get("products_viewed", [])
        viewed_categories = set()
        for vid in viewed_ids:
            vp = PRODUCT_MAP.get(vid)
            if vp:
                viewed_categories.add(vp["category"])

        # Products from categories the user has browsed, excluding current
        session_candidates = [
            p for p in PRODUCTS
            if p["category"] in viewed_categories
            and p["product_id"] != product_id
            and p["product_id"] not in viewed_ids
        ]
        random.shuffle(session_candidates)
        session_recs = session_candidates[:4]

    # ── Trending recommendations ──
    product_counts = Counter(e["product_id"] for e in EVENTS)
    top_pids = [pid for pid, _ in product_counts.most_common(8) if pid != product_id]
    trending_recs = [PRODUCT_MAP[pid] for pid in top_pids if pid in PRODUCT_MAP][:4]

    return jsonify({
        "product_id": product_id,
        "category_based": {
            "explanation": f"Similar products in {category}",
            "products": cat_recs
        },
        "session_based": {
            "explanation": "Based on your browsing history" if session_recs else "Browse more products to unlock",
            "products": session_recs
        },
        "trending": {
            "explanation": "Popular with other shoppers right now",
            "products": trending_recs
        }
    })


# ═══════════════════════════════════════════════════════════════
# 📊 DASHBOARD
# ═══════════════════════════════════════════════════════════════

@api_bp.route("/dashboard", methods=["GET"])
def get_dashboard():
    """Return aggregate stats for the dashboard."""
    categories = sorted(set(p["category"] for p in PRODUCTS))
    active_sessions = sum(
        1 for s in SESSIONS.values()
        if len(s.get("products_viewed", [])) > 0
    )

    return jsonify({
        "total_products": len(PRODUCTS),
        "total_events": len(EVENTS),
        "total_users": len(USERS),
        "active_sessions": active_sessions,
        "categories": categories
    })
