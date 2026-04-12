"""
Admin API Routes  —  /api/admin/...
Backs the AdminPage.jsx React frontend.

All endpoints are crash-safe: exceptions return JSON 500, never kill the server.
Mount this blueprint in your Flask app alongside api_bp.
"""

from flask import Blueprint, jsonify, request
from datetime import datetime
from collections import defaultdict
import traceback
import pandas as _pd
import numpy as _np

# ✅ IMPORT THE MODULE CONTAINER
# Lookups via ext.db ensure we don't hit NoneType errors if DB initializes after import
import app.extensions as ext 

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

# ── safe imports ──────────────────────────────────────────────────────────────
try:
    from app.services.recommendation_service import (
        catalog_df, PRODUCT_LOOKUP, get_trending, ALL_CATEGORIES,
    )
    _catalog_ok = True
except Exception as e:
    print(f"[WARN] admin_routes: recommendation_service unavailable: {e}")
    _catalog_ok = False
    catalog_df    = None
    PRODUCT_LOOKUP = {}
    ALL_CATEGORIES = []
    def get_trending(top_n=10): return []

try:
    from app.routes.api_routes import (
        LIVE_EVENTS, SESSIONS,
    )
    _events_ok = True
except Exception as e:
    print(f"[WARN] admin_routes: could not import shared state from api_routes: {e}")
    _events_ok = False
    LIVE_EVENTS = []
    SESSIONS    = {}

try:
    from app.models.product_engine import ProductEngine as _PE
    _engine = _PE()
    _engine_ok = True
    print("[INFO] admin_routes: ProductEngine loaded")
except Exception as e:
    print(f"[WARN] admin_routes: ProductEngine unavailable: {e}")
    _engine_ok = False
    _engine = None


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _safe_float(v, default=0.0):
    try:    return float(v)
    except: return default

def _safe_int(v, default=0):
    try:    return int(v)
    except: return default

def _get_df():
    """Return catalog DataFrame or empty DF."""
    if _catalog_ok and catalog_df is not None and len(catalog_df) > 0:
        return catalog_df.copy()
    return _pd.DataFrame()


