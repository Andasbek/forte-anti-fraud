// src/services/api.ts

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const API_PREFIX = import.meta.env.VITE_API_PREFIX || "/api/v1";

const API_KEY = import.meta.env.VITE_API_KEY; // <-- добавили
const SCORE_URL = `${API_BASE_URL}${API_PREFIX}/score_transaction`;

export async function scoreTransaction(
  payload: ScoreTransactionRequest
): Promise<ScoreTransactionResponse> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }

  const res = await fetch(SCORE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return (await res.json()) as ScoreTransactionResponse;
}
