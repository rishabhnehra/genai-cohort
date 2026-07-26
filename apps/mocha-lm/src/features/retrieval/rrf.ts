import { rrf as fusionRrf, type RankedItem } from "fusion-rank";
import { limits } from "@/lib/limits";
import type { RetrievedChunk } from "./types";

/** Stable identity for a chunk across multiple retrieval queries/lists. */
function chunkKey(chunk: RetrievedChunk): string {
  return `${chunk.sourceId}:${chunk.chunkId}`;
}

/**
 * Fuses multiple per-query ranked result lists into a single ranked list via
 * Reciprocal Rank Fusion, so chunks retrieved by several (sub-)queries rank
 * above chunks that only one query surfaced.
 */
export function fuseRankedLists(
  lists: RetrievedChunk[][],
  options?: { k?: number },
): RetrievedChunk[] {
  const nonEmptyLists = lists.filter((list) => list.length > 0);

  if (nonEmptyLists.length === 0) return [];
  if (nonEmptyLists.length === 1) return nonEmptyLists[0];

  const rankedLists: RankedItem[][] = nonEmptyLists.map((list) =>
    list.map((chunk, index) => ({
      id: chunkKey(chunk),
      rank: index + 1,
      score: chunk.score,
      metadata: { chunk },
    })),
  );

  const fused = fusionRrf(rankedLists, {
    k: options?.k ?? limits.retrieval.rrfK,
    missingDocStrategy: "skip",
  });

  return fused.map((result) => {
    const chunk = (result.metadata as { chunk: RetrievedChunk }).chunk;
    return { ...chunk, score: result.score };
  });
}
