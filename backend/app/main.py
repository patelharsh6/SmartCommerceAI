"""
Main FastAPI Application - Backend + Integration (Harsh's Role)
Connects all services: Recommendations (Het), Pricing (Anuj), Sessions (Ansh)
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime

from app.data_store import PRODUCTS, PRODUCT_MAP, EVENTS, USERS, SESSIONS
from app.services.recommendation_service import (
    get_trending_products,
    get_category_recommendations,
    get_full_recommendations
)
from app.services.pricing_service import get_dynamic_price
from app.services.session_service import get_session, update_session, get_session_summary


# ═══════════════════════════════════════════════════════════════
# 🚀 APP INITIALIZATION
# ═══════════════════════════════════════════════════════════════

app = FastAPI(
    title="Dynamic Pricing & Recommendation API",
    description="E-Commerce system with real-time pricing, recommendations, and session tracking",
    version="1.0.0"
)

# CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════
# 📝 REQUEST MODELS
# ═══════════════════════════════════════════════════════════════

class EventRequest(BaseModel):
    user_id: str
    product_id: str
    event_type: str = "view"  # view, click, add_to_cart


# ═══════════════════════════════════════════════════════════════
# ❤️ HEALTH CHECK
# ═══════════════════════════════════════════════════════════════

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "message": "Dynamic Pricing API is running",
        "timestamp": datetime.now().isoformat(),
        "stats": {
            "total_products": len(PRODUCTS),
            "total_events": len(EVENTS),
            "total_users": len(USERS)
        }
    }


# ═══════════════════════════════════════════════════════════════
# 📦 PRODUCT ENDPOINTS
# ═══════════════════════════════════════════════════════════════

@app.get("/api/products")
def list_products(category: str = None):
    """GET /api/products - List all products, optionally filter by category"""
    products = PRODUCTS
    if category:
        products = [p for p in PRODUCTS if p["category"].lower() == category.lower()]

    categories = list(set(p["category"] for p in PRODUCTS))
    return {
        "products": products,
        "total": len(products),
        "categories": sorted(categories)
    }


@app.get("/api/products/{product_id}")
def get_product(product_id: str):
    """GET /api/products/{id} - Get single product details"""
    product = PRODUCT_MAP.get(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


# ═══════════════════════════════════════════════════════════════
# 📊 EVENT TRACKING
# ═══════════════════════════════════════════════════════════════

@app.post("/api/events")
def record_event(event: EventRequest):
    """POST /api/events - Record a user interaction event"""
    # Validate product exists
    if event.product_id not in PRODUCT_MAP:
        raise HTTPException(status_code=404, detail="Product not found")

    # Store event
    new_event = {
        "event_id": f"E{len(EVENTS)+1:05d}",
        "user_id": event.user_id,
        "product_id": event.product_id,
        "event_type": event.event_type,
        "timestamp": datetime.now().isoformat()
    }
    EVENTS.append(new_event)

    # Update session
    update_session(event.user_id, event.product_id)

    return {
        "status": "recorded",
        "event": new_event,
        "message": f"Event '{event.event_type}' recorded for product {event.product_id}"
    }


# ═══════════════════════════════════════════════════════════════
# 🎯 RECOMMENDATION ENDPOINTS (Het + Ansh)
# ═══════════════════════════════════════════════════════════════

@app.get("/api/recommendations/{product_id}")
def get_recommendations(product_id: str, user_id: str = None):
    """GET /api/recommendations/{product_id} - Get personalized recommendations"""
    if product_id not in PRODUCT_MAP:
        raise HTTPException(status_code=404, detail="Product not found")

    recommendations = get_full_recommendations(product_id, user_id)
    return recommendations


@app.get("/api/trending")
def trending_products(limit: int = 5):
    """GET /api/trending - Get trending products"""
    trending = get_trending_products(limit)
    return {
        "trending": trending,
        "explanation": "Products ranked by real-time user interaction frequency",
        "total_events": len(EVENTS)
    }


# ═══════════════════════════════════════════════════════════════
# 💰 DYNAMIC PRICING ENDPOINTS (Anuj)
# ═══════════════════════════════════════════════════════════════

@app.get("/api/price/{product_id}/{user_id}")
def get_price(product_id: str, user_id: str):
    """GET /api/price/{product_id}/{user_id} - Get dynamically adjusted price"""
    if product_id not in PRODUCT_MAP:
        raise HTTPException(status_code=404, detail="Product not found")

    pricing = get_dynamic_price(product_id, user_id)
    return pricing


@app.get("/api/price/{product_id}")
def get_price_guest(product_id: str):
    """GET /api/price/{product_id} - Get price for guest user"""
    if product_id not in PRODUCT_MAP:
        raise HTTPException(status_code=404, detail="Product not found")

    pricing = get_dynamic_price(product_id)
    return pricing


# ═══════════════════════════════════════════════════════════════
# 🧑 USER & SESSION ENDPOINTS (Ansh)
# ═══════════════════════════════════════════════════════════════

@app.get("/api/users")
def list_users():
    """GET /api/users - List all user profiles"""
    return {"users": list(USERS.values())}


@app.get("/api/session/{user_id}")
def get_user_session(user_id: str):
    """GET /api/session/{user_id} - Get user session data"""
    return get_session_summary(user_id)


# ═══════════════════════════════════════════════════════════════
# 📊 DASHBOARD / ANALYTICS
# ═══════════════════════════════════════════════════════════════

@app.get("/api/dashboard")
def get_dashboard():
    """GET /api/dashboard - Get system overview stats"""
    from collections import Counter

    event_counts = Counter(e["product_id"] for e in EVENTS)
    category_counts = Counter(e["event_type"] for e in EVENTS)

    return {
        "total_products": len(PRODUCTS),
        "total_events": len(EVENTS),
        "total_users": len(USERS),
        "active_sessions": len([s for s in SESSIONS.values() if s["products_viewed"]]),
        "categories": list(set(p["category"] for p in PRODUCTS)),
        "event_breakdown": dict(category_counts),
        "top_products": [
            {"product_id": pid, "name": PRODUCT_MAP[pid]["name"], "events": count}
            for pid, count in event_counts.most_common(5)
        ]
    }
