import { type ServerResponse } from "node:http";
import path from "node:path";
import archiver from "archiver";
import log from "electron-log";
import { db } from "../../db";
import { apps } from "../../db/schema";
import { eq } from "drizzle-orm";
import { getDyadAppPath } from "../../paths/paths";

const logger = log.scope("export_zip");

/**
 * Parse paths like "/export/42.zip"
 */
export function parseExportPath(
  url: string,
): { appId: number } | null {
  const parsed = new URL(url, "http://localhost");
  const match = /^\/export\/(\d+)\.zip$/.exec(parsed.pathname);
  if (!match) return null;
  return { appId: Number(match[1]) };
}

/**
 * Stream the app's project folder as a zip archive.
 * Excludes node_modules, .git, .next, and other build artifacts.
 */
export async function handleExportRequest(
  res: ServerResponse,
  appId: number,
): Promise<void> {
  const [app] = await db
    .select()
    .from(apps)
    .where(eq(apps.id, appId))
    .limit(1);

  if (!app) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: `App ${appId} not found` }));
    return;
  }

  const appPath = getDyadAppPath(app.path);
  const safeName = app.name.replace(/[^a-zA-Z0-9_-]/g, "_");

  logger.info(`Exporting app ${appId} from ${appPath}`);

  res.writeHead(200, {
    "Content-Type": "application/zip",
    "Content-Disposition": `attachment; filename="${safeName}.zip"`,
    "Access-Control-Allow-Origin": "*",
  });

  const archive = archiver("zip", { zlib: { level: 6 } });

  archive.on("error", (err) => {
    logger.error(`Archive error for app ${appId}:`, err.message);
    if (!res.writableEnded) {
      res.end();
    }
  });

  archive.pipe(res);

  archive.glob("**/*", {
    cwd: appPath,
    ignore: [
      "node_modules/**",
      ".git/**",
      ".next/**",
      "dist/**",
      ".vite/**",
    ],
    dot: true,
  });

  await archive.finalize();
  logger.info(`Export complete for app ${appId}`);
}
