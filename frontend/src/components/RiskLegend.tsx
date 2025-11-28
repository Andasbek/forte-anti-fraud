// src/components/RiskLegend.tsx
import React from "react";

interface RiskLegendProps {
  lowThreshold: number;  // Например, 0.30
  highThreshold: number; // Например, 0.70
}

const RiskLegend: React.FC<RiskLegendProps> = ({
  lowThreshold,
  highThreshold,
}) => {
  return (
    <div className="mt-6 border border-slate-700 rounded-xl p-4 text-xs bg-slate-900/60 backdrop-blur-sm">
      <h3 className="text-sm font-semibold text-slate-200 mb-2">
        Сценарии принятия решений по риску
      </h3>
      <p className="text-slate-400 mb-3">
        Пороги подобраны по валидационной выборке с учётом баланса между
        precision, recall и FPR.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="text-slate-300 border-b border-slate-700">
            <tr>
              <th scope="col" className="py-1 pr-2 font-medium">Уровень</th>
              <th scope="col" className="py-1 pr-2 font-medium">Диапазон вероятности</th>
              <th scope="col" className="py-1 pr-2 font-medium">Сценарий</th>
            </tr>
          </thead>
          <tbody className="text-slate-400">
            {/* LOW */}
            <tr className="border-b border-slate-800 last:border-0">
              <td className="py-2 pr-2 align-top">
                <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 font-medium">
                  LOW
                </span>
              </td>
              <td className="py-2 pr-2 align-top whitespace-nowrap">
                p &lt; {lowThreshold.toFixed(2)}
              </td>
              <td className="py-2 pr-2 align-top">
                Автоодобрение. Ложные срабатывания &lt; 0.5% (по валидации). 
                Рекомендуется не трогать клиента.
              </td>
            </tr>

            {/* MEDIUM */}
            <tr className="border-b border-slate-800 last:border-0">
              <td className="py-2 pr-2 align-top">
                <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40 font-medium">
                  MEDIUM
                </span>
              </td>
              <td className="py-2 pr-2 align-top whitespace-nowrap">
                {lowThreshold.toFixed(2)} ≤ p &lt; {highThreshold.toFixed(2)}
              </td>
              <td className="py-2 pr-2 align-top">
                Soft-проверка (push/SMS). Баланс между обнаружением фрода и
                комфортом пользователя.
              </td>
            </tr>

            {/* HIGH */}
            <tr>
              <td className="py-2 pr-2 align-top">
                <span className="inline-flex px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/40 font-medium">
                  HIGH
                </span>
              </td>
              <td className="py-2 pr-2 align-top whitespace-nowrap">
                p ≥ {highThreshold.toFixed(2)}
              </td>
              <td className="py-2 pr-2 align-top">
                Жёсткая реакция: блокировка и/или ручная проверка. 
                Recall &gt;≈ 80%, FPR &lt;≈ 5%.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[10px] text-slate-500">
        * Конкретные значения recall / FPR см. в отчёте по валидации (thr_df).
      </p>
    </div>
  );
};

export default RiskLegend;