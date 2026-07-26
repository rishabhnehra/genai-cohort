"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/utils";
import { deleteSource, listSources, retrySource } from "./actions";

const NONTERMINAL_STATUSES = new Set(["QUEUED", "PROCESSING", "DELETING"]);

export type SourceListItem = Awaited<ReturnType<typeof listSources>>[number];

export function useSources(notebookId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sources.byNotebook(notebookId ?? ""),
    queryFn: () => listSources(notebookId as string),
    enabled: Boolean(notebookId),
    refetchInterval: (query) => {
      const sources = query.state.data;
      const hasNonterminal = sources?.some((source) =>
        NONTERMINAL_STATUSES.has(source.status),
      );
      return hasNonterminal ? 2000 : false;
    },
  });
}

export function useDeleteSource(notebookId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => deleteSource(sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.byNotebook(notebookId) });
      toast.success("Source deleted.");
    },
    onError: (error) => {
      toast.error(error.message || "Unable to delete source");
    },
  });
}

export function useRetrySource(notebookId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => retrySource(sourceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.byNotebook(notebookId) });
      toast.success("Retrying source…");
    },
    onError: (error) => {
      toast.error(error.message || "Unable to retry source");
    },
  });
}

type UploadResponse = { sources: SourceListItem[] };

export function useUploadSources(notebookId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (files: File[]) => {
      const formData = new FormData();
      formData.set("notebookId", notebookId);
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch("/api/sources/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Upload failed");
      }

      return (await response.json()) as UploadResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.byNotebook(notebookId) });
    },
    onError: (error) => {
      toast.error(error.message || "Unable to upload file");
    },
  });
}

export function useAddUrlSource(notebookId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (url: string) => {
      const response = await fetch("/api/sources/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, url }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Unable to add URL");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.byNotebook(notebookId) });
    },
    onError: (error) => {
      toast.error(error.message || "Unable to add URL");
    },
  });
}
