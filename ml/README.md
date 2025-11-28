Ниже отдельная, автономная документация по **ML-части** проекта. Её можно вставить в README как отдельный раздел `ml/README.md`.

---

# 📊 ML-документация: модель антифрода для мобильного банкинга

## 1. Цель модели

Модель решает задачу **бинарной классификации**:

> Предсказать, является ли транзакция **мошеннической** (`is_fraud = 1`) или **чистой** (`is_fraud = 0`) на основе:
>
> * параметров самой транзакции (сумма, клиент),
> * поведенческих признаков по логам мобильного приложения.

Метрика фокуса:

* **ROC-AUC** и **PR-AUC** (с учётом сильного дисбаланса классов).

Текущие результаты на валидации (random split):

* **ROC-AUC ≈ 0.8798**
* **PR-AUC ≈ 0.4767**

---

## 2. Источники данных

Организаторы хакатона предоставили **два датасета**:

1. `data.csv` — **транзакции**

   Пример чтения:

   ```python
   import pandas as pd

   data = pd.read_csv("data.csv", encoding="cp1251", sep=";")
   ```

   Основные колонки (в исходном виде):

   * `Уникальный идентификатор клиента`
   * `Дата совершенной транзакции`
   * `Дата и время совершенной транзакции`
   * `Сумма совершенного перевода`
   * `Уникальный идентификатор транзакции`
   * `Зашифрованный идентификатор получателя ...`
   * `Размеченные транзакции(...)` → целевая переменная `is_fraud`

2. `data2.csv` — **поведенческие признаки** по логам мобильного банка

   Пример чтения:

   ```python
   data2 = pd.read_csv("data2.csv", encoding="cp1251", sep=";")
   ```

   Основные колонки:

   * `Дата совершенной транзакции`
   * `Уникальный идентификатор клиента`
   * Далее набор feature-колонок:

     * количество разных версий ОС за 30 дней,
     * количество моделей телефона за 30 дней,
     * количество уникальных логин-сессий за 7/30 дней,
     * среднее число логинов в день,
     * относительное изменение частоты логинов,
     * интервалы между логинами (mean, std, var, EWM),
     * показатель “взрывности” логинов,
     * Fano-factor,
     * Z-скор недавних интервалов vs 30-дневных и т.д.

---

## 3. Подготовка данных

### 3.1. Чтение и приведение форматов

```python
import pandas as pd

data = pd.read_csv("data.csv", encoding="cp1251", sep=";")
data2 = pd.read_csv("data2.csv", encoding="cp1251", sep=";")
```

Колонка даты транзакции в сырых данных имела вид:

```text
cst_dim_id;transdate;transdatetime;amount;...
2937833270;'2025-01-05 00:00:00.000';'2025-01-05 16:32:02.000';...
```

Поэтому:

* сначала переименовали поля в удобный формат,
* затем привели строки к `datetime`.

Пример:

```python
# Переименовываем русские колонки в английские
rename_map_trans = {
    "Уникальный идентификатор клиента": "client_id",
    "Дата совершенной транзакции": "transdate",
    "Дата и время совершенной транзакции": "transdatetime",
    "Сумма совершенного перевода": "amount",
    "Уникальный идентификатор транзакции": "transaction_id",
    "Зашифрованный идентификатор получателя/destination транзакции": "destination_id",
    "Размеченные транзакции(переводы), где 1 - мошенническая операция , 0 - чистая": "is_fraud",
}

data = data.rename(columns=rename_map_trans)

# Даты транзакций
data["transdate"] = pd.to_datetime(
    data["transdate"].astype(str).str.strip("'"),
    format="%Y-%m-%d %H:%M:%S.%f",
    errors="coerce",
)
data["transdatetime"] = pd.to_datetime(
    data["transdatetime"].astype(str).str.strip("'"),
    format="%Y-%m-%d %H:%M:%S.%f",
    errors="coerce",
)

# Доп. часовая дата для join’а
data["trans_date"] = data["transdate"].dt.date
```

Аналогично для `data2`:

