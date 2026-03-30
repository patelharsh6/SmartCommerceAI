"""
Recommendation Service (Het's Logic)
- Category-based recommendations
- Trending products (based on event frequency)
- Session-based recommendations (Ansh's contribution)
"""
from collections import Counter
from app.data_store import PRODUCTS, PRODUCT_MAP, EVENTS, SESSIONS


def get_trending_products(limit: int = 5):
    """
    Generate trending products based on event frequency.
    trending = events.groupby("product_id").size().sort_values(ascending=False)
    """
    if not EVENTS:
        return []

    # Count events per product
    event_counts = Counter(e["product_id"] for e in EVENTS)
    trending_ids = [pid for pid, _ in event_counts.most_common(limit)]

    trending = []
    for pid in trending_ids:
        product = PRODUCT_MAP.get(pid)
        if product:
            trending.append({
                **product,
                "view_count": event_counts[pid],
                "trending_rank": trending_ids.index(pid) + 1
            })
    return trending


def get_category_recommendations(product_id: str, limit: int = 5):
    """
    Category-based recommendation:
    Find products in the same category as the given product.
    """
    product = PRODUCT_MAP.get(product_id)
    if not product:
        return []

    category = product["category"]
    recommendations = [
        p for p in PRODUCTS
        if p["category"] == category and p["product_id"] != product_id
    ][:limit]

    return recommendations


def get_session_recommendations(user_id: str, limit: int = 5):
    """
    Session-based recommendation (Ansh's logic):
    Recommend based on the last viewed product's category.
    """
    session = SESSIONS.get(user_id)
    if not session or not session["products_viewed"]:
        # For new users, return trending products
        return get_trending_products(limit)

    last_product_id = session["products_viewed"][-1]
    return get_category_recommendations(last_product_id, limit)


def get_full_recommendations(product_id: str, user_id: str = None):
    """
    Combined recommendation engine:
    Returns category-based, trending, and session-based recommendations
    with explanation text.
    """
    category_recs = get_category_recommendations(product_id)
    trending = get_trending_products(5)

    session_recs = []
    session_explanation = ""
    if user_id:
        session_recs = get_session_recommendations(user_id)
        session = SESSIONS.get(user_id)
        if session and session["products_viewed"]:
            last_pid = session["products_viewed"][-1]
            last_product = PRODUCT_MAP.get(last_pid, {})
            session_explanation = f"Recommended because you recently viewed {last_product.get('name', 'similar items')}"
        else:
            session_explanation = "Recommended based on what's trending right now"

    product = PRODUCT_MAP.get(product_id, {})
    category_explanation = f"Similar products in {product.get('category', 'this category')}"
    trending_explanation = "Trending right now based on user activity"

    return {
        "category_based": {
            "products": category_recs,
            "explanation": category_explanation
        },
        "trending": {
            "products": trending,
            "explanation": trending_explanation
        },
        "session_based": {
            "products": session_recs,
            "explanation": session_explanation
        }
    }
