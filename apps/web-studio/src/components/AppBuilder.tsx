import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { getApp } from "../api";
import { ChatPanel } from "./ChatPanel";
import { PreviewPanel } from "./PreviewPanel";

interface AppBuilderProps {
  appId: number;
  chatId: number | null;
}

export function AppBuilder({ appId, chatId }: AppBuilderProps) {
  const appQuery = useQuery({
    queryKey: ["app", appId],
    queryFn: () => getApp(appId),
  });

  return (
    <div style={styles.container}>
      <div style={styles.topBar}>
        <a href="/" style={styles.backLink}>
          &larr; Apps
        </a>
        <span style={styles.appName}>
          {appQuery.data?.name ?? `App #${appId}`}
        </span>
      </div>

      <div style={styles.panels}>
        <div style={styles.chatPane}>
          <ChatPanel chatId={chatId} />
        </div>
        <div style={styles.divider} />
        <div style={styles.previewPane}>
          <PreviewPanel appId={appId} />
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
  backLink: {
    color: "#58a6ff",
    textDecoration: "none",
    fontSize: 14,
  },
  appName: {
    fontWeight: 600,
    fontSize: 15,
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
};
