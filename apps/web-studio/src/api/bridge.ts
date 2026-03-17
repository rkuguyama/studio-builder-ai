import { config } from "../config";

export const API_BASE = config.bridgeUrl;
export const API_TOKEN: string | undefined = config.bridgeToken;

function authHeaders(): Record<string, string> {
  return API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {};
}

export async function invokeChannel<T>(
  channel: string,
  input?: unknown,
): Promise<T> {
  const response = await fetch(`${API_BASE}/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ channel, input }),
  });

  const data = (await response.json()) as {
    ok: boolean;
    result?: T;
    error?: string;
  };

  if (!response.ok || !data.ok) {
    throw new Error(data.error ?? `Invoke failed for ${channel}`);
  }
  return data.result as T;
}

export async function healthCheck(): Promise<boolean> {
  const response = await fetch(`${API_BASE}/health`);
  return response.ok;
}
