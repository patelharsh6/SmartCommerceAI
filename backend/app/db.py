import os
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

try:
    client = MongoClient(
        MONGO_URI,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=5000,
    )
    # Quick connectivity test (non-blocking — just validates the URI)
    client.admin.command("ping")
    db = client["smartcommerce"]
    print("[DB] MongoDB connected successfully")
except Exception as e:
    print(f"[DB] ⚠️  MongoDB connection failed ({e}). Running in offline mode.")
    client = None
    db = None

# ── Your existing collections (safe even if db is None) ──────
users_collection = db["users"] if db else None
carts_collection = db["carts_collection"] if db else None
orders_collection = db["orders"] if db else None

# ── New collections for the ML pipeline ────────
ab_experiments_collection = db["ab_experiments"] if db else None
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

pricing_logs_collection = db["pricing_logs"] if db else None
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
# Redis — re-export from the canonical module
# ─────────────────────────────────────────────
from app.redis_client import get_redis  # noqa: F401 (re-export for compat)


# ─────────────────────────────────────────────
# Startup health check
# ─────────────────────────────────────────────

def check_connections():
    """Call this inside your Flask startup event."""
    if client is not None:
        try:
            client.admin.command("ping")
            print("[DB] MongoDB connected successfully")
        except Exception as e:
            print(f"[DB] MongoDB ping failed: {e}")
    else:
        print("[DB] MongoDB client is None — skipping ping")

    try:
        get_redis()  # will print its own status
    except Exception as e:
        print(f"[DB] Redis health check failed: {e}")