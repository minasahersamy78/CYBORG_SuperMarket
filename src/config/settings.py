"""
Application settings loaded from environment variables.
Uses pydantic-settings for type-safe configuration.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central application configuration."""

    # ── App ──────────────────────────────────────────────
    APP_NAME: str = "Cyborg Supermarket"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = True

    # ── Database ─────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///./cyborg.db"
    # For PostgreSQL: "postgresql+asyncpg://user:pass@localhost:5432/cyborg"

    # ── Redis ────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── JWT Auth ─────────────────────────────────────────
    JWT_SECRET_KEY: str = "cyborg-super-secret-change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ─────────────────────────────────────────────
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:8080"]

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    """Cached singleton for app settings."""
    return Settings()
