// src/App.tsx
import React, { useMemo, useState } from "react";
import {
  scoreTransaction,
  explainTransaction,
  type ScoreTransactionRequest,
  type ScoreTransactionResponse,
} from "./services/api";

type HistoryItem = {
  id: number;
  timestamp: string;
  amount: number;
  fraud_probability: number;
  risk_level: string;
  os_ver_cnt_30d?: number;
  phone_model_cnt_30d?: number;
  login_sessions_7d?: number;
  login_sessions_30d?: number;
};

const RiskGauge: React.FC<{ proba?: number }> = ({ proba }) => {
  const p = Math.min(Math.max(proba ?? 0, 0), 1) * 100;

  return (
    <div className="mt-4">
      <div className="text-xs text-slate-300 mb-1">
        Воронка риска (0% → 100%)
      </div>
      <div className="relative h-3 rounded-full overflow-hidden bg-slate-800">
        {/* зелёная зона */}
        <div className="absolute inset-y-0 left-0 w-1/3 bg-emerald-500/50" />
        {/* жёлтая зона */}
        <div className="absolute inset-y-0 left-1/3 w-1/3 bg-amber-500/50" />
        {/* красная зона */}
        <div className="absolute inset-y-0 right-0 w-1/3 bg-red-500/50" />
        {/* маркер текущей вероятности */}
        <div
          className="absolute -top-1 h-5 w-[2px] bg-white shadow-sm"
          style={{ left: `${p}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>0%</span>
        <span>≈25%</span>
        <span>≈50%</span>
        <span>≈75%</span>
        <span>100%</span>
      </div>
    </div>
  );
};

const HistoryTable: React.FC<{ history: HistoryItem[] }> = ({ history }) => {
  if (history.length === 0) {
    return (
      <div className="mt-4 text-xs text-slate-500">
        История проверок появится после первых запросов.
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="text-sm font-semibold text-slate-200 mb-2">
        История проверок (сеанс)
      </div>
      <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900/80 text-slate-300 sticky top-0">
            <tr>
              <th className="px-2 py-1">Время</th>
              <th className="px-2 py-1">Amount</th>
              <th className="px-2 py-1">OS 30d</th>
              <th className="px-2 py-1">Logins 7d</th>
              <th className="px-2 py-1">Risk%</th>
              <th className="px-2 py-1">Level</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {history.map((h) => (
              <tr key={h.id} className="hover:bg-slate-900/60">
                <td className="px-2 py-1 text-slate-400">{h.timestamp}</td>
                <td className="px-2 py-1">{Math.round(h.amount)}</td>
                <td className="px-2 py-1">
                  {h.os_ver_cnt_30d ?? (
                    <span className="text-slate-500">–</span>
                  )}
                </td>
                <td className="px-2 py-1">
                  {h.login_sessions_7d ?? (
                    <span className="text-slate-500">–</span>
                  )}
                </td>
                <td className="px-2 py-1">
                  {(h.fraud_probability * 100).toFixed(1)}%
                </td>
                <td className="px-2 py-1">
                  {h.risk_level === "high" && (
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/50">
                      high
                    </span>
                  )}
                  {h.risk_level === "medium" && (
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50">
                      medium
                    </span>
                  )}
                  {h.risk_level === "low" && (
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/50">
                      low
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [form, setForm] = useState<ScoreTransactionRequest>({
    amount: 10000,
    os_ver_cnt_30d: 1,
    phone_model_cnt_30d: 1,
    login_sessions_7d: 10,
    login_sessions_30d: 40,
  });

  const [result, setResult] = useState<ScoreTransactionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const handleChangeNumber =
    (field: keyof ScoreTransactionRequest) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setForm((prev) => ({
        ...prev,
        [field]: val === "" ? undefined : Number(val),
      }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      setExplanation(null);
      setExplainError(null);

      const res = await scoreTransaction(form);
      setResult(res);

      setHistory((prev) => {
        const item: HistoryItem = {
          id: prev.length + 1,
          timestamp: new Date().toLocaleTimeString(),
          amount: form.amount ?? 0,
          fraud_probability: res.fraud_probability,
          risk_level: res.risk_level,
          os_ver_cnt_30d: form.os_ver_cnt_30d,
          phone_model_cnt_30d: form.phone_model_cnt_30d,
          login_sessions_7d: form.login_sessions_7d,
          login_sessions_30d: form.login_sessions_30d,
        };
        return [item, ...prev].slice(0, 20);
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Unexpected error");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExplain = async () => {
    if (!result) return;
    try {
      setIsExplaining(true);
      setExplainError(null);
      const resp = await explainTransaction({
        transaction: form,
        fraud_probability: result.fraud_probability,
        risk_level: result.risk_level,
      });
      setExplanation(resp.explanation);
    } catch (err: any) {
      console.error(err);
      setExplainError(err.message || "Ошибка при запросе объяснения");
    } finally {
      setIsExplaining(false);
    }
  };

  // пресеты
  const fillLegitExample = () => {
    setForm({
      amount: 15000,
      os_ver_cnt_30d: 1,
      phone_model_cnt_30d: 1,
      login_sessions_7d: 12,
      login_sessions_30d: 50,
      logins_per_day_7d: 12 / 7,
      logins_per_day_30d: 50 / 30,
      login_freq_change_7d_vs_30d: 0.1,
      logins_7d_share_of_30d: 12 / 50,
    });
  };

  const fillFraudExample = () => {
    setForm({
      amount: 300000,
      os_ver_cnt_30d: 3,
      phone_model_cnt_30d: 3,
      login_sessions_7d: 50,
      login_sessions_30d: 60,
      logins_per_day_7d: 50 / 7,
      logins_per_day_30d: 60 / 30,
      login_freq_change_7d_vs_30d: 1.5,
      logins_7d_share_of_30d: 50 / 60,
      avg_session_interval_30d: 60,
      std_session_interval_30d: 5,
      var_session_interval_30d: 25,
      ewm_session_interval_7d: 30,
      burstiness_sessions: 0.8,
      fano_factor_sessions: 2,
      zscore_interval_7d_vs_30d: -2,
    });
  };

  const fillNewDeviceBigAmount = () => {
    setForm({
      amount: 500000,
      os_ver_cnt_30d: 2,
      phone_model_cnt_30d: 2,
      login_sessions_7d: 5,
      login_sessions_30d: 20,
      logins_per_day_7d: 5 / 7,
      logins_per_day_30d: 20 / 30,
      login_freq_change_7d_vs_30d: -0.3,
      logins_7d_share_of_30d: 5 / 20,
    });
  };

  const fillNightSmallTransfers = () => {
    setForm({
      amount: 5000,
      os_ver_cnt_30d: 1,
      phone_model_cnt_30d: 1,
      login_sessions_7d: 40,
      login_sessions_30d: 60,
      logins_per_day_7d: 40 / 7,
      logins_per_day_30d: 60 / 30,
      login_freq_change_7d_vs_30d: 0.9,
      logins_7d_share_of_30d: 40 / 60,
      avg_session_interval_30d: 120,
      std_session_interval_30d: 90,
      var_session_interval_30d: 90 * 90,
      ewm_session_interval_7d: 45,
      burstiness_sessions: 0.7,
      fano_factor_sessions: 1.5,
      zscore_interval_7d_vs_30d: -1.5,
    });
  };

  // статистики по сессии
  const sessionStats = useMemo(() => {
    const total = history.length;
    if (!total) {
      return {
        total: 0,
        avgRisk: 0,
        highShare: 0,
      };
    }
    const avgRisk =
      history.reduce((acc, h) => acc + h.fraud_probability, 0) / total;
    const highCount = history.filter((h) => h.risk_level === "high").length;
    const highShare = highCount / total;
    return { total, avgRisk, highShare };
  }, [history]);

  // бейдж риска
  let riskBadge: JSX.Element | null = null;
  if (result) {
    riskBadge = (
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
              result.risk_level === "high"
                ? "border-red-500 bg-red-500/10 text-red-300"
                : result.risk_level === "medium"
                ? "border-amber-500 bg-amber-500/10 text-amber-300"
                : "border-emerald-500 bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {result.risk_level === "high"
              ? "High risk"
              : result.risk_level === "medium"
              ? "Medium risk"
              : "Low risk"}
          </span>
          <span className="text-xs text-slate-400">
            model: {result.model_version}
          </span>
        </div>
        <div className="text-5xl font-semibold mb-1">
          {(result.fraud_probability * 100).toFixed(2)}%
        </div>
        <div className="text-sm text-slate-300">
          Probability of fraud for this transaction
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-6xl w-full grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.2fr)] gap-6">
        {/* Левая панель */}
        <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-xl">
          <h1 className="text-2xl md:text-3xl font-semibold mb-2">
            Forte Anti-Fraud Scoring
          </h1>
          <p className="text-sm text-slate-300 mb-4">
            Введите параметры транзакции и поведение клиента, чтобы оценить риск
            мошенничества в реальном времени.
          </p>

          {/* статистики по сеансу */}
          <div className="mb-5 grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2">
              <div className="text-slate-400">Проверено</div>
              <div className="text-lg font-semibold">
                {sessionStats.total}
              </div>
            </div>
            <div className="rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2">
              <div className="text-slate-400">Средний риск</div>
              <div className="text-lg font-semibold">
                {(sessionStats.avgRisk * 100).toFixed(1)}%
              </div>
            </div>
            <div className="rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2">
              <div className="text-slate-400">Доля HIGH</div>
              <div className="text-lg font-semibold">
                {(sessionStats.highShare * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* базовые фичи */}
            <div>
              <h2 className="text-sm font-semibold text-slate-200 mb-2">
                Параметры транзакции
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Amount (сумма)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="100"
                    value={form.amount ?? ""}
                    onChange={handleChangeNumber("amount")}
                    className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    OS versions last 30d
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.os_ver_cnt_30d ?? ""}
                    onChange={handleChangeNumber("os_ver_cnt_30d")}
                    className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Phone models last 30d
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.phone_model_cnt_30d ?? ""}
                    onChange={handleChangeNumber("phone_model_cnt_30d")}
                    className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Login sessions last 7d
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.login_sessions_7d ?? ""}
                    onChange={handleChangeNumber("login_sessions_7d")}
                    className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Login sessions last 30d
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.login_sessions_30d ?? ""}
                    onChange={handleChangeNumber("login_sessions_30d")}
                    className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* доп. фичи */}
            <div className="border-t border-slate-700 pt-4">
              <h2 className="text-sm font-semibold text-slate-200 mb-2">
                Дополнительные фичи (опционально)
              </h2>
              <p className="text-xs text-slate-400 mb-3">
                Можно оставить пустыми — модель подставит 0 и отметит отсутствие
                данных.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Logins/day last 7d
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.logins_per_day_7d ?? ""}
                    onChange={handleChangeNumber("logins_per_day_7d")}
                    className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">
                    Logins/day last 30d
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.logins_per_day_30d ?? ""}
                    onChange={handleChangeNumber("logins_per_day_30d")}
                    className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-emerald-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Считаем риск..." : "Оценить риск"}
              </button>
              <button
                type="button"
                onClick={fillLegitExample}
                className="text-xs text-slate-300 hover:text-emerald-300"
              >
                Пример нормального клиента
              </button>
              <button
                type="button"
                onClick={fillFraudExample}
                className="text-xs text-slate-300 hover:text-red-300"
              >
                Пример потенциального фрода
              </button>
              <button
                type="button"
                onClick={fillNewDeviceBigAmount}
                className="text-xs text-slate-300 hover:text-sky-300"
              >
                Новый девайс + крупная сумма
              </button>
              <button
                type="button"
                onClick={fillNightSmallTransfers}
                className="text-xs text-slate-300 hover:text-fuchsia-300"
              >
                Серия мелких переводов ночью
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 text-sm text-red-400">Ошибка: {error}</div>
          )}
        </div>

        {/* Правая панель */}
        <div className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-xl flex flex-col">
          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-lg font-medium mb-2">
                Результат будет здесь
              </div>
              <p className="text-sm text-slate-400">
                Заполните форму слева и нажмите{" "}
                <span className="font-semibold">«Оценить риск»</span>.
              </p>
            </div>
          ) : (
            <>
              {riskBadge}

              <button
                type="button"
                onClick={handleExplain}
                disabled={isExplaining}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-sky-500 text-slate-900 text-xs font-medium hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isExplaining
                  ? "Генерируем объяснение..."
                  : "Объяснить решение (LLM)"}
              </button>

              {explainError && (
                <div className="mt-2 text-xs text-red-400">
                  {explainError}
                </div>
              )}

              {explanation && (
                <div className="mt-3 text-xs bg-slate-900/70 border border-slate-700 rounded-xl p-3 text-slate-200">
                  <div className="font-semibold text-slate-100 mb-1">
                    Объяснение от AI:
                  </div>
                  <p className="whitespace-pre-line">{explanation}</p>
                </div>
              )}

              <RiskGauge proba={result.fraud_probability} />

              <div className="mt-4 text-sm text-slate-300 space-y-1">
                <p>Интерпретация:</p>
                {result.risk_level === "low" && (
                  <ul className="list-disc list-inside text-slate-400 text-xs space-y-1">
                    <li>
                      Параметры транзакции и поведение клиента близки к обычным.
                    </li>
                    <li>Перевод можно пропустить без дополнительной проверки.</li>
                  </ul>
                )}
                {result.risk_level === "medium" && (
                  <ul className="list-disc list-inside text-slate-400 text-xs space-y-1">
                    <li>Есть нестандартные паттерны активности или суммы.</li>
                    <li>
                      Рекомендуется мягкая проверка: push/SMS-подтверждение.
                    </li>
                  </ul>
                )}
                {result.risk_level === "high" && (
                  <ul className="list-disc list-inside text-slate-400 text-xs space-y-1">
                    <li>
                      Сильное отклонение от привычного поведения клиента.
                    </li>
                    <li>
                      Лучше сделать блокировку или ручную проверку службой
                      безопасности.
                    </li>
                  </ul>
                )}
              </div>
            </>
          )}

          <div className="mt-4 text-xs text-slate-400">
            Модель: XGBoost baseline, обучена на поведенческих признаках логинов
            и суммах переводов.
          </div>

          <HistoryTable history={history} />
        </div>
      </div>
    </div>
  );
};

export default App;
