// src/components/TransactionForm.tsx
import React, { useState } from "react";
import { ScoreTransactionRequest } from "../services/api";

interface Props {
  onSubmit: (payload: ScoreTransactionRequest) => void;
  isLoading: boolean;
}

const TransactionForm: React.FC<Props> = ({ onSubmit, isLoading }) => {
  const [form, setForm] = useState<ScoreTransactionRequest>({
    amount: 10000,
    os_ver_cnt_30d: 1,
    phone_model_cnt_30d: 1,
    login_sessions_7d: 10,
    login_sessions_30d: 40,
  });

  const handleChangeNumber =
    (field: keyof ScoreTransactionRequest) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setForm((prev) => ({
        ...prev,
        [field]: val === "" ? undefined : Number(val),
      }));
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Блок: транзакция */}
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

      {/* Блок: доп. фичи */}
      <div className="border-t border-slate-700 pt-4">
        <h2 className="text-sm font-semibold text-slate-200 mb-2">
          Дополнительные поведенческие фичи (опционально)
        </h2>
        <p className="text-xs text-slate-400 mb-3">
          Можно оставить пустыми — модель подставит 0 и отметит отсутствие данных.
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
          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Login freq change 7d vs 30d
            </label>
            <input
              type="number"
              step="0.01"
              value={form.login_freq_change_7d_vs_30d ?? ""}
              onChange={handleChangeNumber("login_freq_change_7d_vs_30d")}
              className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Logins 7d share of 30d
            </label>
            <input
              type="number"
              step="0.01"
              value={form.logins_7d_share_of_30d ?? ""}
              onChange={handleChangeNumber("logins_7d_share_of_30d")}
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
      </div>
    </form>
  );
};

export default TransactionForm;
