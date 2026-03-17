import { invokeChannel } from "./bridge";

export interface LanguageModelProvider {
  id: string;
  name: string;
  type: "custom" | "local" | "cloud";
  envVarName?: string;
  hasFreeTier?: boolean;
}

export interface LanguageModel {
  id?: number;
  apiName: string;
  displayName: string;
  description?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
}

export async function getLanguageModelProviders(): Promise<
  LanguageModelProvider[]
> {
  return invokeChannel<LanguageModelProvider[]>("get-language-model-providers");
}

export async function getLanguageModelsByProviders(): Promise<
  Record<string, LanguageModel[]>
> {
  return invokeChannel<Record<string, LanguageModel[]>>(
    "get-language-models-by-providers",
  );
}

export async function getLanguageModels(
  providerId: string,
): Promise<LanguageModel[]> {
  return invokeChannel<LanguageModel[]>("get-language-models", { providerId });
}

export async function createCustomLanguageModelProvider(input: {
  id: string;
  name: string;
  apiBaseUrl: string;
  envVarName?: string;
}): Promise<LanguageModelProvider> {
  return invokeChannel<LanguageModelProvider>(
    "create-custom-language-model-provider",
    input,
  );
}

export async function createCustomLanguageModel(input: {
  apiName: string;
  displayName: string;
  providerId: string;
  description?: string;
  maxOutputTokens?: number;
  contextWindow?: number;
}): Promise<void> {
  await invokeChannel<void>("create-custom-language-model", input);
}

export async function editCustomLanguageModelProvider(input: {
  id: string;
  name: string;
  apiBaseUrl: string;
  envVarName?: string;
}): Promise<LanguageModelProvider> {
  return invokeChannel<LanguageModelProvider>(
    "edit-custom-language-model-provider",
    input,
  );
}

export async function deleteCustomLanguageModelProvider(
  providerId: string,
): Promise<void> {
  await invokeChannel<void>("delete-custom-language-model-provider", {
    providerId,
  });
}

export async function deleteCustomLanguageModel(modelId: string): Promise<void> {
  await invokeChannel<void>("delete-custom-language-model", modelId);
}
