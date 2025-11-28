# %%
import pandas as pd
from pathlib import Path
import numpy as np
from sklearn.preprocessing import LabelEncoder

# %%
# --- настройки путей ---
DATA_DIR = Path(".")

# %%
# --- 1. загрузка сырых данных ---
data = pd.read_csv(DATA_DIR / "data.csv", sep=";", encoding="cp1251")
data2 = pd.read_csv(DATA_DIR / "data2.csv", sep=";", encoding="cp1251")

# %%
print("data.shape:", data.shape)
print("data2.shape:", data2.shape)

# %%
# --- 2. переименование колонок в data (транзакции) ---

# вариант 1: уже английские названия (как в примере cst_dim_id;transdate;...)
if "cst_dim_id" in data.columns:
    data = data.rename(columns={
        "cst_dim_id": "client_id",
        "transdate": "transdate",
        "transdatetime": "transdatetime",
        "amount": "amount",
        "docno": "transaction_id",
        "direction": "destination_id",   # тут direction/destination_id – по датасету
        "target": "is_fraud",
    })
# вариант 2: русские названия (из описания хакатона)
elif "Уникальный идентификатор клиента" in data.columns:
    data = data.rename(columns={
        "Уникальный идентификатор клиента": "client_id",
        "Дата совершенной транзакции": "transdate",
        "Дата и время совершенной транзакции": "transdatetime",
        "Сумма совершенного перевода": "amount",
        "Уникальный идентификатор транзакции": "transaction_id",
        "Зашифрованный идентификатор получателя/destination транзакции": "destination_id",
        "Размеченные транзакции(переводы), где 1 - мошенническая операция , 0 - чистая": "is_fraud",
    })

# --- 3. переименование колонок в data2 (поведенческие фичи) ---

if "cst_dim_id" in data2.columns:
    data2 = data2.rename(columns={
        "cst_dim_id": "client_id",
        "transdate": "transdate",
    })
elif "Уникальный идентификатор клиента" in data2.columns:
    data2 = data2.rename(columns={
        "Уникальный идентификатор клиента": "client_id",
        "Дата совершенной транзакции": "transdate",
    })




# %%
# --- 4. парсинг дат с учётом формата '2025-01-05 00:00:00.000' ---
def parse_datetime_column(series: pd.Series) -> pd.Series:
    """
    Приводим строки вида '2025-01-05 00:00:00.000' к datetime.
    Убираем лишние одинарные кавычки.
    """
    return pd.to_datetime(
        series.astype(str).str.strip().str.strip("'"),
        format="%Y-%m-%d %H:%M:%S.%f",
        errors="coerce"
    )


# %%
# transdate и transdatetime в data
data["transdate"] = parse_datetime_column(data["transdate"])
data["transdatetime"] = parse_datetime_column(data["transdatetime"])

# transdate в data2
data2["transdate"] = parse_datetime_column(data2["transdate"])

# выбрасываем строки, где дата не распарсилась (если таких мало)
data = data.dropna(subset=["client_id", "transdate", "transdatetime"]).copy()
data2 = data2.dropna(subset=["client_id", "transdate"]).copy()

# переводим в "чистую дату" для ключа мерджа
data["trans_date"] = data["transdate"].dt.date
data2["trans_date"] = data2["transdate"].dt.date

# целевую метку в int
if data["is_fraud"].dtype != "int64":
    data["is_fraud"] = data["is_fraud"].astype(int)

print("\nПосле очистки:")
print("data.shape:", data.shape)
print("data2.shape:", data2.shape)

# %%
# --- 5. мердж транзакций и поведенческих фичей ---

# чтобы не дублировать колонку transdate при merge
data2_for_merge = data2.drop(columns=["transdate"])

df = data.merge(
    data2_for_merge,
    on=["client_id", "trans_date"],
    how="left"
)

print("\nИтоговый df.shape:", df.shape)
print("\nПример строк:")
display(df.head())


