import { invokeChannel } from "./bridge";

export interface SecurityFinding {
  title: string;
  level: "critical" | "high" | "medium" | "low";
  description: string;
}

export interface SecurityReviewResult {
  findings: SecurityFinding[];
  timestamp: string;
  chatId: number;
}

export async function getLatestSecurityReview(
  appId: number,
): Promise<SecurityReviewResult> {
  return invokeChannel<SecurityReviewResult>("get-latest-security-review", appId);
}
