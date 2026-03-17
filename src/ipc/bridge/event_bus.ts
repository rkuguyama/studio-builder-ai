import type { ServerResponse } from "node:http";
import log from "electron-log";

const logger = log.scope("event_bus");

interface SseClient {
  id: string;
  response: ServerResponse;
  keepaliveTimer: ReturnType<typeof setInterval>;
}

class EventBus {
  private clients = new Map<string, SseClient>();
  private clientCounter = 0;

  addClient(response: ServerResponse): string {
    const id = `sse-${++this.clientCounter}-${Date.now()}`;

    const keepaliveTimer = setInterval(() => {
      if (response.destroyed) {
        this.removeClient(id);
        return;
      }
      response.write(":keepalive\n\n");
    }, 15_000);

    this.clients.set(id, { id, response, keepaliveTimer });

    response.on("close", () => this.removeClient(id));

    logger.info(`SSE client connected: ${id} (total: ${this.clients.size})`);
    return id;
  }

  removeClient(id: string): void {
    const client = this.clients.get(id);
    if (!client) return;
    clearInterval(client.keepaliveTimer);
    this.clients.delete(id);
    logger.info(`SSE client disconnected: ${id} (total: ${this.clients.size})`);
  }

  emit(channel: string, ...args: unknown[]): void {
    if (this.clients.size === 0) return;

    const payload = JSON.stringify({
      channel,
      payload: args.length === 1 ? args[0] : args,
    });
    const message = `data: ${payload}\n\n`;

    for (const [id, client] of this.clients) {
      if (client.response.destroyed) {
        this.removeClient(id);
        continue;
      }
      try {
        client.response.write(message);
      } catch {
        this.removeClient(id);
      }
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }

  removeAllClients(): void {
    for (const id of this.clients.keys()) {
      this.removeClient(id);
    }
  }
}

export const eventBus = new EventBus();
