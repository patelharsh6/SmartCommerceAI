from flask import Flask
from flask_cors import CORS
from app.extensions import init_db
from dotenv import load_dotenv
from app.routes.auth_routes import auth_bp
from app.routes.api_routes import api_bp

load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}}, supports_credentials=True)

    init_db(app)

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(api_bp)  # already has url_prefix="/api"

    @app.route("/")
    def home():
        return {"message": "SmartCommerceAI API Running"}

    @app.route("/health")
    def health():
        return {"status": "ok"}

    return app

app = create_app()
