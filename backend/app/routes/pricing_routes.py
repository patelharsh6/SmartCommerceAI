"""
routes/pricing_routes.py
========================
Flask Blueprint — Dynamic Pricing API

Endpoints:
  POST /api/pricing/price          → dynamic price for product + session
  POST /api/pricing/event          → ingest user event into Redis Stream
  GET  /api/pricing/explain/<pid>  → price explanation widget data
"""

import logging
from datetime import datetime

from flask import Blueprint, request, jsonify

from app.db import pricing_logs_collection
from app.data_store import (
    get_price_cache,
    set_price_cache,
    get_session_features_or_default,
    get_competitor_price_redis,
    PRODUCT_MAP,
)
from app.extensions import xadd_event
from app.dynamic_pricing_model import predict_price   # your existing model

logger     = logging.getLogger("pricing_routes")
pricing_bp = Blueprint("pricing", __name__, url_prefix="/api/pricing")


# ─────────────────────────────────────────────────────────────────────────────
# Business rules
# ─────────────────────────────────────────────────────────────────────────────

MIN_MARGIN_PCT   = 0.10
MAX_DISCOUNT_PCT = 0.30
MAX_PREMIUM_PCT  = 0.20


def _apply_business_rules(raw_price: float, base_price: float):
    min_price = base_price * (1 - MAX_DISCOUNT_PCT)
    max_price = base_price * (1 + MAX_PREMIUM_PCT)
    floor     = base_price * MIN_MARGIN_PCT

    if raw_price < floor:
        return round(floor, 2), "Minimum margin floor applied"
    if raw_price < min_price:
        return round(min_price, 2), f"Discount capped at {int(MAX_DISCOUNT_PCT*100)}%"
    if raw_price > max_price:
        return round(max_price, 2), f"Premium capped at {int(MAX_PREMIUM_PCT*100)}%"
    return round(raw_price, 2), ""


def _build_reason(final_price, base_price, intent, engagement, rule_reason):
    if rule_reason:
        return rule_reason
    discount_pct = (base_price - final_price) / base_price
    if intent > 0.6:
        return "Price adjusted based on high purchase intent in your session"
    if engagement > 0.7:
        return "Personalised price based on your browsing activity"
    if discount_pct > 0.15:
        return f"You're getting a {int(discount_pct*100)}% discount — demand is lower right now"
    if final_price > base_price:
        return "Price slightly higher due to current high demand"
    return "Competitive price based on current market conditions"


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/pricing/price
# ─────────────────────────────────────────────────────────────────────────────