# %%
print("\nПропуски по столбцам:")
display(df.isna().sum())

# %%
df_model = df.dropna(subset=[
    'Количество разных версий ОС (os_ver) за последние 30 дней до transdate — сколько разных ОС/версий использовал клиент',
    'Количество разных моделей телефона (phone_model) за последние 30 дней — насколько часто клиент “менял устройство” по логам',
    # ... остальные фичи из data2
]).copy()


# %%
df = df_model.copy()

# %%
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, average_precision_score
import xgboost as xgb
import joblib

# %%
# ---------------------------------------------------------------------
# 1. КОПИЯ ОБЪЕДИНЁННОГО ДАТАФРЕЙМА
# ---------------------------------------------------------------------
# предполагаем, что у тебя уже есть df после merge data + data2
df_proc = df.copy()

# %%
# ---------------------------------------------------------------------
# 2. РЕЙНЕЙМ РУССКИХ КОЛОНОК В EN SNAKE_CASE
#    (по startswith, чтобы не мучиться с длинными строками)
# ---------------------------------------------------------------------
rename_map = {}

for col in df_proc.columns:
    if col.startswith('Количество разных версий ОС'):
        rename_map[col] = 'os_ver_cnt_30d'
    elif col.startswith('Количество разных моделей телефона'):
        rename_map[col] = 'phone_model_cnt_30d'
    elif col.startswith('Модель телефона из самой последней сессии'):
        rename_map[col] = 'phone_model_last'
    elif col.startswith('Версия ОС из самой последней сессии'):
        rename_map[col] = 'os_version_last'
    elif col.startswith('Количество уникальных логин-сессий (минутных тайм-слотов) за последние 7 дней'):
        rename_map[col] = 'login_sessions_7d'
    elif col.startswith('Количество уникальных логин-сессий за последние 30 дней'):
        rename_map[col] = 'login_sessions_30d'
    elif col.startswith('Среднее число логинов в день за последние 7 дней'):
        rename_map[col] = 'logins_per_day_7d'
    elif col.startswith('Среднее число логинов в день за последние 30 дней'):
        rename_map[col] = 'logins_per_day_30d'
    elif col.startswith('Относительное изменение частоты логинов'):
        rename_map[col] = 'login_freq_change_7d_vs_30d'
    elif col.startswith('Доля логинов за 7 дней'):
        rename_map[col] = 'logins_7d_share_of_30d'
    elif col.startswith('Средний интервал (в секундах) между соседними сессиями за последние 30 дней'):
        rename_map[col] = 'avg_session_interval_30d'
    elif col.startswith('Стандартное отклонение интервалов между логинами за 30 дней'):
        rename_map[col] = 'std_session_interval_30d'
    elif col.startswith('Дисперсия интервалов между логинами за 30 дней'):
        rename_map[col] = 'var_session_interval_30d'
    elif col.startswith('Экспоненциально взвешенное среднее интервалов между логинами за 7 дней'):
        rename_map[col] = 'ewm_session_interval_7d'
    elif col.startswith('Показатель “взрывности” логинов'):
        rename_map[col] = 'burstiness_sessions'
    elif col.startswith('Fano-factor'):
        rename_map[col] = 'fano_factor_sessions'
    elif col.startswith('Z-скор среднего интервала'):
        rename_map[col] = 'zscore_interval_7d_vs_30d'

df_proc = df_proc.rename(columns=rename_map)

# проверим, что всё ок
print("Колонки после rename:")
print(df_proc.columns.tolist())

# %%
# ---------------------------------------------------------------------
# 3. ОБРАБОТКА ПРОПУСКОВ И ТИПОВ
# ---------------------------------------------------------------------

# 3.1. Категориальные фичи, которые надо закодировать
cat_cols = ['phone_model_last', 'os_version_last']
cat_cols = [c for c in cat_cols if c in df_proc.columns]  # на всякий случай

