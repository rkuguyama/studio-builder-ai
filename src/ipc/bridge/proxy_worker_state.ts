/**
 * Tracks appIds whose proxy worker has been confirmed dead (ECONNREFUSED).
 * Once flagged, all subsequent requests skip the proxy worker and go
 * directly to the original dev server URL, avoiding the repeated
 * fail-then-retry cycle that made the preview unusable.
 *
 * Separated into its own module to avoid circular dependencies between
 * preview_proxy.ts and process_manager.ts.
 */
const proxyWorkerDead = new Set<number>();

export function markProxyWorkerDead(appId: number): void {
  proxyWorkerDead.add(appId);
}

export function isProxyWorkerDead(appId: number): boolean {
  return proxyWorkerDead.has(appId);
}

export function clearProxyWorkerDeadFlag(appId: number): void {
  proxyWorkerDead.delete(appId);
}
