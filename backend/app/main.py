import email

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime, timedelta
import atexit

from app.extensions import init_db
import app.extensions as ext

from app.routes.auth_routes import auth_bp
from app.routes.api_routes import api_bp

# ✅ From first file
from app.routes.pricing_routes import pricing_bp
from app.routes.admin_routes import admin_bp
from app.utils.stream_worker import start_worker_thread, stop_worker
from app.redis_client import get_redis
from app.extensions import client as mongo_client

load_dotenv()


def create_app():
    app = Flask(__name__)

    CORS(
        app,
        resources={r"/*": {"origins": "http://localhost:5173"}},
        supports_credentials=True
    )

    # ── DB Init ─────────────────────────────
    init_db(app)

    cart_collection = ext.db["carts_collection"]
    orders_collection = ext.db["orders"]

    # ── Start Redis Worker (priority from first file) ──
    start_worker_thread()

    # ── Blueprints ──────────────────────────
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(api_bp)
    app.register_blueprint(pricing_bp)
    app.register_blueprint(admin_bp)

    # ── Basic Routes ────────────────────────
    @app.route("/")
    def home():
        return {"message": "SmartCommerceAI API Running"}

    @app.route("/health")
    def health():
        status = {"api": "ok", "mongo": "ok", "redis": "ok"}

        try:
            mongo_client.admin.command("ping")
        except Exception as e:
            status["mongo"] = str(e)

        try:
            get_redis().ping()
        except Exception as e:
            status["redis"] = str(e)

        return status

    # ════════════════════════════════════════
    # 🛒 CART SYSTEM
    # ════════════════════════════════════════

    @app.route("/add-to-cart", methods=["POST"])
    def add_to_cart():
        payload = request.get_json(force=True)

        email = payload.get("email")
        product_id = payload.get("product_id")
        name = payload.get("name")
        category = payload.get("category")
        sub_category = payload.get("sub_category")
        brand = payload.get("brand")
        pricing = payload.get("pricing")
        quantity = payload.get("quantity", 1)

        if isinstance(product_id, str):
            try:
                product_id = int(product_id)
            except:
                pass

        if pricing is None:
            price = payload.get("price")
            if price:
                pricing = {
                    "base_price": float(price),
                    "predicted_price": float(price),
                    "best_price": float(price),
                }

        if not email or product_id is None or not name or not pricing:
            return jsonify({"error": "Missing required fields"}), 400

        cart_collection.update_one(
            {"email": email, "product_id": product_id},
            {
                "$setOnInsert": {
                    "name": name,
                    "category": category,
                    "sub_category": sub_category,
                    "brand": brand,
                    "pricing": pricing,
                },
                "$inc": {"quantity": quantity},
            },
            upsert=True,
        )

        item = cart_collection.find_one(
            {"email": email, "product_id": product_id},
            {"_id": 0}
        )

        return jsonify({"cart_item": item}), 200


    @app.route("/cart/<email>", methods=["GET"])
    def get_cart(email):
        items = list(cart_collection.find({"email": email}, {"_id": 0}))
        return jsonify({"cart_items": items}), 200


    @app.route("/cart/<email>/<product_id>", methods=["PUT"])
    def update_cart(email, product_id):
        payload = request.get_json(force=True)
        quantity = payload.get("quantity", 1)

        try:
            product_id = int(product_id)
        except:
            pass

        if quantity <= 0:
            cart_collection.delete_one({"email": email, "product_id": product_id})
        else:
            cart_collection.update_one(
                {"email": email, "product_id": product_id},
                {"$set": {"quantity": quantity}}
            )

        items = list(cart_collection.find({"email": email}, {"_id": 0})
)
        return jsonify({"cart_items": items})


    @app.route("/cart/<email>/<product_id>", methods=["DELETE"])
    def delete_item(email, product_id):
        try:
            product_id = int(product_id)
        except:
            pass

        cart_collection.delete_one({"email": email, "product_id": product_id})

        items = list(cart_collection.find({"email": email}, {"_id": 0}))
        return jsonify({"cart_items": items})


    @app.route("/cart/<email>", methods=["DELETE"])
    def clear_cart(email):
        cart_collection.delete_many({"email": email})
        return jsonify({"cart_items": []})


    # ════════════════════════════════════════
    # 📦 ORDER SYSTEM
    # ════════════════════════════════════════

    # Inside create_app() in main.py

    @app.route("/orders", methods=["POST"])
    def place_order():
        payload = request.get_json(force=True)
        email = payload.get("email")

        if not email:
            return jsonify({"error": "Email required"}), 400

        # Match the collection name defined at the top of create_app
        cart_items = list(cart_collection.find({"email": email}))

        if not cart_items:
            return jsonify({"error": "Cart empty"}), 400

        total = 0
        items = []

        for item in cart_items:
            # Logic to pick the best available price
            pricing = item.get("pricing", {})
            price = pricing.get("best_price") or pricing.get("base_price") or 0
            qty = item.get("quantity", 1)

            total += price * qty
            items.append({
                "product_id": item.get("product_id"),
                "name": item.get("name"),
                "price": price,
                "quantity": qty,
            })

        order = {
            "order_id": f"ORD-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "email": email,
            "items": items,
            "total": round(total, 2),
            "created_at": datetime.now().isoformat(),
            "status": "completed" # Explicitly set for Admin dashboard filters
        }

        orders_collection.insert_one(order)
        cart_collection.delete_many({"email": email})

        # Convert ObjectId for the response
        order["_id"] = str(order["_id"])
        return jsonify({"order": order}), 201

    @app.route("/orders/<email>", methods=["GET"])
    def get_orders(email):
        # Ensure IDs are strings so React can use them as keys
        orders = list(orders_collection.find({"email": email}))
        for o in orders:
            o["_id"] = str(o["_id"])
        return jsonify({"orders": orders})


    # ── Graceful Shutdown ───────────────────
    atexit.register(stop_worker)

    return app


app = create_app()