from flask import Flask
from flask_cors import CORS
from app.extensions import init_db
from dotenv import load_dotenv
from app.routes.auth_routes import auth_bp

load_dotenv()

def create_app():
    app = Flask(__name__)
    CORS(app)

    init_db(app)

    app.register_blueprint(auth_bp, url_prefix="/auth")

    @app.route("/")
    def home():
        return {"message": "API Running"}

    return app

app = create_app()