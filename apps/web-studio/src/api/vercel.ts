import { invokeChannel } from "./bridge";

export interface VercelProject {
  id: string;
  name: string;
}

export interface VercelDeployment {
  uid: string;
  url: string;
  state: string;
  readyState: string;
  createdAt: number;
  target: string;
}

export async function listVercelProjects(): Promise<VercelProject[]> {
  return invokeChannel<VercelProject[]>("vercel:list-projects");
}

export async function getVercelDeployments(
  appId: number,
): Promise<VercelDeployment[]> {
  return invokeChannel<VercelDeployment[]>("vercel:get-deployments", { appId });
}

export async function saveVercelToken(token: string): Promise<void> {
  await invokeChannel<void>("vercel:save-token", { token });
}

export async function connectExistingVercelProject(
  appId: number,
  projectId: string,
): Promise<void> {
  await invokeChannel<void>("vercel:connect-existing-project", {
    appId,
    projectId,
  });
}
