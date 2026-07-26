import type { RetrievedChunk } from "./types";

/**
 * Drops duplicate chunks (same source + chunk id) while preserving the
 * existing order — callers should dedupe *after* ranking/fusion so the
 * highest-ranked occurrence of a chunk is the one that's kept.
 */
export function dedupeChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Set<string>();
  const deduped: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    const key = `${chunk.sourceId}:${chunk.chunkId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(chunk);
  }

  return deduped;
}
