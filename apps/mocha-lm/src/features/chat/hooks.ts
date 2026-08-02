"use client";

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
