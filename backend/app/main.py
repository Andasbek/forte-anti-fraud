# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import get_settings
from backend.app.api.v1.scoring import router as scoring_router
from backend.app.services.audit_logger import init_log_db

settings = get_settings()


def create_app() -> FastAPI:
    app = FastAPI(title=settings.PROJECT_NAME)

    # CORS для фронта
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # инициализируем БД логов при старте
    @app.on_event("startup")
    def startup_event():
        init_log_db()

    app.include_router(
        scoring_router,
        prefix=settings.API_V1_PREFIX,
    )

    @app.get("/", tags=["health"])
    def health_check():
        return {"status": "ok"}

    return app


app = create_app()
