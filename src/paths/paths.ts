import path from "node:path";
import os from "node:os";
import { IS_TEST_BUILD } from "../ipc/utils/test_utils";

/**
 * Gets the base dyad-apps directory path (without a specific app subdirectory).
 * Override with DYAD_APPS_DIR env var for server/VM deployments.
 */
export function getDyadAppsBaseDirectory(): string {
  if (process.env.DYAD_APPS_DIR) {
    return process.env.DYAD_APPS_DIR;
  }
  if (IS_TEST_BUILD) {
    const electron = getElectron();
    return path.join(electron!.app.getPath("userData"), "dyad-apps");
  }
  return path.join(os.homedir(), "dyad-apps");
}

export function getDyadAppPath(appPath: string): string {
  // If appPath is already absolute, use it as-is
  if (path.isAbsolute(appPath)) {
    return appPath;
  }
  // Otherwise, use the default base path
  return path.join(getDyadAppsBaseDirectory(), appPath);
}

export function getTypeScriptCachePath(): string {
  const electron = getElectron();
  return path.join(electron!.app.getPath("sessionData"), "typescript-cache");
}

/**
 * Gets the user data path, handling both Electron and non-Electron environments.
 * Override with DYAD_DATA_DIR env var for server/VM deployments.
 * In Electron: returns the app's userData directory.
 * In non-Electron: returns "./userData" in the current directory.
 */
export function getUserDataPath(): string {
  if (process.env.DYAD_DATA_DIR) {
    return process.env.DYAD_DATA_DIR;
  }

  const electron = getElectron();

  if (process.env.NODE_ENV !== "development" && electron) {
    return electron!.app.getPath("userData");
  }

  return path.resolve("./userData");
}

/**
 * Get a reference to electron in a way that won't break in non-electron environments
 */
export function getElectron(): typeof import("electron") | undefined {
  let electron: typeof import("electron") | undefined;
  try {
    // Check if we're in an Electron environment
    if (process.versions.electron) {
      electron = require("electron");
    }
  } catch {
    // Not in Electron environment
  }
  return electron;
}
