import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getChat, sendChatMessage, type ChatMessage } from "../api";
import { useEventListener } from "./useEventStream";

interface ChatChunkPayload {
  chatId: number;
  messages?: ChatMessage[];
  streamingMessageId?: number;
  streamingContent?: string;
}

interface ChatEndPayload {
  chatId: number;
  updatedFiles: boolean;
}

interface ChatErrorPayload {
  chatId: number;
  error: string;
}

export function useChat(chatId: number | null) {
  const queryClient = useQueryClient();
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [streamingMessageId, setStreamingMessageId] = useState<number | null>(
    null,
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;

  const chatQuery = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () => getChat(chatId!),
    enabled: chatId !== null,
  });

  // Track messages locally so streaming updates appear immediately
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (chatQuery.data?.messages) {
      setLocalMessages(chatQuery.data.messages);
    }
  }, [chatQuery.data?.messages]);

  useEventListener("chat:stream:start", (payload) => {
    const data = payload as { chatId: number };
    if (data.chatId !== chatIdRef.current) return;
    setIsStreaming(true);
    setError(null);
  });

  useEventListener("chat:response:chunk", (payload) => {
    const data = payload as ChatChunkPayload;
    if (data.chatId !== chatIdRef.current) return;

    if (data.messages) {
      setLocalMessages(data.messages);
      setStreamingMessageId(null);
      setStreamingContent("");
    } else if (
      data.streamingMessageId != null &&
      data.streamingContent != null
    ) {
      setStreamingMessageId(data.streamingMessageId);
      setStreamingContent(data.streamingContent);
    }
  });

  useEventListener("chat:response:end", (payload) => {
    const data = payload as ChatEndPayload;
    if (data.chatId !== chatIdRef.current) return;
    setIsStreaming(false);
    setStreamingMessageId(null);
    setStreamingContent("");
    queryClient.invalidateQueries({ queryKey: ["chat", chatIdRef.current] });
  });

  useEventListener("chat:response:error", (payload) => {
    const data = payload as ChatErrorPayload;
    if (data.chatId !== chatIdRef.current) return;
    setIsStreaming(false);
    setError(data.error);
  });

  const sendMessage = useCallback(
    async (prompt: string) => {
      if (!chatId) return;
      setError(null);

      // Optimistically add user message
      const userMsg: ChatMessage = {
        id: Date.now(),
        role: "user",
        content: prompt,
      };
      setLocalMessages((prev) => [...prev, userMsg]);

      try {
        await sendChatMessage(chatId, prompt);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [chatId],
  );

  // Merge streaming content into displayed messages
  const displayMessages = localMessages.map((msg) =>
    msg.id === streamingMessageId ? { ...msg, content: streamingContent } : msg,
  );

  return {
    messages: displayMessages,
    isStreaming,
    error,
    sendMessage,
    isLoading: chatQuery.isLoading,
  };
}
