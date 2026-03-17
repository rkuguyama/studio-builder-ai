import * as React from "react";
import { useChat } from "../hooks/useChat";

interface ChatPanelProps {
  chatId: number | null;
}

export function ChatPanel({ chatId }: ChatPanelProps) {
  const { messages, isStreaming, error, sendMessage, isLoading } =
    useChat(chatId);
  const [input, setInput] = React.useState("");
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    sendMessage(trimmed);
  };

  if (!chatId) {
    return (
      <div style={styles.empty}>
        <p style={styles.emptyText}>No chat selected</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.messageList}>
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
            <div style={styles.content}>{msg.content}</div>
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

        {error && <div style={styles.error}>Error: {error}</div>}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} style={styles.inputArea}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe what you want to build..."
          disabled={isStreaming}
          style={styles.input}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          style={styles.sendButton}
        >
          {isStreaming ? "..." : "Send"}
        </button>
      </form>
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
  empty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    backgroundColor: "#0d1117",
    color: "#e6edf3",
  },
  emptyText: {
    opacity: 0.5,
  },
  inputArea: {
    display: "flex",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    borderTop: "1px solid #30363d",
    backgroundColor: "#161b22",
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
