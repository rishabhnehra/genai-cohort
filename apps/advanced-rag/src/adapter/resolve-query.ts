import type { VectorStore } from "@langchain/core/vectorstores";
import type { ResolveQueryResult, SearchOptions } from "./types.js";

const DEFAULT_TOP_K = 5;

function resolveLimit(options?: SearchOptions): number {
  if (options?.limit !== undefined) {
    return options.limit;
  }

  const fromEnv = process.env.RETRIEVAL_TOP_K;
  if (fromEnv) {
    const parsed = Number.parseInt(fromEnv, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return DEFAULT_TOP_K;
}

export async function resolveQuery(
  store: VectorStore,
  query: string,
  options?: SearchOptions,
): Promise<ResolveQueryResult> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error("query must be a non-empty string");
  }

  const limit = resolveLimit(options);
  const results = await store.similaritySearchWithScore(trimmedQuery, limit);

  return {
    query: trimmedQuery,
    records: results.map(([document, score]) => ({ document, score })),
  };
}