encoders = {}
for col in cat_cols:
    df_proc[col] = df_proc[col].fillna('unknown').astype(str)
    le = LabelEncoder()
    df_proc[col] = le.fit_transform(df_proc[col])
    encoders[col] = le  # можно сохранить потом для инференса

# 3.2. Числовые фичи из поведенческих + amount
num_cols = [
    'amount',
    'os_ver_cnt_30d',
    'phone_model_cnt_30d',
    'login_sessions_7d',
    'login_sessions_30d',
    'logins_per_day_7d',
    'logins_per_day_30d',
    'login_freq_change_7d_vs_30d',
    'logins_7d_share_of_30d',
    'avg_session_interval_30d',
    'std_session_interval_30d',
    'var_session_interval_30d',
    'ewm_session_interval_7d',
    'burstiness_sessions',
    'fano_factor_sessions',
    'zscore_interval_7d_vs_30d',
]

# фильтруем на случай, если чего-то нет
num_cols = [c for c in num_cols if c in df_proc.columns]

for col in num_cols:
    # приводим к виду, который можно конвертить в float
    df_proc[col] = (
        df_proc[col]
        .astype(str)
        .str.replace(',', '.', regex=False)  # вдруг запятая вместо точки
        .str.replace(' ', '', regex=False)   # убираем пробелы
    )
    df_proc[col] = pd.to_numeric(df_proc[col], errors='coerce')

    # добавим флаг пропуска
    df_proc[col + '_was_missing'] = df_proc[col].isna().astype(int)

    # заполним NaN нулями (или можно median, если захочешь)
    df_proc[col] = df_proc[col].fillna(0.0)

# убедимся, что среди фич не осталось object
print("\nТипы df_proc (object):")
print(df_proc.dtypes[df_proc.dtypes == 'object'])


# %%
# ---------------------------------------------------------------------
# 4. ФОРМИРУЕМ X, y ДЛЯ ОБУЧЕНИЯ XGBoost
# ---------------------------------------------------------------------

target_col = 'is_fraud'

# служебные колонки, которые НЕ должны идти в модель
drop_cols = [
    target_col,
    'client_id',
    'transaction_id',
    'destination_id',
    'transdate',
    'transdatetime',
    'trans_date',
]

drop_cols = [c for c in drop_cols if c in df_proc.columns]

y = df_proc[target_col].astype(int)
X = df_proc.drop(columns=drop_cols)

# финальная проверка: никаких object в X быть не должно
print("\nПроверка типов в X (object-колонки, если есть):")
print(X.dtypes[X.dtypes == 'object'])

# %%
# ---------------------------------------------------------------------
# 5. TRAIN/VALID SPLIT + ОБУЧЕНИЕ XGBoost
# ---------------------------------------------------------------------
from sklearn.model_selection import train_test_split

X_train, X_valid, y_train, y_valid = train_test_split(
    X, y,
    test_size=0.2,
    stratify=y,
    random_state=42
)

neg, pos = np.bincount(y_train)
scale_pos_weight = neg / pos
print("\nscale_pos_weight:", scale_pos_weight)

model = xgb.XGBClassifier(
    n_estimators=400,
    max_depth=5,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric='auc',
    tree_method='hist',
    scale_pos_weight=scale_pos_weight,
    n_jobs=-1,
    random_state=42,
)

model.fit(
    X_train, y_train,
    eval_set=[(X_valid, y_valid)],
    verbose=50
)

y_proba = model.predict_proba(X_valid)[:, 1]
roc = roc_auc_score(y_valid, y_proba)
pr_auc = average_precision_score(y_valid, y_proba)

print(f"\nROC-AUC: {roc:.4f}")
print(f"PR-AUC:  {pr_auc:.4f}")

# %%
# ---------------------------------------------------------------------
# 6. СОХРАНЕНИЕ МОДЕЛИ
# ---------------------------------------------------------------------
joblib.dump(model, "model_xgb_baseline.pkl")
print("\nМодель сохранена в temp/model_xgb_baseline.pkl")

