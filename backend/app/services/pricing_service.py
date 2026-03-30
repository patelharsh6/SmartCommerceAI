"""
Dynamic Pricing Service (Anuj's Logic)
- Demand-based pricing (view count)
- Competitor-based adjustment
- User-segment-based pricing
- Price explanation engine
"""
from collections import Counter
from app.data_store import PRODUCTS, PRODUCT_MAP, EVENTS, USERS, COMPETITOR_PRICES


def _get_product_view_count(product_id: str) -> int:
    """Count total events for a product (demand signal)"""
    return sum(1 for e in EVENTS if e["product_id"] == product_id)


def get_dynamic_price(product_id: str, user_id: str = None):
    """
    Calculate dynamic price with multiple factors:
    1. Demand-based: if views > 50 → price * 1.10
    2. Competitor-based: if competitor < our price → price * 0.95
    3. User-based: low_spender → price * 0.90, premium → price * 1.0

    Returns final price + breakdown with reasons.
    """
    product = PRODUCT_MAP.get(product_id)
    if not product:
        return {"error": "Product not found"}

    base_price = product["base_price"]
    current_price = base_price
    adjustments = []
    factors = {}

    # ─── 1. DEMAND-BASED PRICING ───
    view_count = _get_product_view_count(product_id)
    demand_multiplier = 1.0

    if view_count > 60:
        demand_multiplier = 1.15
        adjustments.append({
            "factor": "High Demand",
            "icon": "🔥",
            "description": f"Very high demand ({view_count} interactions) → +15%",
            "impact": "+15%"
        })
    elif view_count > 40:
        demand_multiplier = 1.10
        adjustments.append({
            "factor": "Rising Demand",
            "icon": "📈",
            "description": f"High demand ({view_count} interactions) → +10%",
            "impact": "+10%"
        })
    elif view_count > 20:
        demand_multiplier = 1.05
        adjustments.append({
            "factor": "Moderate Demand",
            "icon": "📊",
            "description": f"Moderate demand ({view_count} interactions) → +5%",
            "impact": "+5%"
        })
    else:
        adjustments.append({
            "factor": "Normal Demand",
            "icon": "➡️",
            "description": f"Standard demand ({view_count} interactions)",
            "impact": "0%"
        })

    current_price *= demand_multiplier
    factors["demand"] = {"multiplier": demand_multiplier, "view_count": view_count}

    # ─── 2. COMPETITOR-BASED ADJUSTMENT ───
    competitor_price = COMPETITOR_PRICES.get(product_id, base_price)
    competitor_multiplier = 1.0

    if competitor_price < current_price:
        competitor_multiplier = 0.95
        adjustments.append({
            "factor": "Competitor Match",
            "icon": "⚔️",
            "description": f"Competitor price ${competitor_price:.2f} is lower → -5% to stay competitive",
            "impact": "-5%"
        })
    elif competitor_price > current_price * 1.1:
        competitor_multiplier = 1.03
        adjustments.append({
            "factor": "Market Premium",
            "icon": "💎",
            "description": f"Our price is below market (competitor: ${competitor_price:.2f}) → +3%",
            "impact": "+3%"
        })
    else:
        adjustments.append({
            "factor": "Market Aligned",
            "icon": "✅",
            "description": f"Price aligned with competitors (${competitor_price:.2f})",
            "impact": "0%"
        })

    current_price *= competitor_multiplier
    factors["competitor"] = {"multiplier": competitor_multiplier, "competitor_price": competitor_price}

    # ─── 3. USER-BASED PRICING ───
    user_multiplier = 1.0
    user = USERS.get(user_id) if user_id else None

    if user:
        user_type = user["user_type"]
        if user_type == "low_spender":
            user_multiplier = 0.90
            adjustments.append({
                "factor": "Budget-Friendly Price",
                "icon": "🏷️",
                "description": "Special pricing for value-conscious shoppers → -10%",
                "impact": "-10%"
            })
        elif user_type == "new_user":
            user_multiplier = 0.92
            adjustments.append({
                "factor": "Welcome Discount",
                "icon": "🎉",
                "description": "New customer welcome offer → -8%",
                "impact": "-8%"
            })
        elif user_type == "regular":
            user_multiplier = 0.97
            adjustments.append({
                "factor": "Loyalty Reward",
                "icon": "⭐",
                "description": "Regular customer appreciation → -3%",
                "impact": "-3%"
            })
        elif user_type == "premium":
            user_multiplier = 1.0
            adjustments.append({
                "factor": "Premium Member",
                "icon": "👑",
                "description": "Premium members get base pricing (already best value)",
                "impact": "0%"
            })
    else:
        adjustments.append({
            "factor": "Guest Pricing",
            "icon": "👤",
            "description": "Standard pricing for guest users",
            "impact": "0%"
        })

    current_price *= user_multiplier
    factors["user"] = {"multiplier": user_multiplier, "user_type": user.get("user_type", "guest") if user else "guest"}

    # ─── FINAL PRICE ───
    final_price = round(current_price, 2)
    total_savings = round(base_price - final_price, 2)
    savings_percent = round((1 - final_price / base_price) * 100, 1) if base_price > 0 else 0

    # Generate summary explanation
    active_factors = [a["factor"] for a in adjustments if a["impact"] != "0%"]
    if active_factors:
        explanation = f"Price adjusted based on: {', '.join(active_factors)}"
    else:
        explanation = "Price at standard market rate"

    return {
        "product_id": product_id,
        "product_name": product["name"],
        "base_price": base_price,
        "final_price": final_price,
        "currency": "USD",
        "total_savings": total_savings,
        "savings_percent": savings_percent,
        "explanation": explanation,
        "adjustments": adjustments,
        "factors": factors
    }
