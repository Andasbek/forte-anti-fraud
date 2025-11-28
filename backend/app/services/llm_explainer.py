# backend/app/services/llm_explainer.py
from __future__ import annotations

from textwrap import dedent
import os

from openai import OpenAI

from backend.app.core.config import get_settings
from backend.app.schemas.transactions import TransactionExplainRequest

settings = get_settings()


class LLMExplainerService:
    def __init__(self) -> None:
        # Берём ключ либо из настроек, либо из переменной окружения
        api_key = settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY")

        if not api_key:
            # Ключ не задан — НЕ падаем, а просто помечаем, что LLM выключен
            self.client: OpenAI | None = None
        else:
            self.client = OpenAI(api_key=api_key)

        self.model = settings.OPENAI_MODEL

    def is_enabled(self) -> bool:
        return self.client is not None

    def _build_features_summary(self, req: TransactionExplainRequest) -> str:
        t = req.transaction

        lines = [
            f"Сумма перевода: {t.amount}",
            f"Количество версий ОС за 30 дней: {t.os_ver_cnt_30d}",
            f"Количество моделей телефона за 30 дней: {t.phone_model_cnt_30d}",
            f"Количество логин-сессий за 7 дней: {t.login_sessions_7d}",
            f"Количество логин-сессий за 30 дней: {t.login_sessions_30d}",
            f"Среднее число логинов в день за 7 дней: {t.logins_per_day_7d}",
            f"Среднее число логинов в день за 30 дней: {t.logins_per_day_30d}",
            f"Относительное изменение частоты логинов (7d vs 30d): {t.login_freq_change_7d_vs_30d}",
            f"Доля логинов за 7 дней от логинов за 30 дней: {t.logins_7d_share_of_30d}",
            f"Средний интервал между сессиями (30 дней): {t.avg_session_interval_30d}",
            f"Взрывность логинов: {t.burstiness_sessions}",
            f"Fano-factor логинов: {t.fano_factor_sessions}",
            f"Z-score интервалов (7d vs 30d): {t.zscore_interval_7d_vs_30d}",
        ]

        return "\n".join(lines)

    def explain(self, req: TransactionExplainRequest) -> str:
        # Если ключ не настроен — возвращаем заглушку, но не падаем
        if not self.is_enabled():
            return (
                "LLM-объяснение сейчас отключено: на backend не настроен OPENAI_API_KEY. "
                "Администратор может добавить его в .env, чтобы включить текстовые объяснения."
            )

        features_text = self._build_features_summary(req)

        prompt = dedent(
            f"""
            Ты — аналитик антифрод-системы банка.
            Твоя задача — коротко и понятно объяснить, почему модель оценила риск мошенничества именно так.

            Данные:
            - Вероятность фрода (от ML-модели): {req.fraud_probability:.4f}
            - Уровень риска: {req.risk_level}

            Признаки клиента и транзакции:
            {features_text}

            Требования к ответу:
            - Пиши по-русски.
            - Не больше 3–4 предложений.
            - Объясни, какие факторы больше всего говорят о риске (или, наоборот, о нормальном поведении).
            - Если данные выглядят спокойными, подчеркни это.
            - Не придумывай цифр, используй только то, что дано.
            """
        ).strip()

        completion = self.client.chat.completions.create(  # type: ignore[union-attr]
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Ты помогаешь сотруднику службы безопасности банка и "
                        "объясняешь решения антифрод-модели простым языком."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        )

        explanation = completion.choices[0].message.content or ""
        return explanation


llm_explainer_service = LLMExplainerService()
