/**
 * Runtime configuration for the web studio.
 *
 * Supports three resolution strategies (in priority order):
 * 1. window.__RUNTIME_CONFIG__ — injected by the hosting server at serve time
 * 2. Vite env vars (import.meta.env.VITE_*) — baked at build time
 * 3. Hardcoded defaults
 *
 * For VM/SaaS deployments, the hosting server (nginx) should inject a script
 * tag that sets window.__RUNTIME_CONFIG__ before the app bundle loads.
 */

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: {
      BRIDGE_URL?: string;
      BRIDGE_TOKEN?: string;
    };
  }
}

function resolve(
  runtimeKey: keyof NonNullable<Window["__RUNTIME_CONFIG__"]>,
  envKey: string,
  fallback: string,
): string {
  return (
    window.__RUNTIME_CONFIG__?.[runtimeKey] ??
    (import.meta.env[envKey] as string | undefined) ??
    fallback
  );
}

function resolveOptional(
  runtimeKey: keyof NonNullable<Window["__RUNTIME_CONFIG__"]>,
  envKey: string,
): string | undefined {
  return (
    window.__RUNTIME_CONFIG__?.[runtimeKey] ??
    (import.meta.env[envKey] as string | undefined) ??
    undefined
  );
}

export const config = {
  get bridgeUrl(): string {
    return resolve("BRIDGE_URL", "VITE_DYAD_BRIDGE_URL", "http://localhost:4310");
  },
  get bridgeToken(): string | undefined {
    return resolveOptional("BRIDGE_TOKEN", "VITE_DYAD_BRIDGE_TOKEN");
  },
} as const;
