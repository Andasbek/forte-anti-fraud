# backend/app/services/audit_logger.py
from __future__ import annotations

import os
import sqlite3
from datetime import datetime
from typing import Optional

from backend.app.core.config import get_settings

settings = get_settings()


def _get_connection() -> sqlite3.Connection:
    db_path = settings.LOG_DB_PATH
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path, check_same_thread=False)
    return conn


def init_log_db() -> None:
    conn = _get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS scoring_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            client_id TEXT,
            amount REAL,
            fraud_probability REAL,
            risk_level TEXT
        )
        """
    )
    conn.commit()
    conn.close()


def log_scoring_event(
    client_id: Optional[str],
    amount: Optional[float],
    fraud_probability: float,
    risk_level: str,
) -> None:
    """
    Логируем событие скоринга в SQLite.
    """
    conn = _get_connection()
    cur = conn.cursor()
    ts = datetime.utcnow().isoformat()
    cur.execute(
        """
        INSERT INTO scoring_logs (ts, client_id, amount, fraud_probability, risk_level)
        VALUES (?, ?, ?, ?, ?)
        """,
        (ts, client_id, amount, fraud_probability, risk_level),
    )
    conn.commit()
    conn.close()
