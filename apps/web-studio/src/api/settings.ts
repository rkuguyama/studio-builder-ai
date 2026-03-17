import { invokeChannel } from "./bridge";

export interface SecretValue {
  value: string;
}

export interface SelectedModel {
  name: string;
  provider: string;
  customModelId?: number;
}

export interface ProviderSetting {
  apiKey?: SecretValue;
  resourceName?: string;
  projectId?: string;
  location?: string;
  serviceAccountKey?: SecretValue;
  [key: string]: unknown;
}

export interface UserSettings {
  selectedModel: SelectedModel;
  providerSettings: Record<string, ProviderSetting>;
  selectedChatMode?: "build" | "ask" | "local-agent" | "plan";
  thinkingBudget?: "low" | "medium" | "high";
}

export async function getUserSettings(): Promise<UserSettings> {
  return invokeChannel<UserSettings>("get-user-settings");
}

export async function setUserSettings(
  settings: Partial<UserSettings>,
): Promise<UserSettings> {
  return invokeChannel<UserSettings>("set-user-settings", settings);
}
