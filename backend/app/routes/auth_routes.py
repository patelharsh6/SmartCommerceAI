"""
Auth Routes — Signup, Login, Profile, Cart, Orders (Cash on Delivery)
All data stored in-memory for demo purposes.
"""

from flask import Blueprint, jsonify, request
from datetime import datetime
import bcrypt
import jwt
import functools
import uuid
from app.db import users_collection, carts_collection, orders_collection

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

JWT_SECRET = "smartcommerce-secret-key-2026"

def _generate_user_id():
    return f"USER_{str(uuid.uuid4())[:8].upper()}"


def _generate_order_id():
    import random
    return f"ORD-{datetime.now().strftime('%Y%m%d')}-{random.randint(1000, 9999)}"


def _get_current_user():
    """Extract user from JWT token in Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        email = payload.get("email")
        if email:
            user = users_collection.find_one({"email": email})
            if user:
                user['_id'] = str(user['_id'])
                return user
        return None
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


def require_auth(f):
    """Decorator to require authentication."""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        user = _get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        return f(user, *args, **kwargs)
    return decorated


# ═══════════════════════════════════════════════════════════════
# 🔐 AUTHENTICATION
# ═══════════════════════════════════════════════════════════════

@auth_bp.route("/signup", methods=["POST"])
def signup():
    """Register a new user."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    phone = data.get("phone", "").strip()
    address = data.get("address", "").strip()

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    if users_collection.find_one({"email": email}):
        return jsonify({"error": "An account with this email already exists"}), 409

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user_id = _generate_user_id()

    user = {
        "id": user_id,
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "phone": phone,
        "address": address,
        "avatar": "👤",
        "created_at": datetime.now().isoformat(),
        "total_spent": 0.0,
    }

    users_collection.insert_one(user)
    carts_collection.insert_one({"user_id": user_id, "items": []})
    orders_collection.insert_one({"user_id": user_id, "orders": []})

    # Generate JWT
    token = jwt.encode({"email": email, "user_id": user_id}, JWT_SECRET, algorithm="HS256")

    return jsonify({
        "token": token,
        "user": {
            "id": user_id,
            "name": name,
            "email": email,
            "phone": phone,
            "address": address,
            "avatar": user["avatar"],
            "total_spent": 0.0,
            "created_at": user["created_at"],
        }
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticate a user."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        return jsonify({"error": "Invalid email or password"}), 401

    token = jwt.encode({"email": email, "user_id": user["id"]}, JWT_SECRET, algorithm="HS256")

    return jsonify({
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user["phone"],
            "address": user["address"],
            "avatar": user["avatar"],
            "total_spent": user["total_spent"],
            "created_at": user["created_at"],
        }
    })


# ═══════════════════════════════════════════════════════════════
# 👤 PROFILE
# ═══════════════════════════════════════════════════════════════

@auth_bp.route("/profile", methods=["GET"])
@require_auth
def get_profile(user):
    """Get current user's profile."""
    user_id = user["id"]
    user_orders_doc = orders_collection.find_one({"user_id": user_id})
    orders = user_orders_doc.get("orders", []) if user_orders_doc else []

    return jsonify({
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user["phone"],
            "address": user["address"],
            "avatar": user["avatar"],
            "total_spent": user["total_spent"],
            "created_at": user["created_at"],
            "total_orders": len(orders),
        }
    })


@auth_bp.route("/profile", methods=["PUT"])
@require_auth
def update_profile(user):
    """Update current user's profile."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400

    if "name" in data:
        user["name"] = data["name"].strip()
    if "phone" in data:
        user["phone"] = data["phone"].strip()
    if "address" in data:
        user["address"] = data["address"].strip()
    if "avatar" in data:
        user["avatar"] = data["avatar"]

    users_collection.update_one({"id": user["id"]}, {"$set": {
        "name": user.get("name"),
        "phone": user.get("phone"),
        "address": user.get("address"),
        "avatar": user.get("avatar")
    }})

    return jsonify({
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "phone": user["phone"],
            "address": user["address"],
            "avatar": user["avatar"],
            "total_spent": user["total_spent"],
            "created_at": user["created_at"],
        },
        "message": "Profile updated successfully"
    })


# ═══════════════════════════════════════════════════════════════
# 🛒 CART
# ═══════════════════════════════════════════════════════════════

@auth_bp.route("/cart", methods=["GET"])
@require_auth
def get_cart(user):
    """Get current user's cart."""
    user_cart_doc = carts_collection.find_one({"user_id": user["id"]})
    cart = user_cart_doc.get("items", []) if user_cart_doc else []
    total = sum(item["price"] * item["quantity"] for item in cart)
    return jsonify({
        "items": cart,
        "total": round(total, 2),
        "item_count": sum(item["quantity"] for item in cart),
    })


