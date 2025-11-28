```
forte-anti-fraud/
├─ data/
│  ├─ raw/                      # Сырые данные
│  ├─ processed/                # Обработанные/агрегированные данные
│  └─ README.md
├─ ml/
│  ├─ notebooks/                # Jupyter ноутбуки (EDA, эксперименты)
│  │  ├─ 01_eda_baseline.ipynb
│  │  ├─ 02_feature_engineering.ipynb
│  │  └─ 03_model_selection_explainability.ipynb
│  ├─ pipelines/                # Скрипты подготовки фич и обучения
│  │  ├─ train_pipeline.py
│  │  └─ preprocess.py
│  └─ models/                   # Сохранённые модели и пайплайны
│     ├─ model.pkl
│     └─ pipeline.pkl
├─ backend/
│  ├─ app/
│  │  ├─ main.py                # Точка входа FastAPI
│  │  ├─ api/
│  │  │  └─ v1/
│  │  │     └─ scoring.py       # Эндпоинты /score_transaction и др.
│  │  ├─ core/
│  │  │  └─ config.py           # Настройки (пути к моделям, env)
│  │  ├─ schemas/
│  │  │  ├─ transactions.py     # Pydantic-схемы запрос/ответ
│  │  └─ services/
│  │     └─ fraud_model.py      # Загрузка модели, inference, explain
│  └─ tests/                    # pytest-тесты backend'а
│     ├─ __init__.py
│     ├─ conftest.py            # фикстуры (тестовый клиент FastAPI, данные)
│     ├─ test_api.py            # тесты REST API
│     └─ test_fraud_model.py    # тесты инференса модели
├─ frontend/
│  ├─ public/                   # Статика (favicon, index.html если React)
│  ├─ src/
│  │  ├─ assets/                # Иконки, картинки, шрифты
│  │  ├─ components/
│  │  │  ├─ TransactionForm.tsx # Форма ввода транзакции
│  │  │  ├─ RiskResult.tsx      # Блок с результатом/объяснением
│  │  │  └─ Layout.tsx          # Общий layout, navbar, тёмная тема
│  │  ├─ pages/
│  │  │  ├─ Dashboard.tsx       # Главная страница (панель антифрода)
│  │  │  └─ History.tsx         # (опционально) История проверок
│  │  ├─ services/
│  │  │  └─ api.ts              # Обёртка над backend API (fetch/axios)
│  │  ├─ styles/
│  │  │  └─ main.css            # Общий стиль (можно Tailwind/Bootstrap)
│  │  └─ main.tsx               # Точка входа фронта
│  ├─ vite.config.ts            # если используешь Vite
│  ├─ package.json
│  └─ tsconfig.json             # если TypeScript
├─ tests/
│  ├─ __init__.py
│  ├─ conftest.py                # общие фикстуры для ML/утилит
│  ├─ test_preprocess.py         # тесты функций подготовки фич
│  └─ test_train_pipeline.py     # тесты обучения/сохранения модели
├─ docs/
│  ├─ architecture.png           # Архитектура решения
│  ├─ system_design.md           # Описание архитектуры, сценариев
│  └─ presentation.pptx          # Слайды для защиты
├─ reports/
│  ├─ figures/                   # Графики метрик, SHAP, importance
│  └─ metrics.md                 # Описание результатов моделей
├─ requirements.txt              # Python-зависимости (ml + backend + tests)
├─ pyproject.toml                # (опционально) настройка pytest/ruff и т.д.
├─ package.json                  # (корневой, если нужно, но лучше в frontend/)
├─ README.md                     # Общее описание + как запустить всё
└─ .gitignore
```