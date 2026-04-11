from flask import Flask
from flask_cors import CORS
from app.extensions import init_db
from dotenv import load_dotenv
from app.routes.api_routes import product_bp

load_dotenv()

def create_app():
    app = Flask(__name__)

    CORS(app,
        origins=["*"],   # ✅ allow all origins for development
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        supports_credentials=False   # ✅ must be False when origins="*"
    )

    init_db(app)

    app.register_blueprint(product_bp, url_prefix="")

    @app.route("/")
    def home():
        return {"message": "SmartCommerceAI API Running ✅"}

    return app

app = create_app()