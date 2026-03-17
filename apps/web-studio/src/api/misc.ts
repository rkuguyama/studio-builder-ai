import { invokeChannel } from "./bridge";

export interface AppOutputEvent {
  appId: number;
  type: "stdout" | "stderr" | "input-requested" | "client-error" | "info";
  message: string;
}

export interface AppEnvVar {
  key: string;
  value: string;
}

export async function getAppEnvVars(appId: number): Promise<AppEnvVar[]> {
  return invokeChannel<AppEnvVar[]>("get-app-env-vars", { appId });
}

export async function setAppEnvVars(
  appId: number,
  envVars: AppEnvVar[],
): Promise<void> {
  await invokeChannel<void>("set-app-env-vars", { appId, envVars });
}

export async function clearLogs(appId: number): Promise<void> {
  await invokeChannel<void>("clear-logs", { appId });
}

export async function checkProblems(appId: number): Promise<unknown> {
  return invokeChannel<unknown>("check-problems", { appId });
}
