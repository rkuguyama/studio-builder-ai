import type { App, ListedApp } from "@platform/shared-types";
import { config } from "./config";

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

export async function listApps(): Promise<ListedApp[]> {
  const result = await invokeChannel<{ apps: ListedApp[] }>("list-apps");
  return result.apps;
}

export async function getApp(appId: number): Promise<App> {
  return invokeChannel<App>("get-app", appId);
}

export async function createApp(
  name: string,
): Promise<{ app: App; chatId: number }> {
  return invokeChannel<{ app: App; chatId: number }>("create-app", { name });
}

export async function runApp(appId: number): Promise<void> {
  await invokeChannel<void>("run-app", { appId });
}

export async function stopApp(appId: number): Promise<void> {
  await invokeChannel<void>("stop-app", { appId });
}

export interface PreviewUrlResult {
  running: boolean;
  previewPath: string | null;
  proxyUrl: string | null;
  originalUrl: string | null;
}

export async function getPreviewUrl(appId: number): Promise<PreviewUrlResult> {
  return invokeChannel<PreviewUrlResult>("get-preview-url", { appId });
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
}

export interface ChatData {
  id: number;
  title: string;
  messages: ChatMessage[];
}

export async function getChat(chatId: number): Promise<ChatData> {
  return invokeChannel<ChatData>("get-chat", chatId);
}

export async function sendChatMessage(
  chatId: number,
  prompt: string,
): Promise<void> {
  await invokeChannel<void>("chat:stream", { chatId, prompt });
}
