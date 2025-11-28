# backend/app/api/v1/scoring.py
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, Header, HTTPException, status

from backend.app.core.config import get_settings
from backend.app.schemas.transactions import (
    TransactionScoringRequest,
    TransactionScoringResponse,
    BatchScoringRequest,
    BatchScoringResponse,
    TransactionExplainRequest,
    TransactionExplainResponse,
)
from backend.app.services.fraud_model import fraud_model_service
from backend.app.services.audit_logger import log_scoring_event
from backend.app.services.llm_explainer import llm_explainer_service

router = APIRouter(tags=["scoring"])
settings = get_settings()


def verify_api_token(x_api_key: str | None = Header(default=None)) -> None:
    """
    Простая проверка API-токена:
    - если в настройках API_TOKEN не пустой, требуем совпадения заголовка X-API-Key
    - если пустой, проверку выключаем (режим dev)
    """
    if settings.API_TOKEN:
        if x_api_key is None or x_api_key != settings.API_TOKEN:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or missing API token",
            )


@router.post(
    "/score_transaction",
    response_model=TransactionScoringResponse,
)
def score_transaction(
    request: TransactionScoringRequest,
    _: None = Depends(verify_api_token),
) -> TransactionScoringResponse:
    """
    Скоринг одной транзакции.
    """
    response = fraud_model_service.score(request)

    # логирование
    client_id_str = request.client_id if request.client_id is not None else None
    amount_val = request.amount if request.amount is not None else None

    log_scoring_event(
        client_id=client_id_str,
        amount=amount_val,
        fraud_probability=response.fraud_probability,
        risk_level=response.risk_level,
    )

    return response


@router.post(
    "/score_batch",
    response_model=BatchScoringResponse,
)
def score_batch(
    batch: BatchScoringRequest,
    _: None = Depends(verify_api_token),
) -> BatchScoringResponse:
    """
    Скоринг списка транзакций.
    Принимает { "items": [ {transaction1}, {transaction2}, ... ] }
    Возвращает { "results": [ {resp1}, {resp2}, ... ] }
    """
    results: List[TransactionScoringResponse] = []

    for item in batch.items:
        resp = fraud_model_service.score(item)
        results.append(resp)

        # логируем каждую транзакцию отдельно
        client_id_str = item.client_id if item.client_id is not None else None
        amount_val = item.amount if item.amount is not None else None

        log_scoring_event(
            client_id=client_id_str,
            amount=amount_val,
            fraud_probability=resp.fraud_probability,
            risk_level=resp.risk_level,
        )

    return BatchScoringResponse(results=results)

@router.post(
    "/explain_transaction",
    response_model=TransactionExplainResponse,
)
def explain_transaction(
    request: TransactionExplainRequest,
    _: None = Depends(verify_api_token),
) -> TransactionExplainResponse:
    """
    Возвращает текстовое объяснение уже полученного решения модели.
    ML-часть (fraud_probability, risk_level) мы не пересчитываем — 
    используем то, что пришло от фронта.
    """
    explanation = llm_explainer_service.explain(request)

    return TransactionExplainResponse(
        fraud_probability=request.fraud_probability,
        risk_level=request.risk_level,
        explanation=explanation,
    )
