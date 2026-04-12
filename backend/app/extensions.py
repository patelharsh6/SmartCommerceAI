import os
import time
from datetime import datetime
from pymongo import MongoClient
from dotenv import load_dotenv
import certifi

# ✅ FIXED IMPORT (no circular issue)
from app.redis_client import get_redis

load_dotenv()

# ─────────────────────────────────────────────
# MongoDB Setup (FINAL)
# ─────────────────────────────────────────────

client = None
db = None


def init_db(app):
    global client, db

    mongo_uri = os.getenv(
        "MONGO_URI",
        "mongodb+srv://SmartCommerce-AI:SmartCommerce-AI@signintrial.mv4lwkb.mongodb.net/"
    )

    print(f"[DB] Connecting to MongoDB: {mongo_uri[:40]}...")

    client = MongoClient(
        mongo_uri,
        tlsCAFile=certifi.where()
    )

    db = client.get_database("SmartCommerce-AI")

    print(f"[DB] Connected to database: {db.name}")

    try:
        print(f"[DB] Collections: {db.list_collection_names()}")
    except Exception:
        print("[DB] First run - no collections yet")


# ─────────────────────────────────────────────
# Redis Streams
# ─────────────────────────────────────────────

STREAM_PREFIX = "events"
CONSUMER_GROUP = "smartcommerce-workers"
CONSUMER_NAME = "stream-worker-1"
MAX_STREAM_LEN = 100_000


def _stream_key(name: str) -> str:
    return f"{STREAM_PREFIX}:{name}"


# ── Producer ─────────────────────────────────

def xadd_event(stream_name: str, fields: dict) -> str:
    r = get_redis()

    fields["server_ts"] = str(int(time.time() * 1000))

    return r.xadd(
        _stream_key(stream_name),
        fields,
        maxlen=MAX_STREAM_LEN,
        approximate=True,
    )


def xadd_competitor_price(product_id: str, competitor: str, price: float) -> str:
    return xadd_event("competitor_pricing", {
        "product_id": product_id,
        "competitor": competitor,
        "price": str(price),
        "timestamp": str(datetime.utcnow()),
    })


# ── Consumer Group ───────────────────────────

def ensure_consumer_group(stream_name: str):
    r = get_redis()
    key = _stream_key(stream_name)

    if not r.exists(key):
        r.xadd(key, {"init": "true"})

    try:
        r.xgroup_create(key, CONSUMER_GROUP, id="0", mkstream=True)
        print(f"[Streams] Group '{CONSUMER_GROUP}' created on '{key}'")
    except Exception as e:
        if "BUSYGROUP" not in str(e):
            raise


# ── Consumer ─────────────────────────────────

def xread_pending(stream_name: str, count: int = 50) -> list[dict]:
    r = get_redis()

    results = r.xreadgroup(
        groupname=CONSUMER_GROUP,
        consumername=CONSUMER_NAME,
        streams={_stream_key(stream_name): ">"},
        count=count,
        block=500,
    )

    if not results:
        return []

    messages = []
    for _stream, entries in results:
        for msg_id, fields in entries:
            messages.append({"id": msg_id, "fields": fields})

    return messages


def xack_event(stream_name: str, msg_id: str):
    get_redis().xack(_stream_key(stream_name), CONSUMER_GROUP, msg_id)


# ── Debug Helpers ────────────────────────────

def stream_length(stream_name: str) -> int:
    return get_redis().xlen(_stream_key(stream_name))


def stream_latest(stream_name: str, count: int = 5) -> list[dict]:
    r = get_redis()

    results = r.xrevrange(_stream_key(stream_name), count=count)

    return [{"id": mid, "fields": f} for mid, f in results]