# %%
from sklearn.metrics import precision_score, recall_score, confusion_matrix, roc_auc_score, average_precision_score
import numpy as np
import pandas as pd

# Считаем вероятности на валидации
y_proba_valid = model.predict_proba(X_valid)[:, 1]

# Сетка порогов
thresholds = np.linspace(0.0, 1.0, 21)

rows = []
for thr in thresholds:
    y_pred = (y_proba_valid >= thr).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_valid, y_pred).ravel()

    precision = precision_score(y_valid, y_pred, zero_division=0)
    recall = recall_score(y_valid, y_pred, zero_division=0)
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    tpr = recall

    rows.append({
        "threshold": thr,
        "precision": precision,
        "recall": recall,
        "FPR": fpr,
        "TPR": tpr,
        "TP": tp,
        "FP": fp,
        "FN": fn,
        "TN": tn,
    })

thr_df = pd.DataFrame(rows)
display(thr_df)

print("Global ROC-AUC:", roc_auc_score(y_valid, y_proba_valid))
print("Global PR-AUC: ", average_precision_score(y_valid, y_proba_valid))


# %%
importances = model.feature_importances_
feat_importance = pd.DataFrame({
    "feature": X_train.columns,
    "importance": importances,
}).sort_values("importance", ascending=False)

top_10_importance = feat_importance.head(10)
display(top_10_importance)


# %%
top_10_importance.to_csv("top10_feature_importance.csv", index=False)

# %%
# Средние и std по train-фичам
train_means = X_train.mean()
train_stds = X_train.std(ddof=0).replace(0, 1e-9)  # чтобы не делить на 0

# Соединяем с важностью
feat_stats = pd.DataFrame({
    "feature": X_train.columns,
    "mean": train_means.values,
    "std": train_stds.values,
    "importance": model.feature_importances_,
}).set_index("feature")


# %% [markdown]
# Функция объяснения одной транзакции

# %%
def explain_transaction(
    x_row: pd.Series,
    feat_stats: pd.DataFrame,
    z_threshold: float = 2.0,
    top_k: int = 10,
) -> pd.DataFrame:
    """
    x_row: одна строка X (например, X_valid.iloc[0])
    Возвращает таблицу: feature, value, mean, std, z_score, importance, is_outlier
    """
    x_row = x_row.copy()
    df = feat_stats.copy()

    df["value"] = x_row[df.index]
    df["z_score"] = (df["value"] - df["mean"]) / df["std"]
    df["abs_z"] = df["z_score"].abs()
    df["is_outlier"] = df["abs_z"] >= z_threshold

    # Сортируем по комбинации важности и отклонения
    df["score"] = df["importance"] * df["abs_z"]
    df_sorted = df.sort_values("score", ascending=False)

    return df_sorted[["value", "mean", "std", "z_score", "importance", "is_outlier"]].head(top_k)


# %% [markdown]
# Пример использования

# %%
# Берём какую-нибудь транзакцию из валидации
idx = 0
x_example = X_valid.iloc[idx]
y_true = y_valid.iloc[idx]
y_prob = y_proba_valid[idx]

print("True label:", y_true, "Predicted proba:", y_prob)

local_expl = explain_transaction(x_example, feat_stats, z_threshold=2.0, top_k=10)
display(local_expl)


# %%
# Убедимся, что transdatetime — datetime64
print(df_proc["transdatetime"].dtype)

# сортировка по времени
df_sorted = df_proc.sort_values("transdatetime").reset_index(drop=True)

# тот же список drop_cols, который ты уже использовал
drop_cols = [
    "is_fraud",
    "client_id",
    "transaction_id",
    "destination_id",
    "transdate",
    "transdatetime",
    "trans_date",
]
drop_cols = [c for c in drop_cols if c in df_sorted.columns]

X_time = df_sorted.drop(columns=drop_cols)
y_time = df_sorted["is_fraud"].astype(int)

