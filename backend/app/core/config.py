# backend/app/core/config.py
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MODEL_PATH: str = "ml/models/model_xgb_baseline.pkl"

    RISK_THRESHOLD_MEDIUM: float = 0.26
    RISK_THRESHOLD_HIGH: float = 0.80

    PROJECT_NAME: str = "Forte Anti-Fraud API"
    API_V1_PREFIX: str = "/api/v1"

    API_TOKEN: str | None = None

    LOG_DB_PATH: str = "logs/db.log"
    # LOG_API_PATH: str = "logs/api.log"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
