import { invokeChannel } from "./bridge";

export interface GitHubRepo {
  name: string;
  full_name: string;
  private: boolean;
}

export interface SupabaseProject {
  id: string;
  name: string;
  region: string;
  organizationSlug: string;
}

export interface NeonProject {
  projectId: string;
  projectName: string;
  orgId: string;
}

export interface McpServer {
  id: number;
  name: string;
  transport: "stdio" | "sse" | "http";
  command: string | null;
  url: string | null;
  enabled: boolean;
}

export async function githubListRepos(): Promise<GitHubRepo[]> {
  return invokeChannel<GitHubRepo[]>("github:list-repos");
}

export async function githubConnectExistingRepo(input: {
  owner: string;
  repo: string;
  branch: string;
  appId: number;
}): Promise<void> {
  await invokeChannel<void>("github:connect-existing-repo", input);
}

export async function githubPush(appId: number): Promise<void> {
  await invokeChannel<void>("github:push", { appId });
}

export async function supabaseListProjects(): Promise<SupabaseProject[]> {
  return invokeChannel<SupabaseProject[]>("supabase:list-all-projects");
}

export async function supabaseSetAppProject(input: {
  appId: number;
  projectId: string;
  organizationSlug?: string;
}): Promise<void> {
  await invokeChannel<void>("supabase:set-app-project", input);
}

export async function neonGetProject(appId: number): Promise<NeonProject> {
  return invokeChannel<NeonProject>("neon:get-project", { appId });
}

export async function mcpListServers(): Promise<McpServer[]> {
  return invokeChannel<McpServer[]>("mcp:list-servers");
}

export async function mcpCreateServer(input: {
  name: string;
  transport: "stdio" | "sse" | "http";
  command?: string;
  url?: string;
  enabled?: boolean;
}): Promise<McpServer> {
  return invokeChannel<McpServer>("mcp:create-server", input);
}
