// src/components/RiskResult.tsx
import React from "react";
import { ScoreTransactionResponse } from "../services/api";

interface Props {
  result: ScoreTransactionResponse | null;
}

const RiskResult: React.FC<Props> = ({ result }) => {
  if (!result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="text-lg font-medium mb-2">Результат будет здесь</div>
        <p className="text-sm text-slate-400">
          Заполните форму слева и нажмите{" "}
          <span className="font-semibold">«Оценить риск»</span>, чтобы увидеть
          вероятность мошенничества.
        </p>
      </div>
    );
  }

  const { fraud_probability, risk_level, model_version } = result;

  let badgeColor =
    "bg-emerald-500/20 text-emerald-300 border-emerald-500/60";
  let label = "Low risk";

  if (risk_level === "medium") {
    badgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/60";
    label = "Medium risk";
  } else if (risk_level === "high") {
    badgeColor = "bg-red-500/20 text-red-300 border-red-500/60";
    label = "High risk";
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${badgeColor}`}
          >
            {label}
          </span>
          <span className="text-xs text-slate-400">model: {model_version}</span>
        </div>
        <div className="text-5xl font-semibold mb-1">
          {(fraud_probability * 100).toFixed(2)}%
        </div>
        <div className="text-sm text-slate-300">
          Probability of fraud for this transaction
        </div>
      </div>

      <div className="mt-4 text-sm text-slate-300 space-y-1">
        <p>Интерпретация:</p>
        {risk_level === "low" && (
          <ul className="list-disc list-inside text-slate-400 text-xs space-y-1">
            <li>Параметры транзакции и поведение клиента близки к обычным.</li>
            <li>Перевод можно пропустить без дополнительной проверки.</li>
          </ul>
        )}
        {risk_level === "medium" && (
          <ul className="list-disc list-inside text-slate-400 text-xs space-y-1">
            <li>Есть нестандартные паттерны активности или суммы.</li>
            <li>Рекомендуется мягкая проверка: пуш/СМС-подтверждение.</li>
          </ul>
        )}
        {risk_level === "high" && (
          <ul className="list-disc list-inside text-slate-400 text-xs space-y-1">
            <li>Сильное отклонение от привычного поведения клиента.</li>
            <li>Лучше сделать блокировку или ручную проверку.</li>
          </ul>
        )}
      </div>
    </div>
  );
};

export default RiskResult;
