import os
import time
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
from app.db import get_redis

load_dotenv()

# ─────────────────────────────────────────────
# Your existing init_db (unchanged)
# ─────────────────────────────────────────────

client = None
db     = None


def init_db(app):
    global client, db
    client = MongoClient(os.getenv("MONGO_URI"))
    db = client.get_database("SmartCommerce-AI")


# ─────────────────────────────────────────────
# Redis Streams — replaces Kafka for hackathon
#
# Key layout:
#   events:clickstream        ← user actions (view, cart, purchase)
#   events:competitor_pricing ← competitor price updates
# ─────────────────────────────────────────────

STREAM_PREFIX    = "events"
CONSUMER_GROUP   = "smartcommerce-workers"
CONSUMER_NAME    = "stream-worker-1"
MAX_STREAM_LEN   = 100_000   # trim so RAM doesn't blow up


def _stream_key(name: str) -> str:
    return f"{STREAM_PREFIX}:{name}"


# ── Producer ──────────────────────────────────────────────────────────────────

def xadd_event(stream_name: str, fields: dict) -> str:
    """
    Push one event onto a Redis Stream.

    Call this from your API route on every user action.

    Args:
        stream_name : "clickstream" | "competitor_pricing"
        fields      : dict — all values must be strings

    Example:
        xadd_event("clickstream", {
            "user_id"    : "U001",
            "session_id" : "sess_abc",
            "product_id" : "P002",
            "event_type" : "cart",     # page_view | search | cart | purchase
        })

    Returns:
        Redis message ID string e.g. "1712345678901-0"
    """
    r = get_redis()
    fields["server_ts"] = str(int(time.time() * 1000))
    return r.xadd(
        _stream_key(stream_name),
        fields,
        maxlen=MAX_STREAM_LEN,
        approximate=True,
    )


def xadd_competitor_price(product_id: str, competitor: str, price: float) -> str:
    """Shortcut for competitor pricing events."""
    return xadd_event("competitor_pricing", {
        "product_id" : product_id,
        "competitor" : competitor,
        "price"      : str(price),
        "timestamp"  : str(datetime.utcnow()),
    })


# ── Consumer group setup ──────────────────────────────────────────────────────

def ensure_consumer_group(stream_name: str):
    """
    Create the consumer group if it doesn't exist yet.
    Call once at stream_worker.py startup.
    """
    r = get_redis()
    key = _stream_key(stream_name)

    if not r.exists(key):
        r.xadd(key, {"init": "true"})  # stream must exist before group creation

    try:
        r.xgroup_create(key, CONSUMER_GROUP, id="0", mkstream=True)
        print(f"[Streams] Group '{CONSUMER_GROUP}' created on '{key}'")
    except Exception as e:
        if "BUSYGROUP" not in str(e):
            raise


# ── Consumer ──────────────────────────────────────────────────────────────────

def xread_pending(stream_name: str, count: int = 50) -> list[dict]:
    """
    Read up to `count` unprocessed messages from the stream.
    Messages stay in the PEL until xack_event() is called.

    Returns: [{"id": "...", "fields": {...}}, ...]
    """
    r = get_redis()
    results = r.xreadgroup(
        groupname=CONSUMER_GROUP,
        consumername=CONSUMER_NAME,
        streams={_stream_key(stream_name): ">"},
        count=count,
        block=500,    # wait up to 500ms if stream is empty
    )

    if not results:
        return []

    messages = []
    for _stream, entries in results:
        for msg_id, fields in entries:
            messages.append({"id": msg_id, "fields": fields})
    return messages


def xack_event(stream_name: str, msg_id: str):
    """
    Acknowledge a message after it's been processed.
    Without this, the message will be redelivered on next xread_pending().
    """
    get_redis().xack(_stream_key(stream_name), CONSUMER_GROUP, msg_id)


# ── Debug helpers ─────────────────────────────────────────────────────────────

def stream_length(stream_name: str) -> int:
    return get_redis().xlen(_stream_key(stream_name))


def stream_latest(stream_name: str, count: int = 5) -> list[dict]:
    """Peek at the latest N events — useful for debugging."""
    r = get_redis()
    results = r.xrevrange(_stream_key(stream_name), count=count)
    return [{"id": mid, "fields": f} for mid, f in results]