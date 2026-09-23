from fastapi import APIRouter
from app.core.config import get_settings
from app.services.ollama_service import ollama_service
from app.models.schemas import OllamaStatus, OllamaModel, AppConfig

router = APIRouter(prefix="/api/v1", tags=["models"])


@router.get("/models", response_model=OllamaStatus)
async def get_models():
    connected = await ollama_service.check_connection()
    models = []
    error = None
    if connected:
        raw_models = await ollama_service.list_models()
        models = [
            OllamaModel(
                name=m.get("name", ""),
                size=m.get("size"),
                modified_at=m.get("modified_at"),
            )
            for m in raw_models
        ]
        if not models:
            error = "Ollama is reachable but no models are installed."
    else:
        error = f"Unable to connect to Ollama at {ollama_service.base_url}"
    return OllamaStatus(
        connected=connected,
        endpoint=ollama_service.base_url,
        models=models,
        error=error,
        default_model=ollama_service.default_model,
    )


@router.get("/config", response_model=AppConfig)
async def get_config():
    s = get_settings()
    from app.services.validation_service import SCORE_PENALTY
    return AppConfig(
        app_name=s.APP_NAME,
        app_version=s.APP_VERSION,
        default_model=s.OLLAMA_DEFAULT_MODEL,
        max_code_length=s.MAX_CODE_LENGTH,
        llm_timeout=s.LLM_TIMEOUT,
        validation_timeout=s.VALIDATION_TIMEOUT,
        debug=s.DEBUG,
        temperature=s.OLLAMA_TEMPERATURE,
        num_predict=s.OLLAMA_NUM_PREDICT,
        score_penalties=dict(SCORE_PENALTY),
    )
