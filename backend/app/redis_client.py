"""
redis_client.py
===============
Centralised Redis connection — imported by extensions.py, data_store.py,
stream_worker.py, etc.  Lazy-initialised so import never crashes.
"""

import os
import redis
from dotenv import load_dotenv

load_dotenv()

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
            print("[Redis] Connected successfully")
        except redis.ConnectionError as e:
            print(f"[Redis] ⚠️  Connection failed: {e} — features requiring Redis will be unavailable")
    return _redis_client