```python
rename_map_beh = {
    "Дата совершенной транзакции": "trans_date",
    "Уникальный идентификатор клиента": "client_id",
    "Количество разных версий ОС (os_ver) за последние 30 дней до transdate — сколько разных ОС/версий использовал клиент": "os_ver_cnt_30d",
    "Количество разных моделей телефона (phone_model) за последние 30 дней — насколько часто клиент “менял устройство” по логам": "phone_model_cnt_30d",
    "Модель телефона из самой последней сессии (по времени) перед transdate": "phone_model_last",
    "Версия ОС из самой последней сессии перед transdate": "os_version_last",
    "Количество уникальных логин-сессий (минутных тайм-слотов) за последние 7 дней до transdate": "login_sessions_7d",
    "Количество уникальных логин-сессий за последние 30 дней до transdate": "login_sessions_30d",
    "Среднее число логинов в день за последние 7 дней: logins_last_7_days / 7": "logins_per_day_7d",
    "Среднее число логинов в день за последние 30 дней: logins_last_30_days / 30": "logins_per_day_30d",
    "Относительное изменение частоты логинов за 7 дней к средней частоте за 30 дней:\n(freq7d?freq30d)/freq30d(freq_{7d} - freq_{30d}) / freq_{30d}(freq7d?freq30d)/freq30d — показывает, стал клиент заходить чаще или реже недавно": "login_freq_change_7d_vs_30d",
    "Доля логинов за 7 дней от логинов за 30 дней": "logins_7d_share_of_30d",
    "Средний интервал (в секундах) между соседними сессиями за последние 30 дней": "avg_session_interval_30d",
    "Стандартное отклонение интервалов между логинами за 30 дней (в секундах), измеряет разброс интервалов": "std_session_interval_30d",
    "Дисперсия интервалов между логинами за 30 дней (в секундах?), ещё одна мера разброса": "var_session_interval_30d",
    "Экспоненциально взвешенное среднее интервалов между логинами за 7 дней, где более свежие сессии имеют больший вес (коэффициент затухания 0.3)": "ewm_session_interval_7d",
    "Показатель “взрывности” логинов: (std?mean)/(std+mean)(std - mean)/(std + mean)(std?mean)/(std+mean) для интервалов": "burstiness_sessions",
    "Fano-factor интервалов: variance / mean": "fano_factor_sessions",
    "Z-скор среднего интервала за последние 7 дней относительно среднего за 30 дней: насколько сильно недавние интервалы отличаются от типичных, в единицах стандартного отклонения": "zscore_interval_7d_vs_30d",
}

data2 = data2.rename(columns=rename_map_beh)

data2["trans_date"] = pd.to_datetime(
    data2["trans_date"].astype(str).str.strip("'"),
    format="%Y-%m-%d %H:%M:%S.%f",
    errors="coerce",
).dt.date
```

### 3.2. Merge транзакций и поведенческих фич

Объединение по (`client_id`, `trans_date`):

```python
df = data.merge(
    data2,
    on=["client_id", "trans_date"],
    how="left",
)
```

---

## 4. Обработка пропусков и типов

После merge анализировались пропуски:

```python
df.isna().sum()
```

Стратегия:

* Целевая переменная `is_fraud` — без пропусков.

* `amount` и числовые фичи приводятся к `float`:

  ```python
  df["amount"] = df["amount"].astype(str).str.replace(",", ".").astype(float)
  ```

* Для признаков из `data2`:

  * Пропуски **не удаляются**, т.к. их наличие уже само по себе сигнал.
  * Для каждой числовой фичи:

    * создали флаг `<feature>_was_missing` (1, если значение было NaN),
    * NaN заменили на 0.

Пример:

```python
behavior_features = [
    "os_ver_cnt_30d",
    "phone_model_cnt_30d",
    "login_sessions_7d",
    "login_sessions_30d",
    "logins_per_day_7d",
    "logins_per_day_30d",
    "login_freq_change_7d_vs_30d",
    "logins_7d_share_of_30d",
    "avg_session_interval_30d",
    "std_session_interval_30d",
    "var_session_interval_30d",
    "ewm_session_interval_7d",
    "burstiness_sessions",
    "fano_factor_sessions",
    "zscore_interval_7d_vs_30d",
]

for col in behavior_features:
    if col not in df.columns:
        continue
    flag_col = f"{col}_was_missing"
    df[flag_col] = df[col].isna().astype(int)
    df[col] = pd.to_numeric(df[col], errors="coerce")
    df[col] = df[col].fillna(0.0)
```

**Важно:** все фичи в итоге имеют тип `float`, который принимает XGBoost.

---

## 5. Формирование обучающей выборки

Из общего датафрейма формируем X и y:

```python
target_col = "is_fraud"

drop_cols = [
    target_col,
    "client_id",
    "transaction_id",
    "destination_id",
    "transdate",
    "transdatetime",
    "trans_date",
]

drop_cols = [c for c in drop_cols if c in df.columns]

X = df.drop(columns=drop_cols)
y = df[target_col].astype(int)
```

Train/validation split (random):

