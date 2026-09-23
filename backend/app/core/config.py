from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "CodeGuard AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Override with DATABASE_URL in backend/.env (local Postgres or Supabase).
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/code_validator"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_DEFAULT_MODEL: str = "deepseek-r1:7b-fast"
    OLLAMA_TEMPERATURE: float = 0.1
    OLLAMA_NUM_PREDICT: int = 4096

    MAX_CODE_LENGTH: int = 100_000
    VALIDATION_TIMEOUT: int = 60
    LLM_TIMEOUT: int = 300

    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