# ─────────────────────────────────────────────────────────────────────────────
# REVENUE & DASHBOARD
# ─────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/total-revenue", methods=["GET"])
def get_total_revenue():
    try:
        if ext.db is None:
            return jsonify({"error": "Database connection not established"}), 500

        # Aggregation to sum 'total' from all orders
        pipeline = [{"$group": {"_id": None, "total_revenue": {"$sum": "$total"}}}]
        result = list(ext.db["orders"].aggregate(pipeline))
        total_revenue = result[0]["total_revenue"] if result else 0.0

        return jsonify({
            "status": "success",
            "total_revenue": round(total_revenue, 2),
            "currency": "INR",
            "order_count": ext.db["orders"].count_documents({})
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/dashboard", methods=["GET"])
def admin_dashboard():
    try:
        if ext.db is None:
            return jsonify({"error": "Database not initialized"}), 500

        # Collection 'user' (singular) as per your database setup
        total_products = ext.db.products.count_documents({})
        total_users    = ext.db["user"].count_documents({})
        
        # Dashboard Revenue Calculation
        pipeline = [{"$group": {"_id": None, "total_rev": {"$sum": "$total"}}}]
        rev_result = list(ext.db.orders.aggregate(pipeline))
        total_revenue = rev_result[0]['total_rev'] if rev_result else 0.0

        active_carts = ext.db["carts_collection"].count_documents({})

        return jsonify({
            "total_products":   total_products,
            "total_users":      total_users,
            "total_revenue":    round(total_revenue, 2),
            "active_carts":     active_carts,
            "live_events":      len(LIVE_EVENTS),
            "status":           "live_data"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# USER & ORDER MANAGEMENT
# ─────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/allusers", methods=["GET"])
def admin_get_users():
    try:
        # 1. Verify Database Connection
        if ext.db is None:
            print("[ERROR] admin_get_users: ext.db is None")
            return jsonify({"error": "Database connection not established", "users": []}), 500

        # 2. Fetch from 'user' collection (Singular)
        # Note: If your Atlas collection is actually 'users', change "user" to "users" below
        users_cursor = ext.db["user"].find({}, {"password": 0})
        
        users_list = []
        for u in users_cursor:
            # 3. Convert ObjectId to string for JSON compatibility
            if "_id" in u:
                u["_id"] = str(u["_id"])
            users_list.append(u)
            
        # 4. Debug print to server console (check if data is actually found)
        print(f"[SUCCESS] Found {len(users_list)} users in collection 'user'")
            
        return jsonify({
            "users": users_list, 
            "total": len(users_list),
            "status": "success"
        })

    except Exception as e:
        # 5. This prints the full error stack to your terminal for debugging
        traceback.print_exc() 
        return jsonify({
            "error": str(e), 
            "users": [],
            "status": "error"
        }), 500


@admin_bp.route("/orders", methods=["GET"])
def admin_get_orders():
    try:
        if ext.db is None:
            return jsonify({"error": "DB not ready"}), 500
            
        page  = request.args.get("page", 1, type=int)
        limit = request.args.get("limit", 20, type=int)
        
        orders_cursor = ext.db.orders.find().sort("created_at", -1).skip((page-1)*limit).limit(limit)
        
        orders = []
        for o in orders_cursor:
            orders.append({
                "order_id":   o.get("order_id"),
                "email":      o.get("email"),
                "total":      o.get("total"),
                "created_at": o.get("created_at"),
                "status":     o.get("status", "completed")
            })

        total = ext.db.orders.count_documents({})
        return jsonify({
            "orders":   orders,
            "total":    total,
            "page":     page,
            "has_more": (page * limit) < total
        })
    except Exception as e:
        return jsonify({"error": str(e), "orders": []}), 500


# ─────────────────────────────────────────────────────────────────────────────
# TRENDING & PRICING
# ─────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/trending", methods=["GET"])
def admin_get_trending():
    try:
        limit    = request.args.get("limit", 10, type=int)
        trending = get_trending(top_n=limit)
        return jsonify({"trending": trending, "total": len(trending)})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"trending": [], "error": str(e)}), 500


@admin_bp.route("/refresh-pricing", methods=["POST"])
def admin_refresh_pricing():
    try:
        if not _engine_ok or _engine is None:
            return jsonify({
                "status": "ok",
                "message": "ProductEngine not loaded — pricing refresh skipped",
                "updated": 0,
            })

        df      = _get_df()
        updated = 0

        if df.empty:
            return jsonify({"status": "ok", "updated": 0, "message": "No catalog data"})

        for sku_id in df["sku_id"].astype(str).tolist():
            try:
                X, product = _engine.preprocess_from_sku(sku_id)
                if X is not None:
                    _engine.get_price_prediction(X)
                    updated += 1
            except Exception:
                continue

        return jsonify({
            "status":  "ok",
            "updated": updated,
            "message": f"Ridge model re-scored {updated} SKUs",
            "timestamp": datetime.now().isoformat(),
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ─────────────────────────────────────────────────────────────────────────────
# ANALYTICS & HEALTH
# ─────────────────────────────────────────────────────────────────────────────

@admin_bp.route("/stats", methods=["GET"])
def admin_stats():
    try:
        df = _get_df()

        rev_by_cat = {}
        if not df.empty and "category" in df.columns and "base_price_usd" in df.columns:
            df["_rev"] = df["base_price_usd"].fillna(0) * df.get("inventory_count", 1).fillna(0)
            rev_by_cat = (
                df.groupby("category")["_rev"]
                  .sum()
                  .sort_values(ascending=False)
                  .head(10)
                  .round(2)
                  .to_dict()
            )

        events_by_hour = defaultdict(int)
        for e in LIVE_EVENTS:
            try:
                ts = datetime.fromisoformat(e["timestamp"])
                events_by_hour[ts.hour] += 1
            except: pass

        low_stock = []
        if not df.empty and "inventory_count" in df.columns:
            ls = df[df["inventory_count"].fillna(0) < 10].sort_values("inventory_count")
            for _, row in ls.head(10).iterrows():
                low_stock.append({
                    "sku_id":          str(row.get("sku_id", "")),
                    "product_name":    str(row.get("product_name", "")),
                    "inventory_count": _safe_int(row.get("inventory_count")),
                })

        return jsonify({
            "revenue_by_category": rev_by_cat,
            "events_by_hour":      dict(events_by_hour),
            "low_stock_products":  low_stock,
            "total_events":        len(LIVE_EVENTS),
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/health", methods=["GET"])
def admin_health():
    return jsonify({
        "status":           "ok",
        "db_connected":     ext.db is not None,
        "catalog_loaded":   _catalog_ok,
        "engine_loaded":    _engine_ok,
        "timestamp":        datetime.now().isoformat(),
    })