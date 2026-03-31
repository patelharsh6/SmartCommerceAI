import pickle
import pandas as pd  # Fixed: added 'pandas'
import numpy as np
import os
from flask import Blueprint, jsonify, request

from app.services.recommendation_service import (
    recommend_category,
    recommend_product,
    recommend_explain,
    get_trending_products,
    get_dynamic_price,
    recommend
)

recommendation_bp = Blueprint("recommendation", __name__)

@recommendation_bp.route("/recommend/category/<category>", methods=["GET"])
def category_api(category):
    result = recommend_category(category) 
    return jsonify(result.to_dict(orient="records"))

@recommendation_bp.route("/recommend/product/<int:product_id>", methods=["GET"])
def product_api(product_id):
    result = recommend_product(product_id)
    return jsonify(result.to_dict(orient="records"))


@recommendation_bp.route("/recommend/explain/<int:product_id>", methods=["GET"])
def explain_api(product_id):
    result = recommend_explain(product_id)
    return jsonify(result)

@recommendation_bp.route("/recommend/trending", methods=["GET"])
def trending_api():
    result = get_trending_products()
    return jsonify(result.to_dict(orient="records"))

# @recommendation_bp.route("/recommend/fbt/<int:product_id>", methods=["GET"])
# def frequently_bought(product_id):
#     result = recommend_frequently_bought(product_id)
#     return jsonify(result.to_dict(orient="records"))

@recommendation_bp.route("/pricing/<int:product_id>", methods=["GET"])
def pricing_api(product_id):

    user_id = request.args.get("user_id", type=int)

    if user_id is None:
        return jsonify({"error": "Missing user_id parameter"}), 400

    final_price, reason, user_type = get_dynamic_price(product_id, user_id)

    if final_price is None:
        if reason == "Product not found":
            return jsonify({"error": "Product not found"}), 404
        elif reason == "User not found":
            return jsonify({"error": "User not found"}), 404

    return jsonify({
        "product_id": product_id,
        "user_id": user_id,
        "user_segment": user_type,
        "suggested_price": final_price,
        "logic": reason
    }), 200



BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODEL_PATH = os.path.join(BASE_DIR, "data", "recommendation_model.pkl")
META_PATH = os.path.join(BASE_DIR, "data", "product_meta.csv")

with open(MODEL_PATH, "rb") as f:
    recommendation_dict = pickle.load(f)

product_meta = pd.read_csv(META_PATH)

try:
    with open(MODEL_PATH, "rb") as f:
        recommendation_dict = pickle.load(f)
    print("✅ Recommendation model loaded.")

    product_meta = pd.read_csv(META_PATH)
    product_meta['product_id'] = product_meta['product_id'].astype(str)
    print("✅ Product metadata loaded.")

except FileNotFoundError as e:
    print(f"❌ Error: Could not find file at: {e.filename}")
    recommendation_dict = {}
    product_meta = pd.DataFrame(columns=['product_id', 'category_code', 'brand'])
    
@recommendation_bp.route("/recommend", methods=["GET"])
def get_recommendation():
    # Fetch product_id from query params
    product_id = request.args.get("product_id")

    if not product_id:
        return jsonify({"error": "product_id is required"}), 400

    try:
        # Call the logic
        recommendations = recommend(product_id)

        return jsonify({
            "status": "success",
            "input_product": product_id,
            "recommendations": recommendations
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500