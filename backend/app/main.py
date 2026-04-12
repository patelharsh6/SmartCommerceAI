from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv

from app.extensions import init_db
from app.routes.auth_routes import auth_bp
from app.routes.api_routes import api_bp

# ── New imports ────────────────────────────────────────────
from app.routes.pricing_routes import pricing_bp
from app.utils.stream_worker import start_worker_thread, stop_worker
from app.db import get_redis, client as mongo_client

load_dotenv()


def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}}, supports_credentials=True)

    # ── DB init (your existing) ────────────────────────────
    init_db(app)

    # ── Start Redis stream worker (daemon thread) ──────────
    start_worker_thread()

    # ── Register blueprints ────────────────────────────────
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(api_bp)            # already has url_prefix="/api"
    app.register_blueprint(pricing_bp)        # url_prefix="/api/pricing" (set inside blueprint)

    # ── Routes ─────────────────────────────────────────────
    @app.route("/")
    def home():
        return {"message": "SmartCommerceAI API Running"}

    @app.route("/health")
    def health():
        status = {"api": "ok", "mongo": "ok", "redis": "ok"}
        try:
            mongo_client.admin.command("ping")
        except Exception as e:
            status["mongo"] = str(e)
        try:
            get_redis().ping()
        except Exception as e:
            status["redis"] = str(e)
        return status

    # ── Graceful shutdown ──────────────────────────────────
    import atexit
    atexit.register(stop_worker)

    return app


app = create_app()