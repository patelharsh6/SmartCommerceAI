"""
Data Store Module - Simulates MongoDB collections + Redis cache
Contains: products, users, events, sessions, competitor prices
"""
import random
from datetime import datetime, timedelta

# ═══════════════════════════════════════════════════════════════
# 📦 PRODUCTS COLLECTION (simulating MongoDB 'products' collection)
# ═══════════════════════════════════════════════════════════════

PRODUCTS = [
    # Electronics
    {"product_id": "P001", "name": "Wireless Noise-Cancelling Headphones", "category": "Electronics", "base_price": 149.99, "image": "🎧", "description": "Premium ANC headphones with 30hr battery", "stock": 45},
    {"product_id": "P002", "name": "Smart Fitness Watch Pro", "category": "Electronics", "base_price": 199.99, "image": "⌚", "description": "GPS + heart rate + sleep tracking", "stock": 30},
    {"product_id": "P003", "name": "Portable Bluetooth Speaker", "category": "Electronics", "base_price": 79.99, "image": "🔊", "description": "Waterproof 360° sound speaker", "stock": 60},
    {"product_id": "P004", "name": "USB-C Fast Charger 65W", "category": "Electronics", "base_price": 39.99, "image": "🔌", "description": "GaN charger with 3 ports", "stock": 100},

    # Fashion
    {"product_id": "P005", "name": "Premium Leather Jacket", "category": "Fashion", "base_price": 249.99, "image": "🧥", "description": "Genuine leather, slim fit design", "stock": 20},
    {"product_id": "P006", "name": "Running Shoes Ultra Boost", "category": "Fashion", "base_price": 129.99, "image": "👟", "description": "Lightweight with responsive cushioning", "stock": 50},
    {"product_id": "P007", "name": "Classic Aviator Sunglasses", "category": "Fashion", "base_price": 89.99, "image": "🕶️", "description": "UV400 polarized lenses", "stock": 75},
    {"product_id": "P008", "name": "Canvas Backpack Travel", "category": "Fashion", "base_price": 59.99, "image": "🎒", "description": "Water-resistant with laptop sleeve", "stock": 40},

    # Home & Kitchen
    {"product_id": "P009", "name": "Smart Air Purifier", "category": "Home & Kitchen", "base_price": 179.99, "image": "🌬️", "description": "HEPA filter with air quality sensor", "stock": 25},
    {"product_id": "P010", "name": "Automatic Espresso Machine", "category": "Home & Kitchen", "base_price": 299.99, "image": "☕", "description": "15-bar pump with milk frother", "stock": 15},
    {"product_id": "P011", "name": "Robot Vacuum Cleaner", "category": "Home & Kitchen", "base_price": 349.99, "image": "🤖", "description": "LiDAR navigation + mop function", "stock": 20},
    {"product_id": "P012", "name": "Smart LED Strip Lights 10m", "category": "Home & Kitchen", "base_price": 29.99, "image": "💡", "description": "RGB + warm white, app controlled", "stock": 120},

    # Books & Learning
    {"product_id": "P013", "name": "Machine Learning Handbook", "category": "Books", "base_price": 49.99, "image": "📘", "description": "Comprehensive guide to ML algorithms", "stock": 80},
    {"product_id": "P014", "name": "Python Data Science Cookbook", "category": "Books", "base_price": 39.99, "image": "📗", "description": "Hands-on recipes for data analysis", "stock": 90},
    {"product_id": "P015", "name": "System Design Interview Guide", "category": "Books", "base_price": 44.99, "image": "📙", "description": "Master large-scale system design", "stock": 70},
    {"product_id": "P016", "name": "Clean Code: A Handbook", "category": "Books", "base_price": 34.99, "image": "📕", "description": "Writing maintainable software", "stock": 85},

    # Sports & Outdoors
    {"product_id": "P017", "name": "Yoga Mat Premium 6mm", "category": "Sports", "base_price": 34.99, "image": "🧘", "description": "Non-slip, eco-friendly material", "stock": 60},
    {"product_id": "P018", "name": "Adjustable Dumbbell Set 20kg", "category": "Sports", "base_price": 89.99, "image": "🏋️", "description": "Quick-change weight system", "stock": 35},
    {"product_id": "P019", "name": "Camping Tent 4-Person", "category": "Sports", "base_price": 159.99, "image": "⛺", "description": "Waterproof, easy 2-minute setup", "stock": 25},
    {"product_id": "P020", "name": "Insulated Water Bottle 1L", "category": "Sports", "base_price": 24.99, "image": "🥤", "description": "Keeps cold 24hrs, hot 12hrs", "stock": 150},
]

