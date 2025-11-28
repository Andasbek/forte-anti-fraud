# backend/app/core/config.py
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # === ML / модель ===
    MODEL_PATH: str = "ml/models/model_xgb_baseline.pkl"

    # Пороги риска
    RISK_THRESHOLD_MEDIUM: float = 0.26
    RISK_THRESHOLD_HIGH: float = 0.80

    # Общие настройки API
    PROJECT_NAME: str = "Forte Anti-Fraud API"
    API_V1_PREFIX: str = "/api/v1"

    # Простой API-токен (если пустой — проверка выключена)
    API_TOKEN: str | None = None

    # Логи (SQLite или файл — зависит от твоей реализации логгера)
    LOG_DB_PATH: str = "logs/scoring_logs.db"

    # LLM (OpenAI)
    OPENAI_MODEL: str = "gpt-4o"
    OPENAI_API_KEY: str | None = None  # возьмётся из .env при наличии

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"   # игнорировать лишние переменные окружения


@lru_cache()
def get_settings() -> Settings:
    return Settings()
