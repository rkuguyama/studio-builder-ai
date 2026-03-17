import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApp, getApp, listApps, sendChatMessage } from "../api";
import { ChatPanel } from "./ChatPanel";
import { WorkspacePanel } from "./WorkspacePanel";

interface AppBuilderProps {
  appId: number | null;
  chatId: number | null;
  onSessionChange?: (appId: number, chatId: number) => void;
  onNewProject?: () => void;
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

type BootstrapPhase = "idle" | "creating" | "prompting" | "done";

export function AppBuilder({ appId, chatId, onSessionChange, onNewProject }: AppBuilderProps) {
  const queryClient = useQueryClient();
  const [currentAppId, setCurrentAppId] = React.useState<number | null>(appId);
  const [currentChatId, setCurrentChatId] = React.useState<number | null>(chatId);
  const [startupError, setStartupError] = React.useState<string | null>(null);
  const [bootstrapPhase, setBootstrapPhase] = React.useState<BootstrapPhase>("idle");
  const [showSidebar, setShowSidebar] = React.useState(true);

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

  const appsListQuery = useQuery({
    queryKey: ["apps-list"],
    queryFn: listApps,
    refetchInterval: 10000,
  });

  const startFromPrompt = React.useCallback(
    async (prompt: string) => {
      setStartupError(null);
      setBootstrapPhase("creating");
      try {
        const result = await createApp(createAppNameFromPrompt(prompt));
        setCurrentAppId(result.app.id);
        setCurrentChatId(result.chatId);
        onSessionChange?.(result.app.id, result.chatId);
        queryClient.invalidateQueries({ queryKey: ["apps-list"] });

        setBootstrapPhase("prompting");
        await sendChatMessage(result.chatId, prompt);
        setBootstrapPhase("done");
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStartupError(message);
        setBootstrapPhase("idle");
        throw err;
      }
    },
    [onSessionChange, queryClient],
  );

  const sortedApps = React.useMemo(() => {
    if (!appsListQuery.data) return [];
    return [...appsListQuery.data].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [appsListQuery.data]);

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <button
          type="button"
          style={styles.sidebarToggle}
          onClick={() => setShowSidebar((v) => !v)}
          title={showSidebar ? "Hide projects" : "Show projects"}
        >
          {showSidebar ? "\u2190" : "\u2192"}
        </button>
        <span style={styles.brand}>Studio AI Builder</span>
        <span style={styles.appName}>
          {appQuery.data?.name ??
            (currentAppId ? `App #${currentAppId}` : "New project")}
        </span>
        {bootstrapPhase !== "idle" && bootstrapPhase !== "done" && (
          <span style={styles.phaseIndicator}>
            {bootstrapPhase === "creating" && "Creating project..."}
            {bootstrapPhase === "prompting" && "Sending to AI..."}
          </span>
        )}
        <a href="/settings" style={styles.settingsLink}>
          Settings
        </a>
      </div>
      {startupError && <div style={styles.errorBanner}>Error: {startupError}</div>}

      <div style={styles.body}>
        {showSidebar && (
          <div style={styles.sidebar}>
            <div style={styles.sidebarHeader}>
              <span style={styles.sidebarTitle}>Projects</span>
              <button
                type="button"
                style={styles.newProjectButton}
                onClick={() => onNewProject?.()}
              >
                + New
              </button>
            </div>
            <div style={styles.sidebarList}>
              {sortedApps.length === 0 && !appsListQuery.isLoading && (
                <div style={styles.sidebarEmpty}>
                  No projects yet. Start by typing a prompt.
                </div>
              )}
              {appsListQuery.isLoading && (
                <div style={styles.sidebarEmpty}>Loading...</div>
              )}
              {sortedApps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  style={{
                    ...styles.sidebarItem,
                    ...(app.id === currentAppId ? styles.sidebarItemActive : {}),
                  }}
                  onClick={() => {
                    if (app.id === currentAppId) return;
                    onSessionChange?.(app.id, 0);
                  }}
                >
                  <div style={styles.sidebarItemName}>{app.name}</div>
                  <div style={styles.sidebarItemDate}>
                    {new Date(app.createdAt).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={styles.panels}>
          <div style={styles.chatPane}>
            <ChatPanel
              appId={currentAppId}
              chatId={currentChatId}
              onSubmitWithoutChat={startFromPrompt}
              onNewProject={onNewProject}
              bootstrapPhase={bootstrapPhase}
            />
          </div>
          <div style={styles.divider} />
          <div style={styles.previewPane}>
            {currentAppId ? (
              <WorkspacePanel appId={currentAppId} chatId={currentChatId} />
            ) : (
              <div style={styles.emptyPreview}>
                <div style={styles.emptyPreviewContent}>
                  <div style={styles.emptyPreviewTitle}>Welcome to Studio AI Builder</div>
                  <div style={styles.emptyPreviewBody}>
                    Describe what you want to build in the chat panel. The AI will
                    create your project, write the code, and show a live preview here.
                  </div>
                </div>
              </div>
            )}
          </div>
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
    gap: "0.75rem",
    padding: "0.5rem 1rem",
    borderBottom: "1px solid #30363d",
    backgroundColor: "#161b22",
    minHeight: 44,
  },
  sidebarToggle: {
    background: "none",
    border: "1px solid #30363d",
    color: "#8b949e",
    borderRadius: 6,
    padding: "0.15rem 0.5rem",
    cursor: "pointer",
    fontSize: 14,
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
  phaseIndicator: {
    fontSize: 12,
    color: "#f0883e",
    fontWeight: 600,
    padding: "0.15rem 0.5rem",
    border: "1px solid #f0883e",
    borderRadius: 4,
    animation: "pulse 1.5s ease-in-out infinite",
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
  body: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: {
    width: 220,
    borderRight: "1px solid #30363d",
    backgroundColor: "#0d1117",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  },
  sidebarHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.6rem 0.75rem",
    borderBottom: "1px solid #30363d",
    backgroundColor: "#161b22",
  },
  sidebarTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#8b949e",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  newProjectButton: {
    padding: "0.2rem 0.5rem",
    borderRadius: 6,
    border: "1px solid #238636",
    backgroundColor: "transparent",
    color: "#3fb950",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
  },
  sidebarList: {
    flex: 1,
    overflowY: "auto" as const,
    padding: "0.4rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.25rem",
  },
  sidebarEmpty: {
    padding: "1rem 0.5rem",
    fontSize: 12,
    color: "#484f58",
    textAlign: "center" as const,
    lineHeight: 1.4,
  },
  sidebarItem: {
    display: "flex",
    flexDirection: "column" as const,
    textAlign: "left" as const,
    padding: "0.5rem 0.6rem",
    borderRadius: 6,
    border: "1px solid transparent",
    backgroundColor: "transparent",
    color: "#e6edf3",
    cursor: "pointer",
    transition: "background-color 0.15s",
  },
  sidebarItemActive: {
    backgroundColor: "#0f2547",
    borderColor: "#1f6feb",
  },
  sidebarItemName: {
    fontSize: 13,
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  sidebarItemDate: {
    fontSize: 11,
    color: "#484f58",
    marginTop: 2,
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
    backgroundColor: "#0d1117",
    padding: "2rem",
  },
  emptyPreviewContent: {
    maxWidth: 400,
    textAlign: "center" as const,
  },
  emptyPreviewTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#58a6ff",
    marginBottom: 8,
  },
  emptyPreviewBody: {
    fontSize: 14,
    color: "#8b949e",
    lineHeight: 1.5,
  },
};
