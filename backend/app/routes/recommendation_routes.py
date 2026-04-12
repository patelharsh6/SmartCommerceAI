# """
# Legacy Recommendation Routes
# These routes provide direct access to recommendation functions.
# The primary endpoints are in api_routes.py under /api/...
# """

# from flask import Blueprint, jsonify, request
# from app.services.recommendation_service import (
#     recommend_by_category,
#     recommend_similar_products,
#     recommend_by_brand,
#     get_trending,
#     get_dynamic_price,
#     format_product,
# )

# recommendation_bp = Blueprint("recommendation", __name__)


# @recommendation_bp.route("/recommend/category/<category>", methods=["GET"])
# def category_api(category):
#     results = recommend_by_category(category)
#     return jsonify(results)


# @recommendation_bp.route("/recommend/product/<product_id>", methods=["GET"])
# def product_api(product_id):
#     results = recommend_similar_products(product_id)
#     return jsonify(results)


# @recommendation_bp.route("/recommend/trending", methods=["GET"])
# def trending_api():
#     results = get_trending()
#     return jsonify(results)


# @recommendation_bp.route("/pricing/<product_id>", methods=["GET"])
# def pricing_api(product_id):
#     user_id = request.args.get("user_id", type=int)
#     result = get_dynamic_price(product_id, user_id)

#     if result is None:
#         return jsonify({"error": "Product not found"}), 404

#     return jsonify(result)