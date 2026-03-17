import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  approveProposal,
  createChat,
  deleteChat,
  getLanguageModelProviders,
  getLanguageModelsByProviders,
  getProposal,
  getChats,
  getUserSettings,
  rejectProposal,
  setUserSettings,
  type ChatAttachmentPayload,
} from "../api";
import { queryKeys } from "../lib/queryKeys";
import { useChat } from "../hooks/useChat";

interface ChatPanelProps {
  appId: number | null;
  chatId: number | null;
  onSubmitWithoutChat?: (prompt: string) => Promise<void>;
  onChatChange?: (chatId: number) => void;
}

export function ChatPanel({
  appId,
  chatId,
  onSubmitWithoutChat,
  onChatChange,
}: ChatPanelProps) {
  const queryClient = useQueryClient();
  const {
    messages,
    isStreaming,
    error,
    sendMessage,
    cancelStream,
    retryLastMessage,
    queuedPrompts,
    isLoading,
  } =
    useChat(chatId);
  const [input, setInput] = React.useState("");
  const [isBootstrapping, setIsBootstrapping] = React.useState(false);
  const [bootstrapError, setBootstrapError] = React.useState<string | null>(null);
  const [showModelSettings, setShowModelSettings] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const [editingProviderId, setEditingProviderId] = React.useState<string | null>(
    null,
  );
  const [apiKeyDraft, setApiKeyDraft] = React.useState("");
  const [attachments, setAttachments] = React.useState<ChatAttachmentPayload[]>(
    [],
  );
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings.user,
    queryFn: getUserSettings,
  });

  const providersQuery = useQuery({
    queryKey: queryKeys.settings.providers,
    queryFn: getLanguageModelProviders,
  });

  const modelsByProviderQuery = useQuery({
    queryKey: queryKeys.settings.modelsByProvider,
    queryFn: getLanguageModelsByProviders,
  });

  const chatsQuery = useQuery({
    queryKey: queryKeys.chat.list(appId ?? undefined),
    queryFn: () => getChats(appId ?? undefined),
    enabled: appId !== null,
  });

  const proposalQuery = useQuery({
    queryKey: chatId !== null ? queryKeys.chat.proposal(chatId) : ["chat-proposal-disabled"],
    queryFn: () => {
      if (chatId === null) throw new Error("chatId is null");
      return getProposal(chatId);
    },
    enabled: chatId !== null && chatId > 0,
    refetchInterval: chatId !== null ? 2500 : false,
  });

  const selectedProviderId = settingsQuery.data?.selectedModel.provider;
  const selectedModelName = settingsQuery.data?.selectedModel.name;

  const providerModels = React.useMemo(() => {
    if (!selectedProviderId) return [];
    return modelsByProviderQuery.data?.[selectedProviderId] ?? [];
  }, [modelsByProviderQuery.data, selectedProviderId]);

  const saveSettingsMutation = useMutation({
    mutationFn: setUserSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.user });
      queryClient.invalidateQueries({
        queryKey: queryKeys.settings.modelsByProvider,
      });
    },
  });

  const createChatMutation = useMutation({
    mutationFn: async () => {
      if (appId === null) {
        throw new Error("Cannot create chat without app");
      }
      return createChat(appId);
    },
    onSuccess: (newChatId) => {
      onChatChange?.(newChatId);
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.list(appId ?? undefined),
      });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: deleteChat,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.chat.list(appId ?? undefined),
      });
    },
  });

  const approveProposalMutation = useMutation({
    mutationFn: async () => {
      const proposal = proposalQuery.data;
      if (!proposal) throw new Error("No proposal available");
      return approveProposal(proposal.chatId, proposal.messageId);
    },
    onSuccess: () => {
      if (chatId !== null) {
        queryClient.invalidateQueries({ queryKey: queryKeys.chat.detail(chatId) });
        queryClient.invalidateQueries({
          queryKey: queryKeys.chat.proposal(chatId),
        });
      }
    },
  });

  const rejectProposalMutation = useMutation({
    mutationFn: async () => {
      const proposal = proposalQuery.data;
      if (!proposal) throw new Error("No proposal available");
      return rejectProposal(proposal.chatId, proposal.messageId);
    },
    onSuccess: () => {
      if (chatId !== null) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.chat.proposal(chatId),
        });
      }
    },
  });

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming || isBootstrapping) return;
    setInput("");
    if (chatId) {
      sendMessage(trimmed, attachments);
      setAttachments([]);
      return;
    }
    if (!onSubmitWithoutChat) return;
    setBootstrapError(null);
    setIsBootstrapping(true);
    void onSubmitWithoutChat(trimmed)
      .catch((err) =>
        setBootstrapError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => {
        setIsBootstrapping(false);
        setAttachments([]);
      });
  };

  const handleProviderChange = (providerId: string) => {
    const models = modelsByProviderQuery.data?.[providerId] ?? [];
    const fallbackModel = models[0]?.apiName ?? "auto";
    saveSettingsMutation.mutate({
      selectedModel: {
        provider: providerId,
        name: fallbackModel,
      },
      providerSettings: settingsQuery.data?.providerSettings ?? {},
    });
  };

  const handleModelChange = (modelName: string) => {
    if (!selectedProviderId) return;
    saveSettingsMutation.mutate({
      selectedModel: {
        provider: selectedProviderId,
        name: modelName,
      },
      providerSettings: settingsQuery.data?.providerSettings ?? {},
    });
  };

  const handleSaveApiKey = () => {
    if (!editingProviderId) return;
    const nextProviderSettings = {
      ...(settingsQuery.data?.providerSettings ?? {}),
      [editingProviderId]: {
        ...(settingsQuery.data?.providerSettings?.[editingProviderId] ?? {}),
        apiKey: { value: apiKeyDraft.trim() },
      },
    };
    saveSettingsMutation.mutate(
      {
        providerSettings: nextProviderSettings,
      },
      {
        onSuccess: () => {
          setApiKeyDraft("");
          setEditingProviderId(null);
        },
      },
    );
  };

  const handlePickAttachments = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const converted = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        type: file.type || "application/octet-stream",
        data: await fileToBase64(file),
        attachmentType: "chat-context" as const,
      })),
    );
    setAttachments((prev) => [...prev, ...converted]);
    event.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div style={styles.container}>
      <div style={styles.chatHeader}>
        <div style={styles.chatHeaderTitle}>Chat</div>
        <div style={styles.chatHeaderActions}>
          {appId !== null && (
            <button
              type="button"
              style={styles.inlineButton}
              onClick={() => createChatMutation.mutate()}
              disabled={createChatMutation.isPending}
            >
              New Chat
            </button>
          )}
          <button
            type="button"
            style={styles.inlineButton}
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? "Hide History" : "History"}
          </button>
        </div>
      </div>
      {showHistory && (
        <div style={styles.historyPanel}>
          {(chatsQuery.data ?? []).map((chat) => (
            <div key={chat.id} style={styles.historyRow}>
              <button
                type="button"
                style={{
                  ...styles.historyItem,
                  ...(chat.id === chatId ? styles.historyItemActive : {}),
                }}
                onClick={() => onChatChange?.(chat.id)}
              >
                {chat.title ?? `Chat #${chat.id}`}
              </button>
              <button
                type="button"
                style={styles.historyDelete}
                onClick={() => deleteChatMutation.mutate(chat.id)}
              >
                Delete
              </button>
            </div>
          ))}
          {chatsQuery.data?.length === 0 && (
            <div style={styles.status}>No chats yet.</div>
          )}
        </div>
      )}
      <div style={styles.messageList}>
        {!chatId && (
          <div style={styles.welcomeCard}>
            <div style={styles.welcomeTitle}>Start by prompting</div>
            <div style={styles.welcomeBody}>
              Describe what you want to build. A new app is created from your
              prompt automatically.
            </div>
          </div>
        )}
        {isLoading && <p style={styles.status}>Loading messages...</p>}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.messageBubble,
              ...(msg.role === "user"
                ? styles.userBubble
                : styles.assistantBubble),
            }}
          >
            <div style={styles.role}>
              {msg.role === "user" ? "You" : "Assistant"}
            </div>
            <div style={styles.content}>
              {msg.role === "assistant" ? (
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div style={{ ...styles.messageBubble, ...styles.assistantBubble }}>
            <div style={styles.role}>Assistant</div>
            <div style={styles.content}>
              <span style={styles.cursor}>|</span>
            </div>
          </div>
        )}

        {bootstrapError && <div style={styles.error}>Error: {bootstrapError}</div>}
        {error && <div style={styles.error}>Error: {error}</div>}

        <div ref={messagesEndRef} />
      </div>

      <div style={styles.modelBar}>
        <div style={styles.modelSelectGroup}>
          <select
            value={selectedProviderId ?? ""}
            onChange={(e) => handleProviderChange(e.target.value)}
            style={styles.select}
            disabled={saveSettingsMutation.isPending || providersQuery.isLoading}
          >
            {(providersQuery.data ?? []).map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <select
            value={selectedModelName ?? ""}
            onChange={(e) => handleModelChange(e.target.value)}
            style={styles.select}
            disabled={saveSettingsMutation.isPending || providerModels.length === 0}
          >
            {providerModels.map((model) => (
              <option key={model.apiName} value={model.apiName}>
                {model.displayName}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          style={styles.settingsButton}
          onClick={() => setShowModelSettings((v) => !v)}
        >
          Model Settings
        </button>
      </div>

      {showModelSettings && (
        <div style={styles.settingsPanel}>
          <div style={styles.settingsTitle}>LLM API Keys</div>
          <div style={styles.settingsRows}>
            {(providersQuery.data ?? [])
              .filter((provider) => provider.type === "cloud")
              .map((provider) => (
                <div key={provider.id} style={styles.settingsRow}>
                  <div style={styles.providerLabel}>{provider.name}</div>
                  <button
                    type="button"
                    style={styles.inlineButton}
                    onClick={() => {
                      setEditingProviderId(provider.id);
                      setApiKeyDraft(
                        settingsQuery.data?.providerSettings?.[provider.id]
                          ?.apiKey?.value ?? "",
                      );
                    }}
                  >
                    {settingsQuery.data?.providerSettings?.[provider.id]?.apiKey
                      ?.value
                      ? "Update key"
                      : "Set key"}
                  </button>
                </div>
              ))}
          </div>
          {editingProviderId && (
            <div style={styles.keyEditor}>
              <input
                type="password"
                placeholder={`API key for ${editingProviderId}`}
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
                style={styles.input}
              />
              <button
                type="button"
                style={styles.inlineButton}
                onClick={handleSaveApiKey}
                disabled={!apiKeyDraft.trim() || saveSettingsMutation.isPending}
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}

      {proposalQuery.data?.proposal && (
        <div style={styles.proposalPanel}>
          <div style={styles.settingsTitle}>Pending Proposal</div>
          <div style={styles.proposalBody}>
            {proposalQuery.data.proposal.type === "code-proposal" ? (
              <>
                <div style={styles.proposalTitle}>
                  {proposalQuery.data.proposal.title}
                </div>
                <div style={styles.proposalMeta}>
                  {proposalQuery.data.proposal.filesChanged.length} file changes
                </div>
              </>
            ) : proposalQuery.data.proposal.type === "tip-proposal" ? (
              <>
                <div style={styles.proposalTitle}>
                  {proposalQuery.data.proposal.title}
                </div>
                <div style={styles.proposalMeta}>
                  {proposalQuery.data.proposal.description}
                </div>
              </>
            ) : (
              <div style={styles.proposalMeta}>
                {proposalQuery.data.proposal.actions.length} suggested actions
              </div>
            )}
          </div>
          <div style={styles.proposalActions}>
            <button
              type="button"
              style={styles.inlineButton}
              onClick={() => approveProposalMutation.mutate()}
              disabled={approveProposalMutation.isPending}
            >
              Approve
            </button>
            <button
              type="button"
              style={styles.inlineButton}
              onClick={() => rejectProposalMutation.mutate()}
              disabled={rejectProposalMutation.isPending}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} style={styles.inputArea}>
        <label style={styles.attachButton}>
          Attach
          <input
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={handlePickAttachments}
          />
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe what you want to build..."
          disabled={isStreaming || isBootstrapping}
          style={styles.input}
        />
        <button
          type="submit"
          disabled={isStreaming || isBootstrapping || !input.trim()}
          style={styles.sendButton}
        >
          {isBootstrapping ? "Starting..." : isStreaming ? "..." : "Send"}
        </button>
        {isStreaming && (
          <button
            type="button"
            onClick={() => cancelStream()}
            style={styles.secondaryButton}
          >
            Cancel
          </button>
        )}
        {!isStreaming && (
          <button
            type="button"
            onClick={() => retryLastMessage()}
            style={styles.secondaryButton}
          >
            Retry
          </button>
        )}
      </form>
      {attachments.length > 0 && (
        <div style={styles.attachmentsRow}>
          {attachments.map((file, index) => (
            <button
              key={`${file.name}-${index}`}
              type="button"
              style={styles.attachmentChip}
              onClick={() => removeAttachment(index)}
            >
              {file.name} ×
            </button>
          ))}
        </div>
      )}
      {queuedPrompts.length > 0 && (
        <div style={styles.queuedInfo}>
          {queuedPrompts.length} queued prompt
          {queuedPrompts.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
  },
  chatHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0.5rem 1rem",
    borderBottom: "1px solid #30363d",
    backgroundColor: "#161b22",
  },
  chatHeaderTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#e6edf3",
    textTransform: "uppercase",
  },
  chatHeaderActions: {
    display: "flex",
    gap: "0.4rem",
  },
  historyPanel: {
    borderBottom: "1px solid #30363d",
    backgroundColor: "#0f141b",
    padding: "0.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.3rem",
    maxHeight: 180,
    overflow: "auto",
  },
  historyRow: {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  },
  historyItem: {
    flex: 1,
    textAlign: "left",
    backgroundColor: "#161b22",
    border: "1px solid #30363d",
    color: "#e6edf3",
    borderRadius: 6,
    padding: "0.3rem 0.5rem",
    fontSize: 12,
    cursor: "pointer",
  },
  historyItemActive: {
    borderColor: "#1f6feb",
    backgroundColor: "#0f2547",
  },
  historyDelete: {
    padding: "0.25rem 0.5rem",
    borderRadius: 6,
    border: "1px solid #30363d",
    backgroundColor: "#2d1218",
    color: "#f85149",
    fontSize: 11,
    cursor: "pointer",
  },
  messageList: {
    flex: 1,
    overflowY: "auto",
    padding: "1rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  messageBubble: {
    padding: "0.75rem 1rem",
    borderRadius: 12,
    maxWidth: "85%",
    wordBreak: "break-word" as const,
    whiteSpace: "pre-wrap" as const,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#1f6feb",
    color: "#fff",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#161b22",
    border: "1px solid #30363d",
  },
  role: {
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 4,
    opacity: 0.7,
    textTransform: "uppercase" as const,
  },
  content: {
    fontSize: 14,
    lineHeight: 1.5,
  },
  cursor: {
    animation: "blink 1s step-end infinite",
    opacity: 0.6,
  },
  error: {
    padding: "0.5rem 1rem",
    backgroundColor: "#3d1116",
    border: "1px solid #f85149",
    borderRadius: 8,
    color: "#f85149",
    fontSize: 13,
  },
  status: {
    textAlign: "center" as const,
    opacity: 0.5,
    fontSize: 13,
  },
  welcomeCard: {
    border: "1px solid #30363d",
    borderRadius: 12,
    backgroundColor: "#161b22",
    padding: "0.875rem",
  },
  welcomeTitle: {
    fontWeight: 700,
    fontSize: 14,
    color: "#58a6ff",
    marginBottom: 4,
  },
  welcomeBody: {
    fontSize: 13,
    color: "#8b949e",
    lineHeight: 1.4,
  },
  inputArea: {
    display: "flex",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    borderTop: "1px solid #30363d",
    backgroundColor: "#161b22",
  },
  modelBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.625rem 1rem",
    borderTop: "1px solid #30363d",
    borderBottom: "1px solid #30363d",
    backgroundColor: "#0f141b",
  },
  modelSelectGroup: {
    display: "flex",
    gap: "0.5rem",
    flex: 1,
  },
  select: {
    padding: "0.4rem 0.5rem",
    borderRadius: 6,
    border: "1px solid #30363d",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
    fontSize: 12,
    minWidth: 150,
  },
  settingsButton: {
    padding: "0.35rem 0.75rem",
    borderRadius: 6,
    border: "1px solid #30363d",
    backgroundColor: "#21262d",
    color: "#e6edf3",
    fontSize: 12,
    cursor: "pointer",
  },
  settingsPanel: {
    borderBottom: "1px solid #30363d",
    backgroundColor: "#0f141b",
    padding: "0.75rem 1rem",
  },
  settingsTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#8b949e",
    marginBottom: "0.5rem",
    textTransform: "uppercase",
  },
  settingsRows: {
    display: "flex",
    flexDirection: "column",
    gap: "0.35rem",
  },
  settingsRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: 12,
    color: "#e6edf3",
  },
  providerLabel: {
    opacity: 0.9,
  },
  inlineButton: {
    padding: "0.25rem 0.6rem",
    borderRadius: 6,
    border: "1px solid #30363d",
    backgroundColor: "#21262d",
    color: "#e6edf3",
    fontSize: 12,
    cursor: "pointer",
  },
  attachButton: {
    padding: "0.4rem 0.6rem",
    borderRadius: 8,
    border: "1px solid #30363d",
    backgroundColor: "#21262d",
    color: "#e6edf3",
    fontSize: 12,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
  },
  secondaryButton: {
    padding: "0.625rem 0.8rem",
    borderRadius: 8,
    border: "1px solid #30363d",
    backgroundColor: "#21262d",
    color: "#e6edf3",
    fontSize: 13,
    cursor: "pointer",
  },
  attachmentsRow: {
    display: "flex",
    gap: "0.4rem",
    flexWrap: "wrap",
    padding: "0.4rem 1rem 0.7rem",
    borderTop: "1px solid #30363d",
    backgroundColor: "#10161f",
  },
  attachmentChip: {
    borderRadius: 999,
    border: "1px solid #30363d",
    backgroundColor: "#21262d",
    color: "#e6edf3",
    fontSize: 11,
    padding: "0.2rem 0.6rem",
    cursor: "pointer",
  },
  queuedInfo: {
    padding: "0.3rem 1rem 0.6rem",
    fontSize: 11,
    color: "#8b949e",
    borderTop: "1px solid #30363d",
    backgroundColor: "#0f141b",
  },
  proposalPanel: {
    borderTop: "1px solid #30363d",
    borderBottom: "1px solid #30363d",
    backgroundColor: "#0f141b",
    padding: "0.6rem 1rem",
  },
  proposalBody: {
    marginBottom: "0.5rem",
  },
  proposalTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#e6edf3",
  },
  proposalMeta: {
    fontSize: 12,
    color: "#8b949e",
    marginTop: 2,
  },
  proposalActions: {
    display: "flex",
    gap: "0.4rem",
  },
  keyEditor: {
    marginTop: "0.6rem",
    display: "flex",
    gap: "0.4rem",
  },
  input: {
    flex: 1,
    padding: "0.625rem 0.875rem",
    borderRadius: 8,
    border: "1px solid #30363d",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
    fontSize: 14,
    outline: "none",
  },
  sendButton: {
    padding: "0.625rem 1.25rem",
    borderRadius: 8,
    border: "none",
    backgroundColor: "#238636",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
};

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