# Build product lookup map
PRODUCT_MAP = {p["product_id"]: p for p in PRODUCTS}

# ═══════════════════════════════════════════════════════════════
# 👤 USERS COLLECTION (simulating MongoDB 'users' collection)
# ═══════════════════════════════════════════════════════════════

USERS = {
    "U001": {"user_id": "U001", "name": "Alex Premium", "user_type": "premium", "total_spent": 5200.00, "avatar": "👨‍💼"},
    "U002": {"user_id": "U002", "name": "Sam Regular", "user_type": "regular", "total_spent": 1500.00, "avatar": "👩‍💻"},
    "U003": {"user_id": "U003", "name": "Jordan Budget", "user_type": "low_spender", "total_spent": 320.00, "avatar": "🧑‍🎓"},
    "U004": {"user_id": "U004", "name": "Taylor New", "user_type": "new_user", "total_spent": 0.00, "avatar": "👤"},
}

# ═══════════════════════════════════════════════════════════════
# 📊 EVENTS STORE (simulating MongoDB 'events' collection)
# ═══════════════════════════════════════════════════════════════

# Pre-seed with some click/view events to have trending data
EVENTS = []

def _seed_events():
    """Generate realistic seed event data"""
    event_types = ["view", "click", "add_to_cart"]
    user_ids = list(USERS.keys())

    # Make some products more popular (trending)
    popularity_weights = {
        "P001": 55, "P002": 70, "P003": 30, "P006": 65,
        "P010": 45, "P011": 80, "P013": 40, "P017": 35,
        "P005": 25, "P009": 20, "P019": 50, "P020": 15,
        "P004": 10, "P007": 12, "P008": 18, "P012": 22,
        "P014": 8, "P015": 14, "P016": 6, "P018": 28,
    }

    for product_id, count in popularity_weights.items():
        for i in range(count):
            EVENTS.append({
                "event_id": f"E{len(EVENTS)+1:05d}",
                "user_id": random.choice(user_ids),
                "product_id": product_id,
                "event_type": random.choice(event_types),
                "timestamp": (datetime.now() - timedelta(hours=random.randint(1, 72))).isoformat()
            })

_seed_events()


# ═══════════════════════════════════════════════════════════════
# 🔐 SESSIONS STORE (simulating MongoDB 'sessions' collection)
# ═══════════════════════════════════════════════════════════════

SESSIONS = {
    "U001": {"user_id": "U001", "products_viewed": ["P001", "P002", "P010"], "last_active": datetime.now().isoformat()},
    "U002": {"user_id": "U002", "products_viewed": ["P006", "P013", "P017"], "last_active": datetime.now().isoformat()},
    "U003": {"user_id": "U003", "products_viewed": ["P012", "P020"], "last_active": datetime.now().isoformat()},
    "U004": {"user_id": "U004", "products_viewed": [], "last_active": datetime.now().isoformat()},
}


# ═══════════════════════════════════════════════════════════════
# 💰 COMPETITOR PRICES (simulating external competitor data)
# ═══════════════════════════════════════════════════════════════

COMPETITOR_PRICES = {}
for p in PRODUCTS:
    # Competitor price varies ±15% from our base price
    variation = random.uniform(0.85, 1.15)
    COMPETITOR_PRICES[p["product_id"]] = round(p["base_price"] * variation, 2)
