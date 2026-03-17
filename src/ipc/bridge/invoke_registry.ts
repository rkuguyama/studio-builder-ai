import { ipcMain, type IpcMainInvokeEvent } from "electron";

type InvokeHandler = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<unknown>;

const invokeHandlers = new Map<string, InvokeHandler>();

export function registerInvokeHandler(
  channel: string,
  handler: InvokeHandler,
): void {
  ipcMain.handle(channel, handler);
  invokeHandlers.set(channel, handler);
}

export function listRegisteredInvokeChannels(): string[] {
  return Array.from(invokeHandlers.keys()).sort();
}

export async function invokeRegisteredChannel(params: {
  channel: string;
  input?: unknown;
}): Promise<unknown> {
  const handler = invokeHandlers.get(params.channel);
  if (!handler) {
    throw new Error(`Unknown channel: ${params.channel}`);
  }

  const syntheticEvent = {} as IpcMainInvokeEvent;
  if (typeof params.input === "undefined") {
    return handler(syntheticEvent);
  }
  return handler(syntheticEvent, params.input);
}
