import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { getPreviewUrl, API_BASE, API_TOKEN, runApp } from "../api";
import { useEventListener } from "../hooks/useEventStream";

interface PreviewPanelProps {
  appId: number;
}

export function PreviewPanel({ appId }: PreviewPanelProps) {
  const [iframeKey, setIframeKey] = React.useState(0);
  const [appOutput, setAppOutput] = React.useState<string[]>([]);
  const [showLogs, setShowLogs] = React.useState(false);

  const preview = useQuery({
    queryKey: ["preview-url", appId],
    queryFn: () => getPreviewUrl(appId),
    refetchInterval: 3000,
  });

  useEventListener("app:output", (payload) => {
    const data = payload as {
      appId: number;
      type: string;
      message: string;
    };
    if (data.appId !== appId) return;
    setAppOutput((prev) => [...prev.slice(-200), data.message]);
  });

  const previewUrl = React.useMemo(() => {
    if (!preview.data?.previewPath) return null;
    const params = API_TOKEN ? `?token=${encodeURIComponent(API_TOKEN)}` : "";
    return `${API_BASE}${preview.data.previewPath}${params}`;
  }, [preview.data?.previewPath]);

  const handleRun = async () => {
    try {
      await runApp(appId);
    } catch {
      // errors will show in app output
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <span style={styles.statusDot(preview.data?.running ?? false)} />
        <span style={styles.statusText}>
          {preview.data?.running
            ? previewUrl
              ? "Running"
              : "Starting..."
            : "Stopped"}
        </span>

        <div style={styles.toolbarActions}>
          {!preview.data?.running && (
            <button onClick={handleRun} style={styles.toolbarButton}>
              Run
            </button>
          )}
          {previewUrl && (
            <button
              onClick={() => setIframeKey((k) => k + 1)}
              style={styles.toolbarButton}
            >
              Refresh
            </button>
          )}
          <button
            onClick={() => setShowLogs((v) => !v)}
            style={{
              ...styles.toolbarButton,
              ...(showLogs ? styles.activeButton : {}),
            }}
          >
            Logs
          </button>
        </div>
      </div>

      <div style={styles.content}>
        {previewUrl ? (
          <iframe
            key={iframeKey}
            src={previewUrl}
            style={styles.iframe}
            title={`Preview app ${appId}`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        ) : (
          <div style={styles.placeholder}>
            {preview.data?.running ? (
              <>
                <div style={styles.spinner} />
                <p>Waiting for dev server to start...</p>
              </>
            ) : (
              <p>Click "Run" to start the app preview</p>
            )}
          </div>
        )}

        {showLogs && (
          <div style={styles.logsPanel}>
            <div style={styles.logsHeader}>
              <span>App Output</span>
              <button
                onClick={() => setAppOutput([])}
                style={styles.clearButton}
              >
                Clear
              </button>
            </div>
            <pre style={styles.logsContent}>
              {appOutput.length > 0 ? appOutput.join("\n") : "No output yet"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<
  string,
  React.CSSProperties | ((...args: never[]) => React.CSSProperties)
> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "#0d1117",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 1rem",
    borderBottom: "1px solid #30363d",
    backgroundColor: "#161b22",
    minHeight: 40,
  },
  statusDot: (running: boolean): React.CSSProperties => ({
    width: 8,
    height: 8,
    borderRadius: "50%",
    backgroundColor: running ? "#3fb950" : "#6e7681",
    flexShrink: 0,
  }),
  statusText: {
    fontSize: 13,
    color: "#e6edf3",
    flex: 1,
  },
  toolbarActions: {
    display: "flex",
    gap: "0.375rem",
  },
  toolbarButton: {
    padding: "0.25rem 0.75rem",
    borderRadius: 6,
    border: "1px solid #30363d",
    backgroundColor: "#21262d",
    color: "#e6edf3",
    fontSize: 12,
    cursor: "pointer",
  },
  activeButton: {
    backgroundColor: "#1f6feb",
    borderColor: "#1f6feb",
  },
  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
  },
  iframe: {
    flex: 1,
    border: "none",
    width: "100%",
    height: "100%",
    backgroundColor: "#fff",
  },
  placeholder: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    color: "#6e7681",
    fontSize: 14,
  },
  spinner: {
    width: 24,
    height: 24,
    border: "3px solid #30363d",
    borderTopColor: "#58a6ff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  logsPanel: {
    height: 200,
    borderTop: "1px solid #30363d",
    backgroundColor: "#0d1117",
    display: "flex",
    flexDirection: "column",
  },
  logsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.375rem 0.75rem",
    borderBottom: "1px solid #21262d",
    fontSize: 12,
    color: "#8b949e",
    fontWeight: 600,
  },
  clearButton: {
    background: "none",
    border: "none",
    color: "#58a6ff",
    cursor: "pointer",
    fontSize: 11,
  },
  logsContent: {
    flex: 1,
    overflow: "auto",
    padding: "0.5rem 0.75rem",
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    color: "#8b949e",
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
  },
};
