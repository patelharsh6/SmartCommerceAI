"""
utils/stream_worker.py
======================
Background worker — reads Redis Streams → computes real-time features
                  → writes to Redis Feature Store

Run standalone:
    python -m utils.stream_worker

Or start from FastAPI lifespan (main.py):
    import asyncio, threading
    from utils.stream_worker import start_worker_thread
    start_worker_thread()        # non-blocking
"""

import time
import json
import threading
import logging
from datetime import datetime
from collections import defaultdict

from app.extensions import (
    ensure_consumer_group,
    xread_pending,
    xack_event,
)
from app.data_store import (
    get_session_features,
    set_session_features,
    update_session_feature,
    increment_session_length,
    increment_category_affinity,
    set_competitor_price_redis,
    PRODUCT_MAP,          # in-memory product catalog
)
from app.db import get_redis

logger = logging.getLogger("stream_worker")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")

# ─────────────────────────────────────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────────────────────────────────────

POLL_INTERVAL   = 0.2   # seconds between poll loops
BATCH_SIZE      = 50    # messages per xreadgroup call
WORKER_RUNNING  = True  # set False to stop the loop cleanly


# ─────────────────────────────────────────────────────────────────────────────
# Feature computation helpers
# ─────────────────────────────────────────────────────────────────────────────

EVENT_WEIGHTS = {
    "page_view" : 0.05,
    "search"    : 0.10,
    "cart"      : 0.40,
    "purchase"  : 1.00,
    "wishlist"  : 0.25,
}

INTENT_THRESHOLDS = {
    "cart"     : 0.65,
    "wishlist" : 0.40,
    "search"   : 0.20,
    "page_view": 0.08,
}


def _compute_engagement(session_length: int, last_event_type: str) -> float:
    """Simple engagement score 0-1 based on session depth and last action."""
    depth_score  = min(session_length / 20.0, 1.0)   # saturates at 20 events
    action_score = EVENT_WEIGHTS.get(last_event_type, 0.05)
    return round(0.6 * depth_score + 0.4 * action_score, 4)


def _compute_intent(last_event_type: str, session_length: int, engagement: float) -> float:
    """Purchase intent probability 0-1."""
    base = INTENT_THRESHOLDS.get(last_event_type, 0.05)
    boost = engagement * 0.2
    return round(min(base + boost, 1.0), 4)


def _estimate_wtp(user_id: str, product_id: str, intent: float) -> float:
    """
    Willingness-to-pay estimate relative to base price.
    High-intent users get closer to (or above) base price.
    Falls back to 0.0 if product not in catalog.
    """
    product = PRODUCT_MAP.get(product_id)
    if not product:
        return 0.0
    base = product["base_price"]
    # intent 0→0.7, intent 1→1.1  (linear interpolation)
    multiplier = 0.70 + intent * 0.40
    return round(base * multiplier, 2)


def _get_category(product_id: str) -> str | None:
    p = PRODUCT_MAP.get(product_id)
    return p["category"] if p else None


# ─────────────────────────────────────────────────────────────────────────────
# Clickstream event processor
# ─────────────────────────────────────────────────────────────────────────────

