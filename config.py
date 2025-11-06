from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_marshmallow import Marshmallow
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize extensions
db = SQLAlchemy()
ma = Marshmallow()

def _build_database_uri() -> str:
    """Resolve the SQLALCHEMY_DATABASE_URI with sensible fallbacks.

    Resolution order:
    1) DATABASE_URL env var (useful for SQLite or any SQLAlchemy URL)
    2) MySQL from discrete env vars (DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)
    3) Local SQLite file (taskwise.db) as a zero-config fallback
    """
    # 1) Full URL provided (e.g., sqlite:///taskwise.db)
    db_url = os.getenv('DATABASE_URL')
    if db_url:
        return db_url

    # 2) Compose MySQL URL if core pieces provided
    db_user = os.getenv('DB_USER')
    db_password = os.getenv('DB_PASSWORD', '')
    db_host = os.getenv('DB_HOST', '127.0.0.1')
    db_port = os.getenv('DB_PORT', '3306')
    db_name = os.getenv('DB_NAME')

    if db_user and db_name:
        return f"mysql+pymysql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"

    # 3) Fallback: local SQLite file
    return 'sqlite:///taskwise.db'


def create_app():
    app = Flask(__name__)

    # Configuration
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev-secret-key')
    app.config['SQLALCHEMY_DATABASE_URI'] = _build_database_uri()
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Initialize extensions with app
    db.init_app(app)
    ma.init_app(app)
    CORS(app)

    # Import and register routes
    from routes import register_routes
    register_routes(app)

    return app