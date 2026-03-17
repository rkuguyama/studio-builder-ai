import { invokeChannel } from "./bridge";

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  approvalState?: "approved" | "rejected" | null;
}

export interface ChatData {
  id: number;
  title: string;
  messages: ChatMessage[];
}

export interface ChatSummary {
  id: number;
  appId: number;
  title: string | null;
  createdAt: string | Date;
}

export interface ChatAttachmentPayload {
  name: string;
  type: string;
  data: string;
  attachmentType: "upload-to-codebase" | "chat-context";
}

export async function getChat(chatId: number): Promise<ChatData> {
  return invokeChannel<ChatData>("get-chat", chatId);
}

export async function getChats(appId?: number): Promise<ChatSummary[]> {
  return invokeChannel<ChatSummary[]>("get-chats", appId);
}

export async function createChat(appId: number): Promise<number> {
  return invokeChannel<number>("create-chat", appId);
}

export async function updateChat(chatId: number, title: string): Promise<void> {
  await invokeChannel<void>("update-chat", { chatId, title });
}

export async function deleteChat(chatId: number): Promise<void> {
  await invokeChannel<void>("delete-chat", chatId);
}

export async function sendChatMessage(
  chatId: number,
  prompt: string,
  options?: {
    redo?: boolean;
    attachments?: ChatAttachmentPayload[];
  },
): Promise<void> {
  await invokeChannel<void>("chat:stream", {
    chatId,
    prompt,
    redo: options?.redo,
    attachments: options?.attachments,
  });
}

export async function cancelChatStream(chatId: number): Promise<boolean> {
  return invokeChannel<boolean>("chat:cancel", chatId);
}
