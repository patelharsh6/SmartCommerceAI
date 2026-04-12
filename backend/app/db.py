import os
import redis
import certifi
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────
# MongoDB (your existing Atlas setup — unchanged)
# ─────────────────────────────────────────────

MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb+srv://SmartCommerce-AI:SmartCommerce-AI@signintrial.mv4lwkb.mongodb.net/"
)

client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client["smartcommerce"]

# ── Your existing collections ──────────────────
users_collection  = db["users"]
carts_collection  = db["carts"]
orders_collection = db["orders"]

# ── New collections for the ML pipeline ────────
ab_experiments_collection = db["ab_experiments"]
"""
Schema:
{
    experiment_id : str,       # e.g. "exp_pricing_v1"
    variant       : "A" | "B",
    user_id       : str,
    product_id    : str,
    event         : "impression" | "click" | "purchase",
    price_shown   : float,
    session_id    : str,
    timestamp     : datetime
}
"""

pricing_logs_collection = db["pricing_logs"]
"""
Schema — every price decision logged for fairness audit:
{
    session_id   : str,
    user_id      : str,
    product_id   : str,
    final_price  : float,
    base_price   : float,
    discount_pct : float,
    reason       : str,   # shown to user in UI
    timestamp    : datetime
}
"""

# ─────────────────────────────────────────────
# Redis (new — feature store + event stream)
# ─────────────────────────────────────────────

REDIS_HOST     = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT     = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
REDIS_DB       = int(os.getenv("REDIS_DB", 0))

_redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    """
    Returns a shared Redis client.
    Lazy-initialised so import doesn't crash if Redis isn't running yet.
    """
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            password=REDIS_PASSWORD,
            db=REDIS_DB,
            decode_responses=True,   # always return str, not bytes
            socket_connect_timeout=3,
        )
        try:
            _redis_client.ping()
            print("[DB] Redis connected successfully")
        except redis.ConnectionError as e:
            print(f"[DB] Redis connection failed: {e}")
            raise
    return _redis_client


# ─────────────────────────────────────────────
# Startup health check
# ─────────────────────────────────────────────

def check_connections():
    """Call this inside your FastAPI/Flask startup event."""
    try:
        client.admin.command("ping")
        print("[DB] MongoDB connected successfully")
    except Exception as e:
        print(f"[DB] MongoDB ping failed: {e}")

    get_redis()   # will print its own status