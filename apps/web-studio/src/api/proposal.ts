import { invokeChannel } from "./bridge";

export interface SecurityRisk {
  type: "warning" | "danger";
  title: string;
  description: string;
}

export interface FileChange {
  name: string;
  path: string;
  summary: string;
  type: "write" | "rename" | "delete";
  isServerFunction: boolean;
}

export interface CodeProposal {
  type: "code-proposal";
  title: string;
  securityRisks: SecurityRisk[];
  filesChanged: FileChange[];
  packagesAdded: string[];
}

export interface ActionProposal {
  type: "action-proposal";
  actions: Array<{ id: string; path?: string }>;
}

export interface TipProposal {
  type: "tip-proposal";
  title: string;
  description: string;
}

export type Proposal = CodeProposal | ActionProposal | TipProposal;

export interface ProposalResult {
  proposal: Proposal;
  chatId: number;
  messageId: number;
}

export async function getProposal(
  chatId: number,
): Promise<ProposalResult | null> {
  return invokeChannel<ProposalResult | null>("get-proposal", { chatId });
}

export async function approveProposal(
  chatId: number,
  messageId: number,
): Promise<{
  success: boolean;
  commitHash?: string;
  error?: string;
}> {
  return invokeChannel<{
    success: boolean;
    commitHash?: string;
    error?: string;
  }>("approve-proposal", { chatId, messageId });
}

export async function rejectProposal(
  chatId: number,
  messageId: number,
): Promise<void> {
  await invokeChannel<void>("reject-proposal", { chatId, messageId });
}
