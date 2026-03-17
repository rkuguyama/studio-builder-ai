import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  githubConnectExistingRepo,
  githubListRepos,
  githubPush,
  mcpCreateServer,
  mcpListServers,
  neonGetProject,
  supabaseListProjects,
  supabaseSetAppProject,
} from "../api";

interface IntegrationsPanelProps {
  appId: number;
}

export function IntegrationsPanel({ appId }: IntegrationsPanelProps) {
  const queryClient = useQueryClient();
  const [selectedRepoFullName, setSelectedRepoFullName] = React.useState("");
  const [selectedBranch, setSelectedBranch] = React.useState("main");
  const [selectedSupabaseProject, setSelectedSupabaseProject] =
    React.useState("");
  const [mcpName, setMcpName] = React.useState("");
  const [mcpCommand, setMcpCommand] = React.useState("");

  const githubReposQuery = useQuery({
    queryKey: ["github-repos"],
    queryFn: githubListRepos,
  });
  const supabaseProjectsQuery = useQuery({
    queryKey: ["supabase-projects"],
    queryFn: supabaseListProjects,
  });
  const neonProjectQuery = useQuery({
    queryKey: ["neon-project", appId],
    queryFn: () => neonGetProject(appId),
  });
  const mcpServersQuery = useQuery({
    queryKey: ["mcp-servers"],
    queryFn: mcpListServers,
  });

  const connectRepoMutation = useMutation({
    mutationFn: async () => {
      const [owner, repo] = selectedRepoFullName.split("/");
      if (!owner || !repo) return;
      await githubConnectExistingRepo({
        owner,
        repo,
        branch: selectedBranch,
        appId,
      });
    },
  });

  const pushMutation = useMutation({
    mutationFn: () => githubPush(appId),
  });

  const connectSupabaseMutation = useMutation({
    mutationFn: async () => {
      const project = (supabaseProjectsQuery.data ?? []).find(
        (entry) => entry.id === selectedSupabaseProject,
      );
      if (!project) return;
      await supabaseSetAppProject({
        appId,
        projectId: project.id,
        organizationSlug: project.organizationSlug,
      });
    },
  });

  const createMcpMutation = useMutation({
    mutationFn: async () =>
      mcpCreateServer({
        name: mcpName,
        transport: "stdio",
        command: mcpCommand,
        enabled: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-servers"] });
      setMcpName("");
      setMcpCommand("");
    },
  });

  return (
    <div style={styles.container}>
      <section style={styles.section}>
        <h4 style={styles.title}>GitHub</h4>
        <div style={styles.row}>
          <select
            value={selectedRepoFullName}
            onChange={(e) => setSelectedRepoFullName(e.target.value)}
            style={styles.input}
          >
            <option value="">Select repository</option>
            {(githubReposQuery.data ?? []).map((repo) => (
              <option key={repo.full_name} value={repo.full_name}>
                {repo.full_name}
              </option>
            ))}
          </select>
          <input
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={styles.input}
            placeholder="branch"
          />
          <button style={styles.button} onClick={() => connectRepoMutation.mutate()}>
            Connect Repo
          </button>
          <button style={styles.button} onClick={() => pushMutation.mutate()}>
            Push
          </button>
        </div>
      </section>

      <section style={styles.section}>
        <h4 style={styles.title}>Supabase</h4>
        <div style={styles.row}>
          <select
            value={selectedSupabaseProject}
            onChange={(e) => setSelectedSupabaseProject(e.target.value)}
            style={styles.input}
          >
            <option value="">Select project</option>
            {(supabaseProjectsQuery.data ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({project.organizationSlug})
              </option>
            ))}
          </select>
          <button
            style={styles.button}
            onClick={() => connectSupabaseMutation.mutate()}
          >
            Connect Project
          </button>
        </div>
      </section>

      <section style={styles.section}>
        <h4 style={styles.title}>Neon</h4>
        <pre style={styles.pre}>
          {JSON.stringify(neonProjectQuery.data ?? {}, null, 2)}
        </pre>
      </section>

      <section style={styles.section}>
        <h4 style={styles.title}>MCP</h4>
        <div style={styles.row}>
          <input
            value={mcpName}
            onChange={(e) => setMcpName(e.target.value)}
            style={styles.input}
            placeholder="Server name"
          />
          <input
            value={mcpCommand}
            onChange={(e) => setMcpCommand(e.target.value)}
            style={styles.input}
            placeholder="Command (stdio)"
          />
          <button style={styles.button} onClick={() => createMcpMutation.mutate()}>
            Add MCP Server
          </button>
        </div>
        <pre style={styles.pre}>
          {JSON.stringify(mcpServersQuery.data ?? [], null, 2)}
        </pre>
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: "flex", flexDirection: "column", gap: "0.7rem", padding: "0.7rem" },
  section: {
    border: "1px solid #30363d",
    borderRadius: 8,
    backgroundColor: "#161b22",
    padding: "0.6rem",
  },
  title: { margin: "0 0 0.4rem", color: "#e6edf3" },
  row: { display: "flex", gap: "0.4rem", flexWrap: "wrap" },
  input: {
    minWidth: 220,
    padding: "0.35rem 0.5rem",
    borderRadius: 6,
    border: "1px solid #30363d",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
  },
  button: {
    padding: "0.35rem 0.7rem",
    borderRadius: 6,
    border: "1px solid #30363d",
    backgroundColor: "#21262d",
    color: "#e6edf3",
    cursor: "pointer",
  },
  pre: {
    margin: 0,
    color: "#8b949e",
    fontSize: 12,
    fontFamily: "monospace",
    whiteSpace: "pre-wrap",
  },
};