@pricing_bp.route("/price", methods=["POST"])
def get_dynamic_price():
    body = request.get_json(silent=True) or {}
    product_id = body.get("product_id")
    user_id    = body.get("user_id")
    session_id = body.get("session_id")
    variant    = body.get("variant", "A")

    if not all([product_id, user_id, session_id]):
        return jsonify({"error": "product_id, user_id, session_id are required"}), 400

    product = PRODUCT_MAP.get(product_id)
    if not product:
        return jsonify({"error": f"Product '{product_id}' not found"}), 404

    base_price = product["base_price"]

    # 1. Cache check
    cached = get_price_cache(product_id, user_id)
    if cached:
        return jsonify({
            "product_id"   : product_id,
            "user_id"      : user_id,
            "final_price"  : cached["price"],
            "base_price"   : base_price,
            "discount_pct" : round((base_price - cached["price"]) / base_price * 100, 1),
            "reason"       : cached.get("reason", "Cached price"),
            "cache_hit"    : True,
        })

    # 2. Load session features from Redis
    features   = get_session_features_or_default(session_id)
    intent     = float(features.get("intent_probability", 0.05))
    wtp        = float(features.get("wtp_estimate", base_price * 0.9))
    engagement = float(features.get("engagement_score", 0.1))

    competitor = get_competitor_price_redis(product_id)
    comp_min   = competitor.get("min") if competitor else None

    # 3. Model prediction
    try:
        raw_price = predict_price(
            product_id       = product_id,
            base_price       = base_price,
            intent_prob      = intent,
            wtp_estimate     = wtp,
            engagement_score = engagement,
            competitor_min   = comp_min,
        )
    except Exception as e:
        logger.warning("predict_price failed (%s), falling back to base_price", e)
        raw_price = base_price

    # 4. Business rules
    final_price, rule_reason = _apply_business_rules(raw_price, base_price)
    reason       = _build_reason(final_price, base_price, intent, engagement, rule_reason)
    discount_pct = round((base_price - final_price) / base_price * 100, 1)

    # 5. Cache + log to MongoDB
    set_price_cache(product_id, user_id, final_price, reason)

    try:
        pricing_logs_collection.insert_one({
            "session_id"   : session_id,
            "user_id"      : user_id,
            "product_id"   : product_id,
            "final_price"  : final_price,
            "base_price"   : base_price,
            "discount_pct" : discount_pct,
            "reason"       : reason,
            "variant"      : variant,
            "timestamp"    : datetime.utcnow(),
        })
    except Exception as e:
        logger.warning("MongoDB pricing log failed: %s", e)

    return jsonify({
        "product_id"    : product_id,
        "user_id"       : user_id,
        "final_price"   : final_price,
        "base_price"    : base_price,
        "discount_pct"  : discount_pct,
        "reason"        : reason,
        "cache_hit"     : False,
        "competitor_min": comp_min,
    })


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/pricing/event
# ─────────────────────────────────────────────────────────────────────────────

@pricing_bp.route("/event", methods=["POST"])
def ingest_event():
    body       = request.get_json(silent=True) or {}
    user_id    = body.get("user_id")
    session_id = body.get("session_id")
    product_id = body.get("product_id")
    event_type = body.get("event_type")

    valid_events = {"page_view", "search", "cart", "purchase", "wishlist"}
    if not all([user_id, session_id, product_id, event_type]):
        return jsonify({"error": "user_id, session_id, product_id, event_type are required"}), 400
    if event_type not in valid_events:
        return jsonify({"error": f"event_type must be one of {valid_events}"}), 400

    try:
        msg_id = xadd_event("clickstream", {
            "user_id"    : user_id,
            "session_id" : session_id,
            "product_id" : product_id,
            "event_type" : event_type,
        })
    except Exception as e:
        logger.error("xadd_event failed: %s", e)
        return jsonify({"error": "Event stream unavailable"}), 503

    return jsonify({"status": "queued", "stream_msg_id": msg_id})


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/pricing/explain/<product_id>
# ─────────────────────────────────────────────────────────────────────────────

@pricing_bp.route("/explain/<product_id>", methods=["GET"])
def explain_price(product_id):
    user_id    = request.args.get("user_id", "")
    session_id = request.args.get("session_id", "")

    product = PRODUCT_MAP.get(product_id)
    if not product:
        return jsonify({"error": f"Product '{product_id}' not found"}), 404

    features   = get_session_features_or_default(session_id)
    cached     = get_price_cache(product_id, user_id)
    competitor = get_competitor_price_redis(product_id)

    base_price  = product["base_price"]
    final_price = cached["price"] if cached else base_price
    discount    = round((base_price - final_price) / base_price * 100, 1)

    return jsonify({
        "product_id"      : product_id,
        "product_name"    : product["name"],
        "base_price"      : base_price,
        "your_price"      : final_price,
        "discount_pct"    : discount,
        "reason"          : cached["reason"] if cached else "Standard pricing",
        "session_signals" : {
            "intent_probability" : float(features.get("intent_probability", 0)),
            "engagement_score"   : float(features.get("engagement_score", 0)),
            "wtp_estimate"       : float(features.get("wtp_estimate", 0)),
            "session_length"     : int(features.get("session_length", 0)),
            "last_event"         : features.get("last_event_type", "—"),
        },
        "competitor_min"  : competitor.get("min") if competitor else None,
        "is_cached"       : bool(cached),
    })