@auth_bp.route("/cart", methods=["POST"])
@require_auth
def add_to_cart(user):
    """Add an item to the cart."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Missing JSON body"}), 400

    product_id = data.get("product_id")
    name = data.get("name", "")
    image = data.get("image", "📦")
    price = data.get("price", 0)
    quantity = data.get("quantity", 1)
    category = data.get("category", "")

    if not product_id:
        return jsonify({"error": "product_id is required"}), 400

    user_cart_doc = carts_collection.find_one({"user_id": user["id"]})
    if not user_cart_doc:
        carts_collection.insert_one({"user_id": user["id"], "items": []})
        user_cart_doc = {"user_id": user["id"], "items": []}
        
    cart = user_cart_doc.get("items", [])

    # Check if product already in cart
    for item in cart:
        if item["product_id"] == product_id:
            item["quantity"] += quantity
            break
    else:
        cart.append({
            "product_id": product_id,
            "name": name,
            "image": image,
            "price": round(float(price), 2),
            "quantity": quantity,
            "category": category,
        })

    carts_collection.update_one({"user_id": user["id"]}, {"$set": {"items": cart}})

    total = sum(item["price"] * item["quantity"] for item in cart)
    return jsonify({
        "items": cart,
        "total": round(total, 2),
        "item_count": sum(item["quantity"] for item in cart),
        "message": f"{name} added to cart"
    }), 201


@auth_bp.route("/cart/<product_id>", methods=["PUT"])
@require_auth
def update_cart_item(user, product_id):
    """Update quantity of a cart item."""
    data = request.get_json()
    quantity = data.get("quantity", 1)

    user_cart_doc = carts_collection.find_one({"user_id": user["id"]})
    cart = user_cart_doc.get("items", []) if user_cart_doc else []

    for item in cart:
        if item["product_id"] == product_id:
            if quantity <= 0:
                cart.remove(item)
            else:
                item["quantity"] = quantity
            break

    carts_collection.update_one({"user_id": user["id"]}, {"$set": {"items": cart}})

    total = sum(item["price"] * item["quantity"] for item in cart)
    return jsonify({
        "items": cart,
        "total": round(total, 2),
        "item_count": sum(item["quantity"] for item in cart),
    })


@auth_bp.route("/cart/<product_id>", methods=["DELETE"])
@require_auth
def remove_from_cart(user, product_id):
    """Remove an item from cart."""
    user_cart_doc = carts_collection.find_one({"user_id": user["id"]})
    cart = user_cart_doc.get("items", []) if user_cart_doc else []
    
    cart = [item for item in cart if item["product_id"] != product_id]
    carts_collection.update_one({"user_id": user["id"]}, {"$set": {"items": cart}})

    total = sum(item["price"] * item["quantity"] for item in cart)
    return jsonify({
        "items": cart,
        "total": round(total, 2),
        "item_count": sum(item["quantity"] for item in cart),
    })


# ═══════════════════════════════════════════════════════════════
# 📦 ORDERS (Cash on Delivery)
# ═══════════════════════════════════════════════════════════════

@auth_bp.route("/orders", methods=["GET"])
@require_auth
def get_orders(user):
    """Get current user's order history."""
    user_orders_doc = orders_collection.find_one({"user_id": user["id"]})
    orders = user_orders_doc.get("orders", []) if user_orders_doc else []
    return jsonify({"orders": orders})


@auth_bp.route("/orders", methods=["POST"])
@require_auth
def place_order(user):
    """Place an order with Cash on Delivery."""
    data = request.get_json() or {}

    user_cart_doc = carts_collection.find_one({"user_id": user["id"]})
    cart = user_cart_doc.get("items", []) if user_cart_doc else []
    if not cart:
        return jsonify({"error": "Your cart is empty"}), 400

    # Use provided address or fall back to profile
    delivery_address = data.get("address", "").strip() or user.get("address", "")
    delivery_phone = data.get("phone", "").strip() or user.get("phone", "")

    if not delivery_address:
        return jsonify({"error": "Delivery address is required. Please update your profile or provide an address."}), 400

    if not delivery_phone:
        return jsonify({"error": "Phone number is required. Please update your profile or provide a phone number."}), 400

    total = sum(item["price"] * item["quantity"] for item in cart)

    order = {
        "order_id": _generate_order_id(),
        "items": list(cart),  # copy the cart items
        "total": round(total, 2),
        "item_count": sum(item["quantity"] for item in cart),
        "status": "confirmed",
        "payment_method": "Cash on Delivery",
        "delivery_address": delivery_address,
        "delivery_phone": delivery_phone,
        "created_at": datetime.now().isoformat(),
        "estimated_delivery": "3-5 business days",
    }

    user_orders_doc = orders_collection.find_one({"user_id": user["id"]})
    if not user_orders_doc:
        orders_collection.insert_one({"user_id": user["id"], "orders": []})
        user_orders_doc = {"user_id": user["id"], "orders": []}
        
    orders = user_orders_doc.get("orders", [])
    orders.insert(0, order)  # newest first
    orders_collection.update_one({"user_id": user["id"]}, {"$set": {"orders": orders}})

    # Update user's total spent
    new_total_spent = round(user.get("total_spent", 0.0) + total, 2)
    users_collection.update_one({"id": user["id"]}, {"$set": {"total_spent": new_total_spent}})
    user["total_spent"] = new_total_spent

    # Clear the cart
    carts_collection.update_one({"user_id": user["id"]}, {"$set": {"items": []}})

    return jsonify({
        "order": order,
        "message": "Order placed successfully! Payment will be collected on delivery."
    }), 201
