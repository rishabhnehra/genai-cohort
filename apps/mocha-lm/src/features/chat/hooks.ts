"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/utils";
import {
  createConversation,
  deleteConversation,
  getMessages,
  listConversations,
  renameConversation,
} from "./actions";
import { normalizeCitedAnswer, type MessageCitation } from "./citations";

export type ConversationListItem = Awaited<ReturnType<typeof listConversations>>[number];
export type MessageListItem = Awaited<ReturnType<typeof getMessages>>[number];

export function useConversations(notebookId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.conversations.byNotebook(notebookId ?? ""),
    queryFn: () => listConversations(notebookId as string),
    enabled: Boolean(notebookId),
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.messages.byConversation(conversationId ?? ""),
    queryFn: () => getMessages(conversationId as string),
    enabled: Boolean(conversationId),
  });
}

export function useCreateConversation(notebookId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title?: string) => createConversation(notebookId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.byNotebook(notebookId) });
    },
    onError: (error) => {
      toast.error(error.message || "Unable to start a new chat");
    },
  });
}

export function useRenameConversation(notebookId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => renameConversation(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.byNotebook(notebookId) });
    },
    onError: (error) => {
      toast.error(error.message || "Unable to rename chat");
    },
  });
}

export function useDeleteConversation(notebookId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.byNotebook(notebookId) });
      toast.success("Chat deleted.");
    },
    onError: (error) => {
      toast.error(error.message || "Unable to delete chat");
    },
  });
}

export type ChatUiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "streaming" | "complete" | "failed";
  citations: MessageCitation[];
};

function decodeBase64Json<T>(value: string): T | undefined {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    return undefined;
  }
}

export type UseChatStreamOptions = {
  notebookId: string;
  conversationId: string | undefined;
  selectedSourceIds: string[];
  onConversationCreated: (conversationId: string) => void;
};

/**
 * Sends a chat message to `/api/chat` and streams the assistant's reply into
 * local state, then hands off to the `useMessages` cache once the persisted
 * turn round-trips back from the server.
 */
export function useChatStream({
  notebookId,
  conversationId,
  selectedSourceIds,
  onConversationCreated,
}: UseChatStreamOptions) {
  const queryClient = useQueryClient();
  const [pendingMessages, setPendingMessages] = useState<ChatUiMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  async function sendMessage(rawText: string) {
    const text = rawText.trim();
    if (!text || isStreaming) return;

    const assistantId = `pending-assistant-${Date.now()}`;
    setPendingMessages([
      { id: `pending-user-${Date.now()}`, role: "user", content: text, status: "complete", citations: [] },
      { id: assistantId, role: "assistant", content: "", status: "streaming", citations: [] },
    ]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, conversationId, message: text, selectedSourceIds }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to send message.");
      }

      const returnedConversationId = response.headers.get("X-Mocha-Conversation-Id");
      const citationsHeader = response.headers.get("X-Mocha-Citations");
      const citations = citationsHeader ? (decodeBase64Json<MessageCitation[]>(citationsHeader) ?? []) : [];

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        const snapshot = assistantText;
        setPendingMessages((prev) =>
          prev.map((message) => (message.id === assistantId ? { ...message, content: snapshot } : message)),
        );
      }

      const { text: normalizedText, citations: usedCitations } = normalizeCitedAnswer(
        assistantText,
        citations,
      );
      setPendingMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: normalizedText,
                status: "complete",
                citations: usedCitations,
              }
            : message,
        ),
      );

      const finalConversationId = returnedConversationId ?? conversationId;
      if (finalConversationId) {
        // Invalidate (and let the switch to the real conversationId happen)
        // only after the stream fully lands, so the DB-backed message list
        // never briefly shadows the still-streaming local placeholder.
        await queryClient.invalidateQueries({ queryKey: queryKeys.messages.byConversation(finalConversationId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.conversations.byNotebook(notebookId) });
      }

      if (returnedConversationId && returnedConversationId !== conversationId) {
        onConversationCreated(returnedConversationId);
      }

      setPendingMessages([]);
    } catch (error) {
      setPendingMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                status: "failed",
                content: message.content || (error instanceof Error ? error.message : "Something went wrong."),
              }
            : message,
        ),
      );
      toast.error(error instanceof Error ? error.message : "Failed to send message.");
    } finally {
      setIsStreaming(false);
    }
  }

  return { pendingMessages, isStreaming, sendMessage };
}
