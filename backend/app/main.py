from flask import Flask
from flask_cors import CORS
from app.routes.recommendation_routes import recommendation_bp
from app.routes.api_routes import api_bp

def create_app():
    app = Flask(__name__)
    CORS(app)

    # Register Blueprints
    app.register_blueprint(recommendation_bp)
    app.register_blueprint(api_bp)

    @app.route("/")
    def index():
        return {
            "status": "SmartCommerceAI API is running", 
            "version": "1.0.0",
            "platform": "MacBook Standard WSGI"
        }

    return app

# This is the standard Flask object
app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=True)