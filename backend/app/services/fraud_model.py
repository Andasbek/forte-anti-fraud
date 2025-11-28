# backend/app/services/fraud_model.py
from __future__ import annotations

import joblib
import pandas as pd
from typing import Dict, Any

from backend.app.core.config import get_settings
from backend.app.schemas.transactions import TransactionScoringRequest, TransactionScoringResponse

settings = get_settings()


class FraudModelService:
    def __init__(self, model_path: str):
        self.model_path = model_path
        self.model = self._load_model()
        self.feature_names = list(self.model.get_booster().feature_names)

    def _load_model(self):
        model = joblib.load(self.model_path)
        return model

    def _build_feature_row(self, req: TransactionScoringRequest) -> pd.DataFrame:
        payload: Dict[str, Any] = req.dict()
        row: Dict[str, float] = {}

        for feat in self.feature_names:
            if feat.endswith("_was_missing"):
                base = feat.replace("_was_missing", "")
                raw_val = payload.get(base, None)
                row[feat] = 1.0 if raw_val is None else 0.0
            else:
                raw_val = payload.get(feat, None)
                if raw_val is None:
                    row[feat] = 0.0
                else:
                    row[feat] = float(raw_val)

        df_row = pd.DataFrame([row], columns=self.feature_names)
        return df_row

    def predict_proba(self, req: TransactionScoringRequest) -> float:
        X = self._build_feature_row(req)
        proba = float(self.model.predict_proba(X)[:, 1][0])
        return proba

    def get_risk_level(self, proba: float) -> str:
        if proba >= settings.RISK_THRESHOLD_HIGH:
            return "high"
        if proba >= settings.RISK_THRESHOLD_MEDIUM:
            return "medium"
        return "low"

    def score(self, req: TransactionScoringRequest) -> TransactionScoringResponse:
        proba = self.predict_proba(req)
        risk = self.get_risk_level(proba)
        return TransactionScoringResponse(
            fraud_probability=proba,
            risk_level=risk,
        )


fraud_model_service = FraudModelService(model_path=settings.MODEL_PATH)