split_idx = int(len(df_sorted) * 0.8)
X_train_time = X_time.iloc[:split_idx]
y_train_time = y_time.iloc[:split_idx]
X_test_time = X_time.iloc[split_idx:]
y_test_time = y_time.iloc[split_idx:]

X_train_time.shape, X_test_time.shape


# %%
import xgboost as xgb
from sklearn.metrics import roc_auc_score, average_precision_score

neg, pos = np.bincount(y_train_time)
scale_pos_weight_time = neg / pos
print("scale_pos_weight (time-based):", scale_pos_weight_time)

model_time = xgb.XGBClassifier(
    n_estimators=400,
    max_depth=5,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric='auc',
    tree_method='hist',
    scale_pos_weight=scale_pos_weight_time,
    n_jobs=-1,
    random_state=42,
)

model_time.fit(
    X_train_time, y_train_time,
    eval_set=[(X_test_time, y_test_time)],
    verbose=50
)

y_proba_time = model_time.predict_proba(X_test_time)[:, 1]
roc_time = roc_auc_score(y_test_time, y_proba_time)
pr_time = average_precision_score(y_test_time, y_proba_time)

print(f"Time-based ROC-AUC: {roc_time:.4f}")
print(f"Time-based PR-AUC:  {pr_time:.4f}")


# %%
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

# 1) Logistic Regression (с балансом классов)
log_reg = LogisticRegression(
    max_iter=1000,
    class_weight="balanced",
    n_jobs=-1,
    solver="saga",  # или "liblinear" если данных не слишком много
)

evaluate_model("LogisticRegression", log_reg, X_train, y_train, X_valid, y_valid)

# 2) RandomForest
rf = RandomForestClassifier(
    n_estimators=200,
    max_depth=7,
    n_jobs=-1,
    class_weight="balanced_subsample",
    random_state=42,
)

evaluate_model("RandomForest", rf, X_train, y_train, X_valid, y_valid)

# 3) XGBoost (твоя модель)
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
    "fit_time_sec": None,  # уже обучен
    "infer_time_per_1000_samples_ms": time_per_1000_xgb,
})

baseline_df = pd.DataFrame(results)
display(baseline_df)


# %%
import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, confusion_matrix, roc_auc_score, average_precision_score

# 1. Получаем вероятности на валидации
y_proba_valid = model.predict_proba(X_valid)[:, 1]

# 2. Строим таблицу по порогам
thresholds = np.linspace(0.0, 1.0, 101)  # шаг 0.01

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
display(thr_df.head())

print("Global ROC-AUC:", roc_auc_score(y_valid, y_proba_valid))
print("Global PR-AUC: ", average_precision_score(y_valid, y_proba_valid))


# %%
# Правила выбора (можно подстроить):
# low: FPR <= 0.005 (очень мало ложных срабатываний)
# medium: FPR <= 0.02 и recall >= 0.5
# high: recall >= 0.8 и FPR <= 0.05

low_candidates = thr_df[thr_df["FPR"] <= 0.005]
medium_candidates = thr_df[(thr_df["FPR"] <= 0.02) & (thr_df["recall"] >= 0.5)]
high_candidates = thr_df[(thr_df["FPR"] <= 0.05) & (thr_df["recall"] >= 0.8)]

low_thr = low_candidates["threshold"].max() if not low_candidates.empty else 0.5
med_thr = medium_candidates["threshold"].max() if not medium_candidates.empty else 0.5
high_thr = high_candidates["threshold"].min() if not high_candidates.empty else 0.8

print("Suggested thresholds:")
print("LOW threshold   (auto-approve max):", round(low_thr, 3))
print("MEDIUM threshold(soft check start):", round(med_thr, 3))
print("HIGH threshold  (hard check start):", round(high_thr, 3))

print("\nLOW row:")
display(thr_df[thr_df["threshold"] == low_thr])

print("\nMED row:")
display(thr_df[thr_df["threshold"] == med_thr])

print("\nHIGH row:")
display(thr_df[thr_df["threshold"] == high_thr])


# %%



