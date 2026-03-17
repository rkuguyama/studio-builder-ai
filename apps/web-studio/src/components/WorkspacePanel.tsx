import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  API_BASE,
  API_TOKEN,
  checkProblems,
  clearLogs,
  createPlan,
  editAppFile,
  exportAppZipUrl,
  getApp,
  getAppEnvVars,
  getLatestSecurityReview,
  getPlanForChat,
  getPreviewUrl,
  getVercelDeployments,
  readAppFile,
  runApp,
  setAppEnvVars,
  stopApp,
  updatePlan,
} from "../api";
import { IntegrationsPanel } from "./IntegrationsPanel";
import { useEventListener } from "../hooks/useEventStream";

type WorkspaceMode =
  | "preview"
  | "code"
  | "problems"
  | "configure"
  | "security"
  | "plan"
  | "publish";

interface WorkspacePanelProps {
  appId: number;
  chatId: number | null;
}

export function WorkspacePanel({ appId, chatId }: WorkspacePanelProps) {
  const [mode, setMode] = React.useState<WorkspaceMode>("preview");
  const [iframeKey, setIframeKey] = React.useState(0);
  const [appOutput, setAppOutput] = React.useState<string[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
  const [fileContentDraft, setFileContentDraft] = React.useState("");
  const [planDraft, setPlanDraft] = React.useState("");
  const [envVarsDraft, setEnvVarsDraft] = React.useState<
    Array<{ key: string; value: string }>
  >([]);

  const appQuery = useQuery({
    queryKey: ["app", appId],
    queryFn: () => getApp(appId),
  });
  const previewQuery = useQuery({
    queryKey: ["preview-url", appId],
    queryFn: () => getPreviewUrl(appId),
    refetchInterval: 3000,
  });
  const problemsQuery = useQuery({
    queryKey: ["app-problems", appId],
    queryFn: () => checkProblems(appId),
    enabled: mode === "problems",
  });
  const envVarsQuery = useQuery({
    queryKey: ["app-env-vars", appId],
    queryFn: () => getAppEnvVars(appId),
    enabled: mode === "configure",
  });
  const securityQuery = useQuery({
    queryKey: ["security-review", appId],
    queryFn: () => getLatestSecurityReview(appId),
    enabled: mode === "security",
  });
  const planQuery = useQuery({
    queryKey: ["plan-by-chat", appId, chatId],
    queryFn: () => getPlanForChat(appId, chatId!),
    enabled: mode === "plan" && chatId !== null,
  });
  const vercelDeploymentsQuery = useQuery({
    queryKey: ["vercel-deployments", appId],
    queryFn: () => getVercelDeployments(appId),
    enabled: mode === "publish",
  });
  const selectedFileQuery = useQuery({
    queryKey: ["app-file", appId, selectedFile],
    queryFn: () => readAppFile(appId, selectedFile!),
    enabled: selectedFile !== null,
  });

  React.useEffect(() => {
    if (selectedFileQuery.data != null) {
      setFileContentDraft(selectedFileQuery.data);
    }
  }, [selectedFileQuery.data]);

  React.useEffect(() => {
    if (planQuery.data?.content != null) {
      setPlanDraft(planQuery.data.content);
    }
  }, [planQuery.data?.content]);

  React.useEffect(() => {
    if (envVarsQuery.data != null) {
      setEnvVarsDraft(envVarsQuery.data);
    }
  }, [envVarsQuery.data]);

  const saveFileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) return;
      await editAppFile(appId, selectedFile, fileContentDraft);
    },
  });

  const saveEnvMutation = useMutation({
    mutationFn: () => setAppEnvVars(appId, envVarsDraft),
  });

  const savePlanMutation = useMutation({
    mutationFn: async () => {
      if (chatId === null) return;
      if (planQuery.data) {
        await updatePlan({
          appId,
          id: planQuery.data.id,
          content: planDraft,
        });
      } else {
        await createPlan({
          appId,
          chatId,
          title: "Web Studio Plan",
          content: planDraft,
        });
      }
    },
  });

  useEventListener("app:output", (payload) => {
    const data = payload as { appId: number; message: string };
    if (data.appId !== appId) return;
    setAppOutput((prev) => [...prev.slice(-300), data.message]);
  });

  const previewUrl = React.useMemo(() => {
    if (!previewQuery.data?.previewPath) return null;
    const tokenParam = API_TOKEN ? `?token=${encodeURIComponent(API_TOKEN)}` : "";
    return `${API_BASE}${previewQuery.data.previewPath}${tokenParam}`;
  }, [previewQuery.data?.previewPath]);

  return (
    <div style={styles.container}>
      <div style={styles.modeSidebar}>
        {(
          [
            "preview",
            "code",
            "problems",
            "configure",
            "security",
            "plan",
            "publish",
          ] as WorkspaceMode[]
        ).map((item) => (
          <button
            key={item}
            type="button"
            style={{
              ...styles.modeButton,
              ...(item === mode ? styles.modeButtonActive : {}),
            }}
            onClick={() => setMode(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div style={styles.main}>
        {mode === "preview" && (
          <div style={styles.fill}>
            <div style={styles.toolbar}>
              <span style={styles.statusText}>
                {previewQuery.data?.running ? "Running" : "Stopped"}
              </span>
              <button style={styles.smallButton} onClick={() => runApp(appId)}>
                Run
              </button>
              <button style={styles.smallButton} onClick={() => stopApp(appId)}>
                Stop
              </button>
              <button
                style={styles.smallButton}
                onClick={() => setIframeKey((k) => k + 1)}
              >
                Refresh
              </button>
              <a
                href={exportAppZipUrl(appId)}
                download
                style={{ ...styles.smallButton, textDecoration: "none", display: "inline-block" }}
              >
                Export .zip
              </a>
            </div>
            {previewUrl ? (
              <iframe
                key={iframeKey}
                src={previewUrl}
                style={styles.iframe}
                title={`Preview app ${appId}`}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            ) : (
              <div style={styles.emptyPane}>Run the app to see preview.</div>
            )}
            <div style={styles.logsPane}>
              <div style={styles.logsHeader}>
                <span>Logs</span>
                <button
                  style={styles.linkButton}
                  onClick={() => {
                    setAppOutput([]);
                    void clearLogs(appId);
                  }}
                >
                  clear
                </button>
              </div>
              <pre style={styles.logs}>{appOutput.join("\n") || "No logs yet"}</pre>
            </div>
          </div>
        )}

        {mode === "code" && (
          <div style={styles.codeShell}>
            <div style={styles.fileTree}>
              {(appQuery.data?.files ?? []).map((file) => (
                <button
                  key={file}
                  type="button"
                  style={{
                    ...styles.fileButton,
                    ...(file === selectedFile ? styles.fileButtonActive : {}),
                  }}
                  onClick={() => setSelectedFile(file)}
                >
                  {file}
                </button>
              ))}
            </div>
            <div style={styles.editorPane}>
              <div style={styles.toolbar}>
                <span>{selectedFile ?? "Select file"}</span>
                <button
                  style={styles.smallButton}
                  onClick={() => saveFileMutation.mutate()}
                  disabled={selectedFile == null || saveFileMutation.isPending}
                >
                  Save
                </button>
              </div>
              <textarea
                style={styles.editor}
                value={fileContentDraft}
                onChange={(e) => setFileContentDraft(e.target.value)}
                disabled={selectedFile == null}
              />
            </div>
          </div>
        )}

        {mode === "problems" && (
          <pre style={styles.panelPre}>
            {JSON.stringify(problemsQuery.data ?? {}, null, 2)}
          </pre>
        )}

        {mode === "configure" && (
          <div style={styles.fill}>
            <div style={styles.toolbar}>
              <span>Environment Variables</span>
              <button style={styles.smallButton} onClick={() => saveEnvMutation.mutate()}>
                Save
              </button>
            </div>
            {envVarsDraft.map((entry, index) => (
              <div key={`${entry.key}-${index}`} style={styles.envRow}>
                <input
                  value={entry.key}
                  style={styles.envInput}
                  onChange={(e) => {
                    const next = [...envVarsDraft];
                    next[index] = { ...next[index], key: e.target.value };
                    setEnvVarsDraft(next);
                  }}
                />
                <input
                  value={entry.value}
                  style={styles.envInput}
                  onChange={(e) => {
                    const next = [...envVarsDraft];
                    next[index] = { ...next[index], value: e.target.value };
                    setEnvVarsDraft(next);
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {mode === "security" && (
          <pre style={styles.panelPre}>
            {JSON.stringify(securityQuery.data ?? {}, null, 2)}
          </pre>
        )}

        {mode === "plan" && (
          <div style={styles.fill}>
            <div style={styles.toolbar}>
              <span>Implementation Plan</span>
              <button style={styles.smallButton} onClick={() => savePlanMutation.mutate()}>
                Save Plan
              </button>
            </div>
            <textarea
              value={planDraft}
              onChange={(e) => setPlanDraft(e.target.value)}
              style={styles.editor}
            />
          </div>
        )}

        {mode === "publish" && (
          <div style={styles.fill}>
            <h3 style={styles.subHeading}>Deployments</h3>
            <pre style={styles.panelPre}>
              {JSON.stringify(vercelDeploymentsQuery.data ?? [], null, 2)}
            </pre>
            <IntegrationsPanel appId={appId} />
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", height: "100%", backgroundColor: "#0d1117" },
  modeSidebar: {
    width: 120,
    borderRight: "1px solid #30363d",
    backgroundColor: "#161b22",
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
    padding: "0.5rem",
  },
  modeButton: {
    textTransform: "capitalize",
    padding: "0.35rem 0.5rem",
    borderRadius: 6,
    border: "1px solid #30363d",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
    fontSize: 12,
    cursor: "pointer",
  },
  modeButtonActive: { borderColor: "#1f6feb", backgroundColor: "#0f2547" },
  main: { flex: 1, minWidth: 0 },
  fill: { height: "100%", display: "flex", flexDirection: "column" },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
    borderBottom: "1px solid #30363d",
    padding: "0.45rem 0.6rem",
    color: "#e6edf3",
    fontSize: 12,
    backgroundColor: "#161b22",
  },
  statusText: { flex: 1 },
  smallButton: {
    border: "1px solid #30363d",
    backgroundColor: "#21262d",
    color: "#e6edf3",
    borderRadius: 6,
    fontSize: 12,
    padding: "0.2rem 0.55rem",
    cursor: "pointer",
  },
  iframe: { flex: 1, border: "none", backgroundColor: "#fff" },
  emptyPane: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#8b949e",
  },
  logsPane: { height: 160, borderTop: "1px solid #30363d" },
  logsHeader: {
    display: "flex",
    justifyContent: "space-between",
    padding: "0.3rem 0.6rem",
    borderBottom: "1px solid #30363d",
    fontSize: 12,
    color: "#8b949e",
  },
  logs: {
    margin: 0,
    padding: "0.4rem 0.6rem",
    color: "#8b949e",
    fontSize: 11,
    fontFamily: "monospace",
    overflow: "auto",
    height: 120,
    whiteSpace: "pre-wrap",
  },
  linkButton: {
    border: "none",
    background: "none",
    color: "#58a6ff",
    cursor: "pointer",
    fontSize: 12,
  },
  codeShell: { display: "flex", height: "100%" },
  fileTree: {
    width: 280,
    borderRight: "1px solid #30363d",
    overflow: "auto",
    padding: "0.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  fileButton: {
    textAlign: "left",
    fontSize: 12,
    border: "1px solid #30363d",
    backgroundColor: "#161b22",
    color: "#e6edf3",
    padding: "0.3rem 0.45rem",
    borderRadius: 6,
    cursor: "pointer",
  },
  fileButtonActive: { borderColor: "#1f6feb", backgroundColor: "#0f2547" },
  editorPane: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  editor: {
    flex: 1,
    backgroundColor: "#0d1117",
    color: "#e6edf3",
    border: "none",
    outline: "none",
    resize: "none",
    padding: "0.8rem",
    fontFamily: "monospace",
    fontSize: 12,
  },
  panelPre: {
    margin: 0,
    padding: "0.8rem",
    color: "#8b949e",
    fontFamily: "monospace",
    fontSize: 12,
    overflow: "auto",
    height: "100%",
  },
  envRow: { display: "grid", gridTemplateColumns: "1fr 2fr", gap: "0.4rem", padding: "0.4rem 0.6rem" },
  envInput: {
    borderRadius: 6,
    border: "1px solid #30363d",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
    padding: "0.35rem 0.5rem",
  },
  subHeading: {
    margin: "0.6rem 0.8rem 0.2rem",
    fontSize: 13,
    color: "#e6edf3",
  },
};
