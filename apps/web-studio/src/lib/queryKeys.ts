export const queryKeys = {
  bridgeHealth: ["bridge-health"] as const,
  apps: {
    all: ["apps"] as const,
    detail: (appId: number) => ["app", appId] as const,
    previewUrl: (appId: number) => ["preview-url", appId] as const,
    filesSearch: (appId: number, query: string) =>
      ["app-files-search", appId, query] as const,
  },
  chat: {
    detail: (chatId: number | null) => ["chat", chatId] as const,
    list: (appId?: number) => ["chats", appId ?? "all"] as const,
    proposal: (chatId: number) => ["chat-proposal", chatId] as const,
  },
  settings: {
    user: ["user-settings"] as const,
    providers: ["language-model-providers"] as const,
    modelsByProvider: ["language-models-by-provider"] as const,
  },
  security: {
    latestReview: (appId: number) => ["security-review", appId] as const,
  },
  plan: {
    byChat: (appId: number, chatId: number) =>
      ["plan-by-chat", appId, chatId] as const,
  },
  vercel: {
    projects: ["vercel-projects"] as const,
    deployments: (appId: number) => ["vercel-deployments", appId] as const,
  },
} as const;
