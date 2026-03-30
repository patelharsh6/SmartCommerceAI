from flask import Blueprint, jsonify, request
from app.services.pricing_service import get_dynamic_price

pricing_bp = Blueprint('pricing', __name__)

@pricing_bp.route('/', methods=['GET'])
def get_pricing():
    """
    Endpoint for retrieving dynamic pricing.
    Delegates rules and computation to pricing_service.
    """
    # Uses request args for flexibility, falling back to a default value
    product_id = request.args.get('product_id', '123')
    pricing_data = get_dynamic_price(product_id)
    return jsonify(pricing_data)
