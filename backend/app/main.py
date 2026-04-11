from flask import Flask
from flask_cors import CORS
from app.extensions import init_db
from dotenv import load_dotenv
<<<<<<< HEAD
from app.routes.api_routes import product_bp
=======
from app.routes.auth_routes import auth_bp
from app.routes.api_routes import api_bp, product_bp
>>>>>>> 94ba4386ebddc26dfc01dc51921f6a7408db2278

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

<<<<<<< HEAD
    app.register_blueprint(product_bp, url_prefix="")
=======
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(api_bp)  # already has url_prefix="/api"
    app.register_blueprint(product_bp, url_prefix="/api")
>>>>>>> 94ba4386ebddc26dfc01dc51921f6a7408db2278

    @app.route("/")
    def home():
        return {"message": "SmartCommerceAI API Running ✅"}

    return app

app = create_app()