def _process_clickstream_event(fields: dict):
    """
    Called for every message on events:clickstream.
    fields keys: user_id, session_id, product_id, event_type, server_ts
    """
    session_id   = fields.get("session_id", "")
    user_id      = fields.get("user_id", "")
    product_id   = fields.get("product_id", "")
    event_type   = fields.get("event_type", "page_view")

    if not session_id:
        return

    # ── 1. Read or initialise session features ────────────────────────────
    features = get_session_features(session_id) or {
        "engagement_score"   : 0.0,
        "intent_probability" : 0.0,
        "wtp_estimate"       : 0.0,
        "category_affinity"  : [],
        "session_length"     : 0,
        "last_event_type"    : event_type,
        "last_product_id"    : product_id,
        "user_id"            : user_id,
    }

    # ── 2. Update counters ────────────────────────────────────────────────
    session_length = int(features.get("session_length", 0)) + 1
    engagement     = _compute_engagement(session_length, event_type)
    intent         = _compute_intent(event_type, session_length, engagement)
    wtp            = _estimate_wtp(user_id, product_id, intent)

    # ── 3. Merge updated features ─────────────────────────────────────────
    features.update({
        "session_length"     : session_length,
        "last_event_type"    : event_type,
        "last_product_id"    : product_id,
        "engagement_score"   : engagement,
        "intent_probability" : intent,
        "wtp_estimate"       : wtp,
        "user_id"            : user_id,
        "updated_at"         : datetime.utcnow().isoformat(),
    })
    set_session_features(session_id, features)

    # ── 4. Update per-user category affinity ─────────────────────────────
    if user_id and product_id:
        category = _get_category(product_id)
        if category:
            delta = EVENT_WEIGHTS.get(event_type, 0.05)
            increment_category_affinity(user_id, category, delta)

    logger.debug(
        "Processed %s | session=%s intent=%.2f wtp=%.2f",
        event_type, session_id, intent, wtp,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Competitor pricing event processor
# ─────────────────────────────────────────────────────────────────────────────

def _process_competitor_event(fields: dict):
    """
    Called for every message on events:competitor_pricing.
    fields keys: product_id, competitor, price, timestamp
    """
    product_id = fields.get("product_id", "")
    competitor = fields.get("competitor", "unknown")
    price_raw  = fields.get("price", "0")

    try:
        price = float(price_raw)
    except ValueError:
        return

    if not product_id:
        return

    # Read existing competitor prices for this product and merge
    r = get_redis()
    key = f"competitor:{product_id}"
    existing = r.hgetall(key)

    prices_float = {}
    for k, v in existing.items():
        if k not in ("min", "max"):
            try:
                prices_float[k] = float(v)
            except ValueError:
                pass

    prices_float[competitor] = price

    # Recompute min/max
    all_prices = list(prices_float.values())
    update = {
        **{k: str(v) for k, v in prices_float.items()},
        "min": str(min(all_prices)),
        "max": str(max(all_prices)),
    }
    set_competitor_price_redis(product_id, update)

    logger.debug("Competitor price updated | product=%s %s=%.2f", product_id, competitor, price)


# ─────────────────────────────────────────────────────────────────────────────
# Main worker loop
# ─────────────────────────────────────────────────────────────────────────────

STREAM_HANDLERS = {
    "clickstream"        : _process_clickstream_event,
    "competitor_pricing" : _process_competitor_event,
}


def run_worker():
    """
    Blocking loop — call from a thread or separate process.
    Reads both streams in round-robin and processes each batch.
    """
    global WORKER_RUNNING

    logger.info("Stream worker starting up …")

    # Ensure consumer groups exist for both streams
    for stream_name in STREAM_HANDLERS:
        try:
            ensure_consumer_group(stream_name)
        except Exception as e:
            logger.error("Could not create consumer group for '%s': %s", stream_name, e)

    logger.info("Stream worker ready — polling every %.1fs", POLL_INTERVAL)

    while WORKER_RUNNING:
        processed_any = False

        for stream_name, handler in STREAM_HANDLERS.items():
            try:
                messages = xread_pending(stream_name, count=BATCH_SIZE)
            except Exception as e:
                logger.warning("xread_pending failed on '%s': %s", stream_name, e)
                messages = []

            for msg in messages:
                try:
                    handler(msg["fields"])
                    xack_event(stream_name, msg["id"])
                    processed_any = True
                except Exception as e:
                    logger.error(
                        "Error processing message %s on %s: %s",
                        msg.get("id"), stream_name, e,
                    )

        # Only sleep if both streams were empty — keeps latency low under load
        if not processed_any:
            time.sleep(POLL_INTERVAL)


def stop_worker():
    global WORKER_RUNNING
    WORKER_RUNNING = False
    logger.info("Stream worker stopping …")


# ─────────────────────────────────────────────────────────────────────────────
# Thread launcher (for use inside FastAPI lifespan)
# ─────────────────────────────────────────────────────────────────────────────

def start_worker_thread() -> threading.Thread:
    """
    Start the worker in a daemon thread so it dies with the main process.

    Usage in main.py / FastAPI lifespan:
        from utils.stream_worker import start_worker_thread
        start_worker_thread()
    """
    t = threading.Thread(target=run_worker, daemon=True, name="stream-worker")
    t.start()
    logger.info("Stream worker thread started (id=%s)", t.ident)
    return t


# ─────────────────────────────────────────────────────────────────────────────
# Standalone entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    run_worker()
