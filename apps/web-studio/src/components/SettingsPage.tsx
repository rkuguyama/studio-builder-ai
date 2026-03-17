import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createCustomLanguageModel,
  createCustomLanguageModelProvider,
  deleteCustomLanguageModel,
  deleteCustomLanguageModelProvider,
  getLanguageModelProviders,
  getLanguageModelsByProviders,
  getUserSettings,
  setUserSettings,
} from "../api";
import { queryKeys } from "../lib/queryKeys";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [apiKeys, setApiKeys] = React.useState<Record<string, string>>({});
  const [azureResourceName, setAzureResourceName] = React.useState("");
  const [vertexProjectId, setVertexProjectId] = React.useState("");
  const [vertexLocation, setVertexLocation] = React.useState("");
  const [vertexServiceAccount, setVertexServiceAccount] = React.useState("");
  const [customProviderName, setCustomProviderName] = React.useState("");
  const [customProviderId, setCustomProviderId] = React.useState("");
  const [customProviderBaseUrl, setCustomProviderBaseUrl] = React.useState("");
  const [customModelName, setCustomModelName] = React.useState("");
  const [customModelApiName, setCustomModelApiName] = React.useState("");
  const [customModelProviderId, setCustomModelProviderId] = React.useState("");

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings.user,
    queryFn: getUserSettings,
  });
  const providersQuery = useQuery({
    queryKey: queryKeys.settings.providers,
    queryFn: getLanguageModelProviders,
  });
  const modelsQuery = useQuery({
    queryKey: queryKeys.settings.modelsByProvider,
    queryFn: getLanguageModelsByProviders,
  });

  React.useEffect(() => {
    const next: Record<string, string> = {};
    const providerSettings = settingsQuery.data?.providerSettings ?? {};
    for (const providerId of Object.keys(providerSettings)) {
      next[providerId] = providerSettings[providerId].apiKey?.value ?? "";
    }
    setApiKeys(next);
    setAzureResourceName(providerSettings.azure?.resourceName as string);
    setVertexProjectId(providerSettings.vertex?.projectId as string);
    setVertexLocation(providerSettings.vertex?.location as string);
    setVertexServiceAccount(
      (providerSettings.vertex?.serviceAccountKey as { value?: string })?.value ??
        "",
    );
  }, [settingsQuery.data?.providerSettings]);

  const saveSettingsMutation = useMutation({
    mutationFn: setUserSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.user });
    },
  });

  const createCustomProviderMutation = useMutation({
    mutationFn: createCustomLanguageModelProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.providers });
      setCustomProviderName("");
      setCustomProviderId("");
      setCustomProviderBaseUrl("");
    },
  });

  const createCustomModelMutation = useMutation({
    mutationFn: createCustomLanguageModel,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.modelsByProvider,
      });
      setCustomModelName("");
      setCustomModelApiName("");
    },
  });

  const saveAllProviderSettings = () => {
    const providerSettings = settingsQuery.data?.providerSettings ?? {};
    const nextProviderSettings = { ...providerSettings };
    for (const [providerId, key] of Object.entries(apiKeys)) {
      nextProviderSettings[providerId] = {
        ...nextProviderSettings[providerId],
        apiKey: key.trim() ? { value: key.trim() } : undefined,
      };
    }
    nextProviderSettings.azure = {
      ...nextProviderSettings.azure,
      resourceName: azureResourceName,
    };
    nextProviderSettings.vertex = {
      ...nextProviderSettings.vertex,
      projectId: vertexProjectId,
      location: vertexLocation,
      serviceAccountKey: vertexServiceAccount.trim()
        ? { value: vertexServiceAccount.trim() }
        : undefined,
    };
    saveSettingsMutation.mutate({ providerSettings: nextProviderSettings });
  };

  return (
    <main style={styles.page}>
      <h1 style={styles.heading}>Model & Provider Settings</h1>
      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>Cloud Provider API Keys</h2>
        {(providersQuery.data ?? [])
          .filter((provider) => provider.type === "cloud")
          .map((provider) => (
            <div key={provider.id} style={styles.row}>
              <label style={styles.label}>{provider.name}</label>
              <input
                type="password"
                value={apiKeys[provider.id] ?? ""}
                onChange={(e) =>
                  setApiKeys((prev) => ({
                    ...prev,
                    [provider.id]: e.target.value,
                  }))
                }
                placeholder={`API key for ${provider.name}`}
                style={styles.input}
              />
            </div>
          ))}
        <div style={styles.row}>
          <label style={styles.label}>Azure Resource Name</label>
          <input
            value={azureResourceName}
            onChange={(e) => setAzureResourceName(e.target.value)}
            placeholder="my-azure-openai-resource"
            style={styles.input}
          />
        </div>
        <div style={styles.row}>
          <label style={styles.label}>Vertex Project ID</label>
          <input
            value={vertexProjectId}
            onChange={(e) => setVertexProjectId(e.target.value)}
            placeholder="gcp-project-id"
            style={styles.input}
          />
        </div>
        <div style={styles.row}>
          <label style={styles.label}>Vertex Location</label>
          <input
            value={vertexLocation}
            onChange={(e) => setVertexLocation(e.target.value)}
            placeholder="us-central1"
            style={styles.input}
          />
        </div>
        <div style={styles.row}>
          <label style={styles.label}>Vertex Service Account JSON</label>
          <textarea
            value={vertexServiceAccount}
            onChange={(e) => setVertexServiceAccount(e.target.value)}
            placeholder="Paste service account JSON"
            style={styles.textarea}
          />
        </div>
        <button
          type="button"
          style={styles.button}
          onClick={saveAllProviderSettings}
          disabled={saveSettingsMutation.isPending}
        >
          {saveSettingsMutation.isPending ? "Saving..." : "Save Provider Settings"}
        </button>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>Custom Provider CRUD</h2>
        <div style={styles.row}>
          <label style={styles.label}>Provider Name</label>
          <input
            value={customProviderName}
            onChange={(e) => setCustomProviderName(e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={styles.row}>
          <label style={styles.label}>Provider ID</label>
          <input
            value={customProviderId}
            onChange={(e) => setCustomProviderId(e.target.value)}
            placeholder="custom-provider-id"
            style={styles.input}
          />
        </div>
        <div style={styles.row}>
          <label style={styles.label}>API Base URL</label>
          <input
            value={customProviderBaseUrl}
            onChange={(e) => setCustomProviderBaseUrl(e.target.value)}
            placeholder="https://api.provider.com/v1"
            style={styles.input}
          />
        </div>
        <button
          type="button"
          style={styles.button}
          onClick={() =>
            createCustomProviderMutation.mutate({
              id: customProviderId,
              name: customProviderName,
              apiBaseUrl: customProviderBaseUrl,
            })
          }
          disabled={
            createCustomProviderMutation.isPending ||
            !customProviderId ||
            !customProviderName ||
            !customProviderBaseUrl
          }
        >
          Create Custom Provider
        </button>
        <div style={styles.list}>
          {(providersQuery.data ?? [])
            .filter((provider) => provider.type === "custom")
            .map((provider) => (
              <div key={provider.id} style={styles.listItem}>
                <span>
                  {provider.name} ({provider.id})
                </span>
                <button
                  type="button"
                  style={styles.dangerButton}
                  onClick={() =>
                    deleteCustomLanguageModelProvider(provider.id).then(() =>
                      queryClient.invalidateQueries({
                        queryKey: queryKeys.settings.providers,
                      }),
                    )
                  }
                >
                  Delete
                </button>
              </div>
            ))}
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionHeading}>Custom Model CRUD</h2>
        <div style={styles.row}>
          <label style={styles.label}>Display Name</label>
          <input
            value={customModelName}
            onChange={(e) => setCustomModelName(e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={styles.row}>
          <label style={styles.label}>API Name</label>
          <input
            value={customModelApiName}
            onChange={(e) => setCustomModelApiName(e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={styles.row}>
          <label style={styles.label}>Provider</label>
          <select
            value={customModelProviderId}
            onChange={(e) => setCustomModelProviderId(e.target.value)}
            style={styles.input}
          >
            <option value="">Select provider</option>
            {(providersQuery.data ?? []).map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          style={styles.button}
          onClick={() =>
            createCustomModelMutation.mutate({
              apiName: customModelApiName,
              displayName: customModelName,
              providerId: customModelProviderId,
            })
          }
          disabled={
            createCustomModelMutation.isPending ||
            !customModelApiName ||
            !customModelName ||
            !customModelProviderId
          }
        >
          Create Custom Model
        </button>
        <div style={styles.list}>
          {Object.entries(modelsQuery.data ?? {})
            .flatMap(([providerId, models]) =>
              models
                .filter((m) => m.id != null)
                .map((model) => ({ providerId, model })),
            )
            .map(({ providerId, model }) => (
              <div key={`${providerId}-${model.apiName}`} style={styles.listItem}>
                <span>
                  {model.displayName} ({providerId}/{model.apiName})
                </span>
                {model.id != null && (
                  <button
                    type="button"
                    style={styles.dangerButton}
                    onClick={() =>
                      deleteCustomLanguageModel(String(model.id)).then(() =>
                        queryClient.invalidateQueries({
                          queryKey: queryKeys.settings.modelsByProvider,
                        }),
                      )
                    }
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
    padding: "1rem",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  },
  heading: { margin: "0 0 1rem", fontSize: 22, fontWeight: 700 },
  section: {
    border: "1px solid #30363d",
    borderRadius: 10,
    padding: "1rem",
    marginBottom: "1rem",
    backgroundColor: "#161b22",
  },
  sectionHeading: { margin: "0 0 0.75rem", fontSize: 16 },
  row: {
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: "0.75rem",
    alignItems: "center",
    marginBottom: "0.6rem",
  },
  label: { fontSize: 13, color: "#8b949e" },
  input: {
    padding: "0.55rem 0.7rem",
    borderRadius: 8,
    border: "1px solid #30363d",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
    fontSize: 13,
  },
  textarea: {
    minHeight: 90,
    padding: "0.55rem 0.7rem",
    borderRadius: 8,
    border: "1px solid #30363d",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
    fontSize: 13,
  },
  button: {
    marginTop: "0.4rem",
    padding: "0.5rem 0.9rem",
    borderRadius: 8,
    border: "1px solid #30363d",
    backgroundColor: "#1f6feb",
    color: "#fff",
    fontSize: 13,
    cursor: "pointer",
  },
  dangerButton: {
    padding: "0.3rem 0.6rem",
    borderRadius: 6,
    border: "1px solid #30363d",
    backgroundColor: "#2d1218",
    color: "#f85149",
    cursor: "pointer",
    fontSize: 12,
  },
  list: {
    marginTop: "0.8rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  listItem: {
    border: "1px solid #30363d",
    borderRadius: 8,
    backgroundColor: "#0d1117",
    padding: "0.45rem 0.6rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
  },
};