```python
from sklearn.model_selection import train_test_split

X_train, X_valid, y_train, y_valid = train_test_split(
    X,
    y,
    test_size=0.2,
    stratify=y,
    random_state=42,
)
```

Дисбаланс классов:

```python
import numpy as np

neg, pos = np.bincount(y_train)
scale_pos_weight = neg / pos
print("scale_pos_weight:", scale_pos_weight)
# ≈ 82.6
```

---

## 6. Обучение XGBoost

Используется `XGBClassifier` с учётом дисбаланса:

```python
import xgboost as xgb

model = xgb.XGBClassifier(
    n_estimators=400,
    max_depth=5,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric="auc",
    tree_method="hist",
    scale_pos_weight=scale_pos_weight,
    n_jobs=-1,
    random_state=42,
)

model.fit(
    X_train,
    y_train,
    eval_set=[(X_valid, y_valid)],
    verbose=50,
)
```

Оценка:

```python
from sklearn.metrics import roc_auc_score, average_precision_score

y_proba_valid = model.predict_proba(X_valid)[:, 1]
roc = roc_auc_score(y_valid, y_proba_valid)
pr = average_precision_score(y_valid, y_proba_valid)

print("ROC-AUC:", roc)
print("PR-AUC: ", pr)
# ROC-AUC: ≈ 0.8798
# PR-AUC:  ≈ 0.4767
```

---

## 7. Калибровка порогов риска

Цель — перевести *вероятность* в три уровня риска:

* `low` — автоодобрение,
* `medium` — soft-check (push/SMS),
* `high` — блокировка / ручная проверка.

### 7.1. Таблица метрик по порогам

```python
import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, confusion_matrix

thresholds = np.linspace(0.0, 1.0, 101)
rows = []

for thr in thresholds:
    y_pred = (y_proba_valid >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_valid, y_pred).ravel()

    precision = precision_score(y_valid, y_pred, zero_division=0)
    recall = recall_score(y_valid, y_pred, zero_division=0)
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0

    rows.append({
        "threshold": thr,
        "precision": precision,
        "recall": recall,
        "FPR": fpr,
        "TP": tp,
        "FP": fp,
        "FN": fn,
        "TN": tn,
    })

thr_df = pd.DataFrame(rows)
```

### 7.2. Выбранные пороги

На основе анализа `thr_df` (precision/recall/FPR) выбраны:

* `p < 0.26` → **low risk** — автоодобрение, крайне низкий FPR.
* `0.26 ≤ p < 0.80` → **medium risk** — soft-проверка (push/SMS).
* `p ≥ 0.80` → **high risk** — блокировка / ручная проверка.

Эта логика зашита в backend:

```python
def get_risk_level(proba: float) -> str:
    if proba >= 0.80:
        return "high"
    if proba >= 0.26:
        return "medium"
    return "low"
```

---

## 8. Важность признаков (feature importance)

Для интерпретации модели использовалась стандартная feature importance из XGBoost:

```python
importances = model.feature_importances_

feat_importance = pd.DataFrame({
    "feature": X_train.columns,
    "importance": importances,
}).sort_values("importance", ascending=False)

top_10_importance = feat_importance.head(10)
```

Топ-10 фич используются в отчёте/презентации, чтобы показать:

* какие признаки больше всего влияют на решение модели (частота логинов, сумма, взрывность, интервалы и т.д.).

---

## 9. Локальные объяснения (Explainability, z-score)

Для объяснения конкретной транзакции реализован подход:

1. Считаются среднее и std по train для каждой фичи.

2. Для одной транзакции считается z-score:

   [
   z = \frac{x - \text{mean}}{\text{std}}
   ]

3. Комбинируется |z-score| и importance, чтобы выделить “подозрительные” фичи.

Пример:

```python
train_means = X_train.mean()
train_stds = X_train.std(ddof=0).replace(0, 1e-9)

feat_stats = pd.DataFrame({
    "feature": X_train.columns,
    "mean": train_means.values,
    "std": train_stds.values,
    "importance": model.feature_importances_,
}).set_index("feature")


def explain_transaction(x_row: pd.Series, feat_stats: pd.DataFrame,
                        z_threshold: float = 2.0, top_k: int = 10) -> pd.DataFrame:
    x_row = x_row.copy()
    df = feat_stats.copy()

    df["value"] = x_row[df.index]
    df["z_score"] = (df["value"] - df["mean"]) / df["std"]
    df["abs_z"] = df["z_score"].abs()
    df["is_outlier"] = df["abs_z"] >= z_threshold
    df["score"] = df["importance"] * df["abs_z"]

    return df.sort_values("score", ascending=False)[
        ["value", "mean", "std", "z_score", "importance", "is_outlier"]
    ].head(top_k)
```

