from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import get_settings
from app.core.logging import logger
from app.db.database import init_db
from app.api import validation, models, projects, history, stats

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    await init_db()
    logger.info("Database initialized")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(validation.router)
app.include_router(models.router)
app.include_router(projects.router)
app.include_router(history.router)
app.include_router(stats.router)


@app.get("/api/health")
async def health():
    from app.services.ollama_service import ollama_service
    ollama_ok = await ollama_service.check_connection()
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "ollama": "connected" if ollama_ok else "disconnected",
    }
