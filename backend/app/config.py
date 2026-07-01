"""Runtime configuration loaded from environment variables."""

import os

SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-only-secret-replace-in-prod")
DB_PATH: str = os.getenv("DB_PATH", "/app/data/app.db")
STATIC_DIR: str = os.getenv("STATIC_DIR", "/app/static")
