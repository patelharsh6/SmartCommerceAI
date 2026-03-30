"""
Session Service (Ansh's Logic)
- Track user sessions
- Record product views in session
- Session-based insights
"""
from datetime import datetime
from app.data_store import SESSIONS, PRODUCT_MAP


def get_session(user_id: str):
    """Get or create a user session"""
    if user_id not in SESSIONS:
        SESSIONS[user_id] = {
            "user_id": user_id,
            "products_viewed": [],
            "last_active": datetime.now().isoformat()
        }
    return SESSIONS[user_id]


def update_session(user_id: str, product_id: str):
    """Add a product view to the user's session"""
    session = get_session(user_id)

    # Avoid duplicate consecutive views
    if not session["products_viewed"] or session["products_viewed"][-1] != product_id:
        session["products_viewed"].append(product_id)

    # Keep last 20 products in session
    if len(session["products_viewed"]) > 20:
        session["products_viewed"] = session["products_viewed"][-20:]

    session["last_active"] = datetime.now().isoformat()
    return session


def get_session_summary(user_id: str):
    """Get a rich session summary with product details"""
    session = get_session(user_id)
    viewed_products = []
    categories_visited = set()

    for pid in session["products_viewed"]:
        product = PRODUCT_MAP.get(pid)
        if product:
            viewed_products.append({
                "product_id": pid,
                "name": product["name"],
                "category": product["category"],
                "image": product["image"]
            })
            categories_visited.add(product["category"])

    return {
        "user_id": user_id,
        "products_viewed": viewed_products,
        "total_views": len(session["products_viewed"]),
        "categories_explored": list(categories_visited),
        "last_active": session["last_active"],
        "journey_explanation": _generate_journey_text(viewed_products, categories_visited)
    }


def _generate_journey_text(viewed_products, categories):
    """Generate a human-readable session journey explanation"""
    if not viewed_products:
        return "Start exploring products to build your personalized experience!"

    count = len(viewed_products)
    cat_count = len(categories)
    last = viewed_products[-1]["name"]

    if count == 1:
        return f"You started exploring with {last}"
    elif cat_count == 1:
        return f"You've been browsing {count} items in {list(categories)[0]}"
    else:
        return f"You've explored {count} products across {cat_count} categories. Last viewed: {last}"
