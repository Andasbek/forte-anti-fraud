Окей, давай оформим **документацию только для backend** как в нормальном README. Потом аналогично сделаем для ML и фронта.

---

# 📌 Backend-документация (FastAPI антифрод-сервис)

## 1. Назначение сервиса

`backend` — это REST API для скоринга транзакций в мобильном банкинге:

* принимает параметры транзакции и поведенческие признаки клиента,
* возвращает вероятность мошенничества и уровень риска (`low/medium/high`),
* логирует все запросы в SQLite для последующего анализа.

---

## 2. Стек

* **Язык:** Python 3.11+
* **Фреймворк:** FastAPI
* **Model serving:** XGBoost-модель, загружается через `joblib`
* **Хранилище логов:** SQLite
* **WS сервер:** uvicorn

---

## 3. Структура backend-проекта

```text
backend/
│
├─ app/
│  ├─ main.py                # Точка входа FastAPI (создание app, CORS, роуты)
│  ├─ api/
│  │  └─ v1/
│  │     └─ scoring.py       # Эндпоинты /score_transaction и /score_batch
│  ├─ core/
│  │  └─ config.py           # Настройки (MODEL_PATH, пороги риска, LOG_DB_PATH, API_TOKEN)
│  ├─ schemas/
│  │  └─ transactions.py     # Pydantic-схемы запросов/ответов
│  └─ services/
│     ├─ fraud_model.py      # Загрузка модели, построение фич, скоринг, risk_level
│     └─ audit_logger.py     # Логирование результатов скоринга в SQLite
│
└─ Dockerfile                # Docker-образ backend-сервиса
```

Модель хранится вне backend-папки:

```text
ml/models/model_xgb_baseline.pkl
```

---

## 4. Конфигурация (`.env` и config.py)

Все настройки читаются в `backend/app/core/config.py` через Pydantic `BaseSettings`.

Пример `.env` в **корне проекта**:

```env
# Путь к обученной XGBoost-модели
MODEL_PATH=ml/models/model_xgb_baseline.pkl

# Простой API-токен (если оставить пустым — проверка отключена)
API_TOKEN=

# Путь к SQLite-базе для логов
LOG_DB_PATH=logs/scoring_logs.db
```

В `config.py` эти значения выглядят так:

```python
class Settings(BaseSettings):
    MODEL_PATH: str = "ml/models/model_xgb_baseline.pkl"

    # Пороги риска (калиброваны по валидации)
    RISK_THRESHOLD_MEDIUM: float = 0.26
    RISK_THRESHOLD_HIGH: float = 0.80

    PROJECT_NAME: str = "Forte Anti-Fraud API"
    API_V1_PREFIX: str = "/api/v1"

    API_TOKEN: str | None = None           # если не пустой — включается проверка X-API-Key
    LOG_DB_PATH: str = "logs/scoring_logs.db"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
```

---

## 5. Запуск backend без Docker

### 5.1. Установка зависимостей

```bash
cd forte-anti-fraud

python -m venv venv
source venv/bin/activate   # macOS / Linux
# или venv\Scripts\activate   # Windows

pip install -r requirements.txt
```

### 5.2. Проверка `.env`

Убедись, что в корне есть `.env`:

```env
MODEL_PATH=ml/models/model_xgb_baseline.pkl
API_TOKEN=       # для разработки можно оставить пустым
LOG_DB_PATH=logs/scoring_logs.db
```

### 5.3. Старт FastAPI

```bash
uvicorn backend.app.main:app --reload
```

Сервис поднимется на `http://localhost:8000`.

Проверка здоровья:

```bash
curl http://localhost:8000/
# -> {"status":"ok"}
```

Если `API_TOKEN` пустой → токен не требуется.
Если ты задашь, например `API_TOKEN=secret123`, тогда к запросам нужно добавлять заголовок `X-API-Key: secret123`.

---

## 6. Запуск backend в Docker

### 6.1. Dockerfile (backend/Dockerfile)

Мы уже настроили Dockerfile примерно так:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY ml ./ml

ENV PYTHONPATH=/app
RUN mkdir -p /app/logs

EXPOSE 8000

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 6.2. docker-compose.yml (в корне проекта)

