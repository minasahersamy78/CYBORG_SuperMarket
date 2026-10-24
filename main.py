"""
Cyborg Supermarket — FastAPI Application Entrypoint
"""

import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config.database import init_db
from src.config.settings import get_settings
from src.modules.auth.router import router as auth_router
from src.modules.cart.router import router as cart_router
from src.modules.inventory.router import router as inventory_router
from src.modules.orders.router import router as orders_router
from src.modules.products.router import router as products_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cyborg-supermarket")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle event handler for database initialization and cleanup."""
    logger.info("Initializing database tables...")
    await init_db()
    logger.info("Database initialized successfully.")
    yield
    logger.info("Application shutdown.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API for the Cyborg Supermarket omni-channel ecosystem (Mobile, POS, Web)",
    lifespan=lifespan,
)

# ── CORS Middleware ──────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if not settings.DEBUG else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount Routers ────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(products_router)
app.include_router(inventory_router)
app.include_router(orders_router)
app.include_router(cart_router)


# ── Health & Root ────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    """Service health status check."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


@app.get("/", tags=["Root"])
async def root():
    """Welcome endpoint with links to OpenAPI documentation."""
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
    }


def start():
    """CLI entrypoint for running the app."""
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=settings.DEBUG)


if __name__ == "__main__":
    start()
