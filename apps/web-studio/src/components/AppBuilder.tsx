import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { createApp, getApp, sendChatMessage } from "../api";
import { ChatPanel } from "./ChatPanel";
import { WorkspacePanel } from "./WorkspacePanel";

interface AppBuilderProps {
  appId: number | null;
  chatId: number | null;
  onSessionChange?: (appId: number, chatId: number) => void;
}

function createAppNameFromPrompt(prompt: string): string {
  const normalized = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 36);
  if (normalized.length > 0) return normalized;
  return `app-${Date.now()}`;
}

export function AppBuilder({ appId, chatId, onSessionChange }: AppBuilderProps) {
  const [currentAppId, setCurrentAppId] = React.useState<number | null>(appId);
  const [currentChatId, setCurrentChatId] = React.useState<number | null>(chatId);
  const [startupError, setStartupError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCurrentAppId(appId);
  }, [appId]);

  React.useEffect(() => {
    setCurrentChatId(chatId);
  }, [chatId]);

  const appQuery = useQuery({
    queryKey: ["app", currentAppId],
    queryFn: () => getApp(currentAppId!),
    enabled: currentAppId !== null,
  });

  const startFromPrompt = React.useCallback(
    async (prompt: string) => {
      const result = await createApp(createAppNameFromPrompt(prompt));
      setCurrentAppId(result.app.id);
      setCurrentChatId(result.chatId);
      onSessionChange?.(result.app.id, result.chatId);
      try {
        await sendChatMessage(result.chatId, prompt);
        setStartupError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStartupError(message);
        throw err;
      }
    },
    [onSessionChange],
  );

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <span style={styles.brand}>Studio AI Builder</span>
        <span style={styles.appName}>
          {appQuery.data?.name ??
            (currentAppId ? `App #${currentAppId}` : "Prompt to create your app")}
        </span>
        <a href="/settings" style={styles.settingsLink}>
          Settings
        </a>
      </div>
      {startupError && <div style={styles.errorBanner}>Error: {startupError}</div>}

      <div style={styles.panels}>
        <div style={styles.chatPane}>
          <ChatPanel
            appId={currentAppId}
            chatId={currentChatId}
            onSubmitWithoutChat={startFromPrompt}
            onChatChange={(newChatId) => {
              setCurrentChatId(newChatId);
              if (currentAppId !== null) {
                onSessionChange?.(currentAppId, newChatId);
              }
            }}
          />
        </div>
        <div style={styles.divider} />
        <div style={styles.previewPane}>
          {currentAppId ? (
            <WorkspacePanel appId={currentAppId} chatId={currentChatId} />
          ) : (
            <div style={styles.emptyPreview}>
              Preview appears here after your first prompt creates an app.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    padding: "0.5rem 1rem",
    borderBottom: "1px solid #30363d",
    backgroundColor: "#161b22",
    minHeight: 44,
  },
  brand: {
    color: "#58a6ff",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: 0.3,
  },
  appName: {
    fontWeight: 600,
    fontSize: 15,
  },
  settingsLink: {
    marginLeft: "auto",
    color: "#58a6ff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 600,
  },
  errorBanner: {
    color: "#f85149",
    fontSize: 12,
    padding: "0.375rem 1rem",
    borderBottom: "1px solid #30363d",
    backgroundColor: "#3d1116",
  },
  panels: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  chatPane: {
    width: "40%",
    minWidth: 320,
    display: "flex",
    flexDirection: "column",
  },
  divider: {
    width: 1,
    backgroundColor: "#30363d",
    flexShrink: 0,
  },
  previewPane: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  emptyPreview: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#8b949e",
    fontSize: 14,
    backgroundColor: "#0d1117",
  },
};
