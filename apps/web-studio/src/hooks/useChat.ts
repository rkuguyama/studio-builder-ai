import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelChatStream,
  getChat,
  sendChatMessage,
  type ChatAttachmentPayload,
  type ChatMessage,
} from "../api";
import { queryKeys } from "../lib/queryKeys";
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
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [queuedPrompts, setQueuedPrompts] = useState<string[]>([]);
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;
  const sendingRef = useRef(false);

  const chatQuery = useQuery({
    queryKey: queryKeys.chat.detail(chatId),
    queryFn: () => {
      if (chatId === null) throw new Error("chatId is null");
      return getChat(chatId);
    },
    enabled: chatId !== null && chatId > 0,
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
    queryClient.invalidateQueries({
      queryKey: queryKeys.chat.detail(chatIdRef.current),
    });
  });

  useEventListener("chat:response:error", (payload) => {
    const data = payload as ChatErrorPayload;
    if (data.chatId !== chatIdRef.current) return;
    setIsStreaming(false);
    setError(data.error);
  });

  const sendMessage = useCallback(
    async (prompt: string, attachments?: ChatAttachmentPayload[]) => {
      if (!chatId) return;
      setError(null);
      setLastPrompt(prompt);

      // Optimistically add user message
      const userMsg: ChatMessage = {
        id: Date.now(),
        role: "user",
        content: prompt,
      };
      setLocalMessages((prev) => [...prev, userMsg]);

      try {
        if (isStreaming) {
          setQueuedPrompts((prev) => [...prev, prompt]);
          return;
        }
        await sendChatMessage(chatId, prompt, { attachments });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [chatId, isStreaming],
  );

  const retryLastMessage = useCallback(async () => {
    if (!chatId || !lastPrompt) return;
    try {
      await sendChatMessage(chatId, lastPrompt, { redo: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [chatId, lastPrompt]);

  const cancelStream = useCallback(async () => {
    if (!chatId) return;
    try {
      await cancelChatStream(chatId);
      setIsStreaming(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [chatId]);

  useEffect(() => {
    if (isStreaming || sendingRef.current || queuedPrompts.length === 0 || !chatId) return;
    const [nextPrompt, ...rest] = queuedPrompts;
    setQueuedPrompts(rest);
    sendingRef.current = true;
    void sendChatMessage(chatId, nextPrompt)
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => {
        sendingRef.current = false;
      });
  }, [chatId, isStreaming, queuedPrompts]);

  // Merge streaming content into displayed messages
  const displayMessages = localMessages.map((msg) =>
    msg.id === streamingMessageId ? { ...msg, content: streamingContent } : msg,
  );

  return {
    messages: displayMessages,
    isStreaming,
    error,
    sendMessage,
    cancelStream,
    retryLastMessage,
    queuedPrompts,
    isLoading: chatQuery.isLoading,
  };
}
