# backend/app/schemas/transactions.py
from __future__ import annotations

from typing import Optional, List
from pydantic import BaseModel, Field


class TransactionScoringRequest(BaseModel):
    # 🔹 client_id опционален, но полезен для логов
    client_id: Optional[str] = Field(
        default=None, description="Уникальный идентификатор клиента"
    )

    amount: float = Field(..., ge=0, description="Сумма совершенного перевода")

    # Поведенческие фичи (все опциональные)
    os_ver_cnt_30d: Optional[float] = None
    phone_model_cnt_30d: Optional[float] = None
    login_sessions_7d: Optional[float] = None
    login_sessions_30d: Optional[float] = None
    logins_per_day_7d: Optional[float] = None
    logins_per_day_30d: Optional[float] = None
    login_freq_change_7d_vs_30d: Optional[float] = None
    logins_7d_share_of_30d: Optional[float] = None
    avg_session_interval_30d: Optional[float] = None
    std_session_interval_30d: Optional[float] = None
    var_session_interval_30d: Optional[float] = None
    ewm_session_interval_7d: Optional[float] = None
    burstiness_sessions: Optional[float] = None
    fano_factor_sessions: Optional[float] = None
    zscore_interval_7d_vs_30d: Optional[float] = None


class TransactionScoringResponse(BaseModel):
    fraud_probability: float
    risk_level: str
    model_version: str = "xgb_baseline_v1"


# Для batch-скоринга можно возвращать просто List[TransactionScoringResponse],
# но для удобства оборачиваем:
class BatchScoringRequest(BaseModel):
    items: List[TransactionScoringRequest]


class BatchScoringResponse(BaseModel):
    results: List[TransactionScoringResponse]

class TransactionExplainRequest(BaseModel):
    """
    Запрос на объяснение уже полученного решения.
    Передаём:
    - те же фичи, что и в score_transaction (transaction),
    - уже посчитанные моделью fraud_probability и risk_level.
    """
    transaction: TransactionScoringRequest
    fraud_probability: float
    risk_level: str


class TransactionExplainResponse(BaseModel):
    fraud_probability: float
    risk_level: str
    explanation: str
