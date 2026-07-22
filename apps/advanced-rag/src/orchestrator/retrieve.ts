import type { VectorStore } from "@langchain/core/vectorstores";
import { resolveQuery } from "../adapter/resolve-query.js";
import type { ResolveQueryResult, SearchOptions } from "../adapter/types.js";
import { generateStepBackQuery } from "../queries/step-back.js";
import { generateSubQueries } from "../queries/sub-queries.js";

export type OrchestrateRetrievalResult = {
  originalQuery: string;
  stepBackQuery: string;
  subQueries: string[];
  executedQueries: string[];
  results: ResolveQueryResult[];
};

/**
 * Expand the user query via step-back + sub-queries, resolve each against
 * the vector store, and collect all returned documents.
 * Answer synthesis happens after RRF fusion in the caller.
 */
export async function orchestrateRetrieval(
  store: VectorStore,
  userQuery: string,
  options?: SearchOptions,
): Promise<OrchestrateRetrievalResult> {
  const trimmedQuery = userQuery.trim();
  if (!trimmedQuery) {
    throw new Error("userQuery must be a non-empty string");
  }

  const [subQueriesResult, stepBackResult] = await Promise.all([
    generateSubQueries(trimmedQuery),
    generateStepBackQuery(trimmedQuery),
  ]);

  const executedQueries = [
    trimmedQuery,
    stepBackResult.stepBackQuery,
    ...subQueriesResult.subQueries,
  ];

  const results = await Promise.all(
    executedQueries.map((query) => resolveQuery(store, query, options)),
  );

  return {
    originalQuery: trimmedQuery,
    stepBackQuery: stepBackResult.stepBackQuery,
    subQueries: subQueriesResult.subQueries,
    executedQueries,
    results: results.filter((result) => result.records.length > 0),
  };
}