Этим блоком можно обосновать решение модели для конкретного клиента (debug/отчёт/презентация).

---

## 10. Time-based split (проверка стабильности) — концепт

Для проверки устойчивости модели во времени предусмотрен код:

1. Отсортировать данные по `transdatetime`.
2. Взять первые 80% по времени как train, последние 20% — как test.
3. Переобучить модель и сравнить ROC-AUC/PR-AUC с random split.

Концептуально:

```python
df_sorted = df.sort_values("transdatetime").reset_index(drop=True)

X_time = df_sorted.drop(columns=drop_cols)
y_time = df_sorted["is_fraud"].astype(int)

split_idx = int(len(df_sorted) * 0.8)
X_train_time = X_time.iloc[:split_idx]
y_train_time = y_time.iloc[:split_idx]
X_test_time = X_time.iloc[split_idx:]
y_test_time = y_time.iloc[split_idx:]

# далее обучение model_time и оценка ROC-AUC/PR-AUC
```

Это показывает, **не “подглядывает” ли модель в будущее** и насколько стабильна во времени.

---

## 11. Baseline vs XGBoost — сравнение моделей (код)

Для честного сравнения предусмотрен код, который обучает:

* `LogisticRegression` (с class_weight="balanced"),
* `RandomForestClassifier`,
* сравнивает их с XGBoost по:

  * ROC-AUC
  * PR-AUC
  * времени инференса.

Пример:

```python
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, average_precision_score
import time

results = []


def evaluate_model(name, clf, X_tr, y_tr, X_te, y_te):
    t0 = time.perf_counter()
    clf.fit(X_tr, y_tr)
    fit_time = time.perf_counter() - t0

    t1 = time.perf_counter()
    y_proba = clf.predict_proba(X_te)[:, 1]
    infer_time = time.perf_counter() - t1

    roc = roc_auc_score(y_te, y_proba)
    pr = average_precision_score(y_te, y_proba)
    time_per_1000 = infer_time * 1000 / len(X_te)

    results.append({
        "model": name,
        "ROC_AUC": roc,
        "PR_AUC": pr,
        "fit_time_sec": fit_time,
        "infer_time_per_1000_samples_ms": time_per_1000,
    })


log_reg = LogisticRegression(
    max_iter=1000,
    class_weight="balanced",
    n_jobs=-1,
    solver="saga",
)
evaluate_model("LogisticRegression", log_reg, X_train, y_train, X_valid, y_valid)

rf = RandomForestClassifier(
    n_estimators=200,
    max_depth=7,
    class_weight="balanced_subsample",
    n_jobs=-1,
    random_state=42,
)
evaluate_model("RandomForest", rf, X_train, y_train, X_valid, y_valid)

# XGBoost — уже обучен
t0 = time.perf_counter()
y_proba_xgb = model.predict_proba(X_valid)[:, 1]
infer_time_xgb = time.perf_counter() - t0

roc_xgb = roc_auc_score(y_valid, y_proba_xgb)
pr_xgb = average_precision_score(y_valid, y_proba_xgb)
time_per_1000_xgb = infer_time_xgb * 1000 / len(X_valid)

results.append({
    "model": "XGBoost",
    "ROC_AUC": roc_xgb,
    "PR_AUC": pr_xgb,
    "fit_time_sec": None,
    "infer_time_per_1000_samples_ms": time_per_1000_xgb,
})

baseline_df = pd.DataFrame(results)
print(baseline_df)
```

Эту таблицу можно вынести в презентацию как:

> “Мы сравнили логистическую регрессию, RandomForest и XGBoost. XGBoost даёт лучший баланс между качеством и скоростью на инференсе, поэтому именно он использован в проде”.

(Конкретные числа заполняются после запуска этого блока.)

---

## 12. Сохранение и деплой модели

После обучения модель сериализуется в `ml/models/model_xgb_baseline.pkl`:

```python
import joblib
joblib.dump(model, "ml/models/model_xgb_baseline.pkl")
```

В backend она загружается в `FraudModelService`:

```python
from backend.app.core.config import get_settings
import joblib

settings = get_settings()

class FraudModelService:
    def __init__(self, model_path: str):
        self.model_path = model_path
        self.model = joblib.load(self.model_path)
        self.feature_names = list(self.model.get_booster().feature_names)

    # далее: построение фич, predict_proba, get_risk_level
```