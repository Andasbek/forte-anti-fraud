// src/services/api.ts

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const API_PREFIX = import.meta.env.VITE_API_PREFIX || "/api/v1";

const SCORE_URL = `${API_BASE_URL}${API_PREFIX}/score_transaction`;

const API_KEY: string | undefined = import.meta.env.VITE_API_KEY;

export interface ScoreTransactionRequest {
  amount: number;
  os_ver_cnt_30d?: number;
  phone_model_cnt_30d?: number;
  login_sessions_7d?: number;
  login_sessions_30d?: number;
  logins_per_day_7d?: number;
  logins_per_day_30d?: number;
  login_freq_change_7d_vs_30d?: number;
  logins_7d_share_of_30d?: number;
  avg_session_interval_30d?: number;
  std_session_interval_30d?: number;
  var_session_interval_30d?: number;
  ewm_session_interval_7d?: number;
  burstiness_sessions?: number;
  fano_factor_sessions?: number;
  zscore_interval_7d_vs_30d?: number;
}

export interface ScoreTransactionResponse {
  fraud_probability: number;
  risk_level: "low" | "medium" | "high" | string;
  model_version: string;
}

export async function scoreTransaction(
  payload: ScoreTransactionRequest
): Promise<ScoreTransactionResponse> {
  const res = await fetch(SCORE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return (await res.json()) as ScoreTransactionResponse;
}

export interface ExplainTransactionRequest {
  transaction: ScoreTransactionRequest;
  fraud_probability: number;
  risk_level: string;
}

export interface ExplainTransactionResponse {
  fraud_probability: number;
  risk_level: string;
  explanation: string;
}

const EXPLAIN_URL = `${API_BASE_URL}${API_PREFIX}/explain_transaction`;

export async function explainTransaction(
  payload: ExplainTransactionRequest
): Promise<ExplainTransactionResponse> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }

  const res = await fetch(EXPLAIN_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return (await res.json()) as ExplainTransactionResponse;
}
