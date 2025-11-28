Вот компактная инструкция, как запускать твой проект **с Docker и без Docker**.

---

## 0. Что у тебя есть в проекте

Условная структура (по тому, что мы уже делали):

```text
.
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ api/v1/scoring.py
│  │  ├─ core/config.py
│  │  ├─ schemas/transactions.py
│  │  └─ services/...
│  └─ Dockerfile
├─ frontend/
│  ├─ index.html
│  └─ src/...
├─ ml/
│  └─ models/model_xgb_baseline.pkl
├─ logs/                     # создаётся автоматически
├─ requirements.txt
├─ docker-compose.yml
└─ .env                      # настройки backend
```

Модель `model_xgb_baseline.pkl` уже должна быть сохранена из ноутбука.

---

## 1. Запуск **без Docker**

### 1.1. Установить зависимости

**Требования:**

* Python 3.11+
* Node.js + npm (желательно Node 18+)
* Установленный `pip`

```bash
# клонирование / переход в папку проекта
cd forte-anti-fraud

# создаём виртуальное окружение
python -m venv venv
source venv/bin/activate  # macOS / Linux
# или
# venv\Scripts\activate   # Windows

# ставим зависимости backend
pip install -r requirements.txt
```

### 1.2. Создать `.env` для backend

В корне проекта (`forte-anti-fraud/.env`):

```env
MODEL_PATH=ml/models/model_xgb_baseline.pkl
API_TOKEN=               # можно оставить пустым для dev!
LOG_DB_PATH=logs/scoring_logs.db
```

> ⚠️ Важно:
> Если `API_TOKEN` пустой → проверка токена **выключена**, фронт и curl работают без заголовка `X-API-Key`.
> Если поставишь значение (например `secret123`) → нужно будет добавлять `X-API-Key: secret123` во все запросы.

### 1.3. Запустить backend (FastAPI)

Из корня проекта:

```bash
uvicorn backend.app.main:app --reload
```

Backend поднимется на `http://localhost:8000`.

Проверка, что всё живо:

```bash
curl http://localhost:8000/
# -> {"status":"ok"}
```

Проверка скоринга (если `API_TOKEN` НЕ задан):

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

Если `API_TOKEN=secret123`, то:

```bash
curl -X POST "http://localhost:8000/api/v1/score_transaction" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: secret123" \
  -d '{
    "amount": 31000,
    "os_ver_cnt_30d": 2,
    "phone_model_cnt_30d": 1,
    "login_sessions_7d": 15,
    "login_sessions_30d": 80
  }'
```

### 1.4. Запустить frontend (Vite + React)

```bash
cd frontend
npm install

# dev-режим
npm run dev
```

По умолчанию Vite стартует на `http://localhost:5173`.

Наш фронт сам ходит на `http://localhost:8000/api/v1`, потому что в `src/services/api.ts` есть:

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const API_PREFIX = import.meta.env.VITE_API_PREFIX || "/api/v1";
```

То есть **переменные окружения не обязательны**, но при желании можно создать `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_API_PREFIX=/api/v1
```

Открываешь в браузере `http://localhost:5173` → форма, пресеты, история, воронка риска должны работать.

---

## 2. Запуск **с Docker**

Сейчас `docker-compose.yml` у нас отвечает только за backend. Фронт для простоты можно оставлять в dev-режиме (npm run dev) или собрать отдельно.

### 2.1. Подготовка `.env`

Тот же `.env` в корне, что и выше:

```env
MODEL_PATH=ml/models/model_xgb_baseline.pkl
API_TOKEN=      # для демо можно оставить пустым
LOG_DB_PATH=logs/scoring_logs.db
```

### 2.2. Собрать и запустить backend в Docker

Из корня проекта:

```bash
docker-compose up --build
```

Что произойдёт:

* Соберётся образ `backend` по `backend/Dockerfile`.
* В контейнер будет скопирован `backend/` и `ml/`.
* Создастся том/папка `./logs`, куда SQLite будет писать `scoring_logs.db`.
* Uvicorn запустит сервис на `0.0.0.0:8000`, проброшено наружу как `localhost:8000`.

Проверка:

```bash
curl http://localhost:8000/
# -> {"status":"ok"}
```

Если `API_TOKEN` пустой — фронт и curl работают без `X-API-Key`.
Если задан — нужно добавлять заголовок, как выше.

Остановить:

```bash
docker-compose down
```

### 2.3. Фронтенд при Docker-бэкенде

Вариант “по-быстрому для хакатона”:

* backend — в Docker (`docker-compose up`),
* frontend — как обычно:

```bash
cd frontend
npm install    # только первый раз
npm run dev
```

Фронт стучится на `http://localhost:8000`, так что всё прозрачно.

---

## 3. Краткий сценарий для жюри

**Без Docker (dev локально)**

```bash
# 1) backend
source venv/bin/activate
uvicorn backend.app.main:app --reload

# 2) frontend
cd frontend
npm run dev
```

Открываешь `http://localhost:5173`.

---

**С Docker (backend внутри, фронт отдельно)**

```bash
# backend
docker-compose up --build    # один раз для сборки

# frontend
cd frontend
npm run dev
```

Открываешь `http://localhost:5173`.
Бэкенд доступен на `http://localhost:8000` (внутри Docker), фронт работает как раньше.

---

Если захочешь позже упаковать **и фронт в Docker** (например, Nginx + статический билд Vite) — можно будет добавить второй сервис `frontend` в `docker-compose.yml` и собрать `npm run build` → Nginx. Но для хакатона достаточно текущего сетапа.
