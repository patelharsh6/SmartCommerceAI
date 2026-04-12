from app.models.category_reco_model import ProductEngine

# Initialize the engine once
engine = ProductEngine()

def handle_prediction(sku_id):
    # 1. Preprocess
    features, raw_data = engine.preprocess_from_sku(sku_id)
    
    if features is None:
        return {"error": raw_data}

    # 2. Predict Price
    predicted_price = engine.get_price_prediction(features)

    # 3. Get Recommendations
    recommendations = engine.get_recommendations(sku_id, top_n=10)

    return {
        "sku_id": sku_id,
        "product_name": raw_data['product_name'],
        "category": raw_data['category'],
        "subcategory": raw_data['subcategory'],
        "actual_price": float(raw_data['current_price_usd']),
        "predicted_price": round(float(predicted_price), 2),
        "recommendations": recommendations
    }