import type { App, ListedApp } from "@platform/shared-types";
import { invokeChannel, API_BASE, API_TOKEN } from "./bridge";

export interface PreviewUrlResult {
  running: boolean;
  previewPath: string | null;
  proxyUrl: string | null;
  originalUrl: string | null;
}

export interface AppFileSearchSnippet {
  before: string;
  match: string;
  after: string;
  line: number;
}

export interface AppFileSearchResult {
  path: string;
  matchesContent: boolean;
  snippets?: AppFileSearchSnippet[];
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

export async function restartApp(
  appId: number,
  removeNodeModules?: boolean,
): Promise<void> {
  await invokeChannel<void>("restart-app", { appId, removeNodeModules });
}

export async function getPreviewUrl(appId: number): Promise<PreviewUrlResult> {
  return invokeChannel<PreviewUrlResult>("get-preview-url", { appId });
}

export async function readAppFile(
  appId: number,
  filePath: string,
): Promise<string> {
  return invokeChannel<string>("read-app-file", { appId, filePath });
}

export async function editAppFile(
  appId: number,
  filePath: string,
  content: string,
): Promise<{ warning?: string }> {
  return invokeChannel<{ warning?: string }>("edit-app-file", {
    appId,
    filePath,
    content,
  });
}

export async function searchAppFiles(
  appId: number,
  query: string,
): Promise<AppFileSearchResult[]> {
  return invokeChannel<AppFileSearchResult[]>("search-app-files", {
    appId,
    query,
  });
}

export function exportAppZipUrl(appId: number): string {
  const tokenParam = API_TOKEN ? `?token=${encodeURIComponent(API_TOKEN)}` : "";
  return `${API_BASE}/export/${appId}.zip${tokenParam}`;
}
