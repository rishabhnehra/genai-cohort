"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/utils";
import { messageRowToUIMessage, type MochaMessageMetadata } from "./chat-ui-message";
import type { ConversationListItem, MessageListItem } from "./hooks";

const DRAFT_CHAT_ID = "new-chat";

function titleFromMessages(messages: UIMessage[]) {
  const firstUser = messages.find((message) => message.role === "user");
  return firstUser ? getMessageTextFromUIMessage(firstUser).trim() : "";
}

/** Keep Chat History continuous when a draft chat is first persisted. */
function upsertConversationCache(
  queryClient: ReturnType<typeof useQueryClient>,
  notebookId: string,
  conversationId: string,
  title: string,
) {
  queryClient.setQueryData<ConversationListItem[]>(
    queryKeys.conversations.byNotebook(notebookId),
    (current) => {
      const now = new Date();
      const existing = current?.find((conversation) => conversation.id === conversationId);
      const nextTitle =
        title && (!existing || existing.title === "New chat")
          ? title
          : (existing?.title ?? title) || "New chat";

      const next: ConversationListItem = existing
        ? {
            ...existing,
            title: nextTitle,
            lastMessageAt: now,
            updatedAt: now,
          }
        : {
            id: conversationId,
            notebookId,
            userId: current?.[0]?.userId ?? "",
            title: nextTitle || "New chat",
            model: null,
            systemPrompt: null,
            createdAt: now,
            updatedAt: now,
            lastMessageAt: now,
          };

      return [next, ...(current ?? []).filter((conversation) => conversation.id !== conversationId)];
    },
  );
}

export type UseMochaChatOptions = {
  notebookId: string;
  conversationId: string | undefined;
  selectedSourceIds: string[];
  initialMessages: MessageListItem[] | undefined;
  /** When true, notifies the sidebar to highlight the persisted conversation. */
  syncSidebarHighlight?: boolean;
  onDraftConversationPersisted?: (conversationId: string) => void;
};

export function dbMessagesToUIMessages(messages: MessageListItem[]): UIMessage[] {
  return messages.map((row) =>
    messageRowToUIMessage({
      id: row.id,
      role: row.role,
      content: row.content,
      parts: row.parts,
      metadata: row.metadata,
      status: row.status,
    }),
  );
}

export function getMessageTextFromUIMessage(message: UIMessage) {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function useMochaChat({
  notebookId,
  conversationId,
  selectedSourceIds,
  initialMessages,
  syncSidebarHighlight = false,
  onDraftConversationPersisted,
}: UseMochaChatOptions) {
  const queryClient = useQueryClient();
  const notebookRef = useRef(notebookId);
  const sourcesRef = useRef(selectedSourceIds);
  const conversationRef = useRef(conversationId);
  const syncSidebarHighlightRef = useRef(syncSidebarHighlight);
  const onDraftPersistedRef = useRef(onDraftConversationPersisted);
  const [persistedConversationId, setPersistedConversationId] = useState<
    string | undefined
  >(conversationId);

  useEffect(() => {
    notebookRef.current = notebookId;
  }, [notebookId]);

  useEffect(() => {
    sourcesRef.current = selectedSourceIds;
  }, [selectedSourceIds]);

  useEffect(() => {
    onDraftPersistedRef.current = onDraftConversationPersisted;
  }, [onDraftConversationPersisted]);

  useEffect(() => {
    syncSidebarHighlightRef.current = syncSidebarHighlight;
  }, [syncSidebarHighlight]);

  useEffect(() => {
    conversationRef.current = conversationId ?? persistedConversationId;
  }, [conversationId, persistedConversationId]);

  useEffect(() => {
    if (conversationId) {
      setPersistedConversationId(conversationId);
    }
  }, [conversationId]);

  const hydratedMessages = useMemo(
    () => (initialMessages ? dbMessagesToUIMessages(initialMessages) : []),
    [initialMessages],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages, trigger }) => ({
          body: {
            id: conversationRef.current ?? id,
            message: messages[messages.length - 1],
            notebookId: notebookRef.current,
            selectedSourceIds: sourcesRef.current,
            trigger,
          },
        }),
      }),
    [],
  );

  const chat = useChat({
    id: conversationId ?? DRAFT_CHAT_ID,
    messages: hydratedMessages,
    transport,
    throttle: 50,
    onFinish: ({ message, messages }) => {
      const metadata = message.metadata as MochaMessageMetadata | undefined;
      const resolvedConversationId =
        metadata?.conversationId ?? conversationRef.current;

      if (resolvedConversationId) {
        conversationRef.current = resolvedConversationId;
        setPersistedConversationId(resolvedConversationId);
        // Upsert before highlight so the sidebar never flashes an empty gap
        // between removing "New chat" and the persisted row appearing.
        upsertConversationCache(
          queryClient,
          notebookRef.current,
          resolvedConversationId,
          titleFromMessages(messages),
        );
        if (syncSidebarHighlightRef.current) {
          onDraftPersistedRef.current?.(resolvedConversationId);
        }
        void queryClient.invalidateQueries({
          queryKey: queryKeys.messages.byConversation(resolvedConversationId),
        });
      }

      void queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.byNotebook(notebookRef.current),
      });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send message.");
    },
  });

  async function sendNotebookMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    await chat.sendMessage({ text: trimmed });
  }

  return {
    ...chat,
    sendNotebookMessage,
    persistedConversationId,
  };
}
