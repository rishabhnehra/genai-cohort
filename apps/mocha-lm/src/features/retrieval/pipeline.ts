import { limits } from "@/lib/limits";
import { generateStepBackQuery } from "./step-back";
import { generateRefinedQuery } from "./refine-query";
import { generateSubQueries } from "./sub-queries";
import { searchChunks } from "./search";
import { fuseRankedLists } from "./rrf";
import { dedupeChunks } from "./dedupe";
import { rerankChunks } from "./rerank";
import type { RetrievalInput, RetrievalResult, RetrievedChunk } from "./types";

/** Greedily keeps the top-ranked chunks that fit within a character budget. */
function capToBudget(chunks: RetrievedChunk[], budgetChars: number): RetrievedChunk[] {
  const kept: RetrievedChunk[] = [];
  let totalChars = 0;

  for (const chunk of chunks) {
    if (kept.length > 0 && totalChars + chunk.text.length > budgetChars) break;
    kept.push(chunk);
    totalChars += chunk.text.length;
  }

  return kept;
}

const EMPTY_RESULT: RetrievalResult = {
  chunks: [],
  debug: {
    refinedQuery: "",
    stepBackQuery: "",
    subQueries: [],
    candidateCount: 0,
    fusedCount: 0,
    rerankedCount: 0,
  },
};

/**
 * Full advanced retrieval pipeline for one chat turn:
 *
 *   1. Reformulate the question —
 *        - a clearer "refined" query (replaces the raw user text for search)
 *        - a broader "step-back" query
 *        - a handful of focused sub-queries (derived from the refined query)
 *      to widen recall beyond a single embedding.
 *   2. Run a dense vector search per query (refined + step-back + sub-queries),
 *      scoped to the selected, ready sources.
 *   3. Fuse the per-query result lists with Reciprocal Rank Fusion.
 *   4. Deduplicate by chunk identity.
 *   5. Re-rank the fused candidates against the *original* question with an
 *      LLM judge, then trim to the context budget (chunk count + chars).
 */
export async function retrieveContext(input: RetrievalInput): Promise<RetrievalResult> {
  const { userId, notebookId, sources, query } = input;

  if (sources.length === 0 || !query.trim()) {
    return EMPTY_RESULT;
  }

  // Step-back and refine both start from the original question and are
  // independent, so they run in parallel. Sub-queries then decompose the
  // refined query so facets inherit the cleaned phrasing.
  const [stepBackQuery, refinedQuery] = await Promise.all([
    generateStepBackQuery(query),
    generateRefinedQuery(query),
  ]);
  const subQueries = await generateSubQueries(refinedQuery);

  const queries = Array.from(
    new Set(
      [refinedQuery, stepBackQuery, ...subQueries]
        .map((q) => q.trim())
        .filter(Boolean),
    ),
  );

  const resultLists = await Promise.all(
    queries.map((q) =>
      searchChunks({ userId, notebookId, sources, query: q, limit: limits.retrieval.perQueryLimit }),
    ),
  );

  const candidateCount = resultLists.reduce((sum, list) => sum + list.length, 0);

  const fused = fuseRankedLists(resultLists);
  const deduped = dedupeChunks(fused);
  // Re-rank against the original question so the judge scores relevance to
  // what the user actually asked, not the rewritten search forms.
  const reranked = await rerankChunks(query, deduped, limits.retrieval.maxContextChunks);
  const budgeted = capToBudget(reranked, limits.retrieval.contextBudgetChars);

  return {
    chunks: budgeted,
    debug: {
      refinedQuery,
      stepBackQuery,
      subQueries,
      candidateCount,
      fusedCount: deduped.length,
      rerankedCount: reranked.length,
    },
  };
}
