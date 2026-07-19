"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createConversation,
  deleteConversation,
  listConversations,
  updateConversation,
} from "./actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Conversation } from "@/generated/prisma/browser";
import { queryKeys } from "@/lib/utils";

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.conversations.all,
    queryFn: () => listConversations(),
  });
}

export function useCreateConversations() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (title: string) => createConversation(title),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all,
      });
      router.push(`/c/${conversation.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Something went wrong");
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Pick<Conversation, "title" | "isArchived" | "isPinned">;
    }) => updateConversation(id, data),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all,
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.detail(conversation.id),
      });
    },
    onError: (error) => {
      toast.error(
        error.message || "Something went wrong during converstion update",
      );
    },
  });
}
export function useDeleteConversation(id?: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ id }: { id: string }) => deleteConversation(id),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.conversations.all,
      });
      queryClient.removeQueries({
        queryKey: queryKeys.messages.byConversation(conversation.id),
      });

      if (id === conversation.id) {
        router.push("/");
      }

      toast.success("Chat deleted.");
    },
    onError: (error) => {
      toast.error(error.message || "Unable to delete conversation");
    },
  });
}
