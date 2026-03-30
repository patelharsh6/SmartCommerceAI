from flask import Blueprint, jsonify, request
from app.services.recommendation_service import get_personalized_recommendations

recommendation_bp = Blueprint('recommendation', __name__)

@recommendation_bp.route('/', methods=['GET'])
def get_recommendations():
    """
    Endpoint for recommendations integration ready endpoint.
    Delegates fetch to recommendation_service.
    """
    user_id = request.args.get('user_id', 'user_1')
    recs = get_personalized_recommendations(user_id)
    return jsonify({"recommendations": recs})