```yaml
version: "3.9"

services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    env_file:
      - .env
    ports:
      - "8000:8000"
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

### 6.3. Запуск

```bash
docker-compose up --build
```

Проверка:

```bash
curl http://localhost:8000/
# -> {"status":"ok"}
```

---

## 7. Эндпоинты API

### 7.1. `GET /` — health-check

**Описание:** простой пинг, чтобы проверить, что сервис жив.

* **Запрос:**

  ```bash
  curl http://localhost:8000/
  ```

* **Ответ:**

  ```json
  {
    "status": "ok"
  }
  ```

---

### 7.2. `POST /api/v1/score_transaction` — скоринг одной транзакции

**Назначение:** оценка риска мошенничества для одной транзакции.

**URL:**

```text
POST /api/v1/score_transaction
```

**Заголовки:**

* `Content-Type: application/json`
* `X-API-Key: <token>` — *только если* `API_TOKEN` задан в `.env`.

**Тело запроса (JSON, Pydantic-схема `TransactionScoringRequest`):**

```json
{
  "client_id": "12345",
  "amount": 31000,
  "os_ver_cnt_30d": 2,
  "phone_model_cnt_30d": 1,
  "login_sessions_7d": 15,
  "login_sessions_30d": 80,
  "logins_per_day_7d": 1.5,
  "logins_per_day_30d": 1.2,
  "login_freq_change_7d_vs_30d": 0.1,
  "logins_7d_share_of_30d": 0.3,
  "avg_session_interval_30d": 60,
  "std_session_interval_30d": 5,
  "var_session_interval_30d": 25,
  "ewm_session_interval_7d": 30,
  "burstiness_sessions": 0.8,
  "fano_factor_sessions": 2.0,
  "zscore_interval_7d_vs_30d": -1.2
}
```

> Все признаки, кроме `amount`, **опциональны**.
> Если какое-то поле не передано, сервис:
>
> * подставляет `0`,
> * выставляет соответствующий флаг `<feature>_was_missing = 1` для модели.

**Пример минимального запроса:**

```bash
curl -X POST "http://localhost:8000/api/v1/score_transaction" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 31000,
    "os_ver_cnt_30d": 2,
    "phone_model_cnt_30d": 1,
    "login_sessions_7d": 15,
    "login_sessions_30d": 80
  }'
```

**Ответ (`TransactionScoringResponse`):**

```json
{
  "fraud_probability": 0.0006920851301401854,
  "risk_level": "low",
  "model_version": "xgb_baseline_v1"
}
```

* `fraud_probability` — вероятность мошенничества (0..1),
* `risk_level` — категоризация по порогам (низкий/средний/высокий риск),
* `model_version` — строка для версии модели (можно обновлять при релизах).

---

### 7.3. `POST /api/v1/score_batch` — скоринг списка транзакций

**Назначение:** пакетная оценка транзакций (например, “день операций”).

**URL:**

```text
POST /api/v1/score_batch
```

**Тело запроса (`BatchScoringRequest`):**

```json
{
  "items": [
    {
      "client_id": "12345",
      "amount": 31000,
      "os_ver_cnt_30d": 2,
      "phone_model_cnt_30d": 1,
      "login_sessions_7d": 15,
      "login_sessions_30d": 80
    },
    {
      "client_id": "67890",
      "amount": 250000,
      "os_ver_cnt_30d": 3,
      "phone_model_cnt_30d": 2,
      "login_sessions_7d": 4,
      "login_sessions_30d": 10
    }
  ]
}
```

**Ответ (`BatchScoringResponse`):**

```json
{
  "results": [
    {
      "fraud_probability": 0.0012,
      "risk_level": "low",
      "model_version": "xgb_baseline_v1"
    },
    {
      "fraud_probability": 0.8453,
      "risk_level": "high",
      "model_version": "xgb_baseline_v1"
    }
  ]
}
```

---

## 8. Логирование (SQLite)

Модуль `audit_logger.py` пишет логи в SQLite-файл `logs/scoring_logs.db`.

### Структура таблицы `scoring_logs`

```sql
CREATE TABLE IF NOT EXISTS scoring_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,             -- время запроса (UTC, ISO-строка)
    client_id TEXT,               -- client_id из запроса, если был
    amount REAL,                  -- сумма транзакции
    fraud_probability REAL,       -- вероятность фрода
    risk_level TEXT               -- уровень риска (low/medium/high)
);
```

Каждый вызов `/score_transaction` и каждый элемент в `/score_batch`:

* получает запись в `scoring_logs`,
* используется потом для:

  * аналитики качества модели,
  * построения дашборда,
  * анализа дрейфа (сдвига) данных.

SQLite-файл можно открыть через любой клиент (DBeaver, DataGrip, `sqlite3` CLI) или прочитать pandas’ом из ноутбука:

```python
import sqlite3
import pandas as pd

conn = sqlite3.connect("logs/scoring_logs.db")
df_logs = pd.read_sql_query("SELECT * FROM scoring_logs ORDER BY ts DESC LIMIT 100", conn)
conn.close()
df_logs.head()
```

---

## 9. CORS и взаимодействие с фронтендом

В `main.py` уже настроен CORS:

```python
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
```

Это позволяет фронтенду (Vite dev server) с `localhost:5173` делать `POST`-запросы на `http://localhost:8000/api/v1/...` без ошибок CORS.