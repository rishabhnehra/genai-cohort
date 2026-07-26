"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { queryKeys } from "@/lib/utils";
import {
  createNotebook,
  deleteNotebook,
  getNotebook,
  listNotebooks,
  renameNotebook,
  touchNotebook,
} from "./actions";

export function useNotebooks() {
  return useQuery({
    queryKey: queryKeys.notebooks.all,
    queryFn: () => listNotebooks(),
  });
}

export function useNotebook(notebookId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notebooks.detail(notebookId ?? ""),
    queryFn: () => getNotebook(notebookId as string),
    enabled: Boolean(notebookId),
  });
}

export function useCreateNotebook() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (title?: string) => createNotebook(title),
    onSuccess: (notebook) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notebooks.all });
      router.push(`/notebooks/${notebook.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Unable to create notebook");
    },
  });
}

export function useRenameNotebook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameNotebook(id, title),
    onSuccess: (notebook) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notebooks.all });
      queryClient.invalidateQueries({
        queryKey: queryKeys.notebooks.detail(notebook.id),
      });
    },
    onError: (error) => {
      toast.error(error.message || "Unable to rename notebook");
    },
  });
}

export function useDeleteNotebook(activeNotebookId?: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => deleteNotebook(id),
    onSuccess: ({ id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notebooks.all });
      queryClient.removeQueries({ queryKey: queryKeys.notebooks.detail(id) });

      if (activeNotebookId === id) {
        router.push("/notebooks");
      }

      toast.success("Notebook deleted.");
    },
    onError: (error) => {
      toast.error(error.message || "Unable to delete notebook");
    },
  });
}

export function useTouchNotebook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => touchNotebook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notebooks.all });
    },
  });
}
