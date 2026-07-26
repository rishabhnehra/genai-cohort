import { qdrant } from "@/lib/qdrant";
import { env } from "@/lib/env";
import { limits } from "@/lib/limits";
import { embedTexts } from "../ingestion/embeddings";
import type { ChunkPayload } from "../ingestion/index-qdrant";
import type { RetrievedChunk, SourceFilter } from "./types";

/**
 * Builds a Qdrant filter scoped to a user + notebook, restricted to the
 * given sources at their currently-ready `indexVersion` (so stale points
 * left over from a re-index never leak into results).
 */
function buildSourceFilter(userId: string, notebookId: string, sources: SourceFilter[]) {
  return {
    must: [
      { key: "userId", match: { value: userId } },
      { key: "notebookId", match: { value: notebookId } },
      {
        should: sources.map((source) => ({
          must: [
            { key: "sourceId", match: { value: source.sourceId } },
            { key: "indexVersion", match: { value: source.indexVersion } },
          ],
        })),
      },
    ],
  };
}

function toRetrievedChunk(payload: ChunkPayload, score: number): RetrievedChunk {
  return {
    chunkId: payload.chunkId,
    sourceId: payload.sourceId,
    sourceType: payload.sourceType,
    sourceTitle: payload.sourceTitle,
    text: payload.text,
    locator: payload.locator,
    indexVersion: payload.indexVersion,
    score,
  };
}

export type SearchChunksInput = {
  userId: string;
  notebookId: string;
  sources: SourceFilter[];
  query: string;
  limit?: number;
};

/** Embeds `query` and runs a single dense vector search scoped to the given sources. */
export async function searchChunks(input: SearchChunksInput): Promise<RetrievedChunk[]> {
  const { userId, notebookId, sources, query, limit = limits.retrieval.perQueryLimit } = input;

  if (sources.length === 0 || !query.trim()) return [];

  const [vector] = await embedTexts([query]);
  if (!vector) return [];

  const results = await qdrant.search(env.QDRANT_COLLECTION, {
    vector,
    limit,
    filter: buildSourceFilter(userId, notebookId, sources),
    with_payload: true,
  });

  return results
    .filter((point) => point.payload)
    .map((point) => toRetrievedChunk(point.payload as unknown as ChunkPayload, point.score));
}
