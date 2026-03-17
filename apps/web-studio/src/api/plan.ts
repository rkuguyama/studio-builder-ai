import { invokeChannel } from "./bridge";

export interface Plan {
  id: string;
  appId: number;
  chatId: number | null;
  title: string;
  summary: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export async function getPlanForChat(
  appId: number,
  chatId: number,
): Promise<Plan | null> {
  return invokeChannel<Plan | null>("plan:get-for-chat", { appId, chatId });
}

export async function createPlan(input: {
  appId: number;
  chatId: number;
  title: string;
  summary?: string;
  content: string;
}): Promise<string> {
  return invokeChannel<string>("plan:create", input);
}

export async function updatePlan(input: {
  appId: number;
  id: string;
  title?: string;
  summary?: string;
  content?: string;
}): Promise<void> {
  await invokeChannel<void>("plan:update-plan", input);
}
