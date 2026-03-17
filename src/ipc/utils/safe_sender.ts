import type { WebContents } from "electron";
import log from "electron-log";
import { eventBus } from "../bridge/event_bus";

/**
 * Sends an IPC message to the renderer only if the provided `WebContents` is
 * still alive, and broadcasts to any connected SSE clients via the EventBus.
 */
export function safeSend(
  sender: WebContents | null | undefined,
  channel: string,
  ...args: unknown[]
): void {
  if (sender && !sender.isDestroyed()) {
    // @ts-ignore – `isCrashed` exists at runtime but is not in the type defs
    const crashed =
      typeof sender.isCrashed === "function" && sender.isCrashed();
    if (!crashed) {
      try {
        // @ts-ignore – allow variadic args beyond `data`
        sender.send(channel, ...args);
      } catch (error) {
        log.debug(
          `safeSend: failed to send on channel "${channel}" because: ${(error as Error).message}`,
        );
      }
    }
  }

  eventBus.emit(channel, ...args);
}
