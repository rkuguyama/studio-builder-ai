import { useEffect, useRef, useCallback } from "react";
import { API_BASE, API_TOKEN } from "../api";

type EventCallback = (payload: unknown) => void;

interface SseEvent {
  channel: string;
  payload: unknown;
}

const listeners = new Map<string, Set<EventCallback>>();
let eventSource: EventSource | null = null;
let refCount = 0;

function connectEventSource(): void {
  if (eventSource) return;

  const params = new URLSearchParams();
  if (API_TOKEN) params.set("token", API_TOKEN);
  const qs = params.toString();
  const url = `${API_BASE}/events${qs ? `?${qs}` : ""}`;

  const es = new EventSource(url);

  es.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as SseEvent;
      const callbacks = listeners.get(data.channel);
      if (callbacks) {
        for (const cb of callbacks) {
          cb(data.payload);
        }
      }
    } catch {
      // ignore malformed messages
    }
  };

  es.onerror = () => {
    // EventSource auto-reconnects; nothing extra needed
  };

  eventSource = es;
}

function disconnectEventSource(): void {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

/**
 * Maintains the global SSE connection while at least one component is mounted.
 * Call once from a top-level provider or layout.
 */
export function useEventStreamConnection(): void {
  useEffect(() => {
    refCount++;
    if (refCount === 1) {
      connectEventSource();
    }
    return () => {
      refCount--;
      if (refCount === 0) {
        disconnectEventSource();
      }
    };
  }, []);
}

/**
 * Subscribe to a specific SSE channel. The callback fires whenever the
 * bridge emits an event on that channel.
 */
export function useEventListener(
  channel: string,
  callback: EventCallback,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const stableCallback = useCallback((payload: unknown) => {
    callbackRef.current(payload);
  }, []);

  useEffect(() => {
    let set = listeners.get(channel);
    if (!set) {
      set = new Set();
      listeners.set(channel, set);
    }
    set.add(stableCallback);
    return () => {
      set!.delete(stableCallback);
      if (set!.size === 0) {
        listeners.delete(channel);
      }
    };
  }, [channel, stableCallback]);
}
