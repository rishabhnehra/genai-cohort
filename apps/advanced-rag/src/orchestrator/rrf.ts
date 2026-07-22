import type { Document } from "@langchain/core/documents";
import { rrf, type RankedItem } from "fusion-rank";
import type {
  FusedDocument,
  ResolveQueryResult,
  RrfOptions,
} from "../adapter/types.js";

function mapSingleList(
  result: ResolveQueryResult,
  limit?: number,
): FusedDocument[] {
  const records =
    limit === undefined ? result.records : result.records.slice(0, limit);

  return records.map(({ document, score }, index) => ({
    document,
    rrfScore: score,
    rank: index + 1,
    appearances: [
      {
        query: result.query,
        rank: index + 1,
        similarityScore: score,
      },
    ],
  }));
}

/**
 * Fuse per-query ranked retrieval lists with Reciprocal Rank Fusion.
 */
export function fuseWithRrf(
  results: ResolveQueryResult[],
  options?: RrfOptions,
): FusedDocument[] {
  if (results.length === 0) {
    return [];
  }

  if (results.length === 1) {
    return mapSingleList(results[0], options?.limit);
  }

  const documentsById = new Map<string, Document>();
  const similarityByListAndId = new Map<string, number>();

  const rankedLists: RankedItem[][] = results.map((result, listIndex) =>
    result.records.map(({ document, score }) => {
      const id = document.pageContent;
      if (!documentsById.has(id)) {
        documentsById.set(id, document);
      }
      similarityByListAndId.set(`${listIndex}::${id}`, score);
      return {
        id,
        score,
        metadata: {
          module: document.metadata.module,
          lecture: document.metadata.lecture,
          source: document.metadata.source,
        },
      };
    }),
  );

  const fused = rrf(rankedLists, {
    k: options?.k ?? 60,
    ...(options?.limit !== undefined ? { topK: options.limit } : {}),
    missingDocStrategy: "skip",
  });

  const output: FusedDocument[] = [];

  for (const { id, score, rank, sources } of fused) {
    const document = documentsById.get(id);
    if (!document) {
      continue;
    }

    output.push({
      document,
      rrfScore: score,
      rank,
      appearances: sources.map(({ listIndex, rank: sourceRank }) => ({
        query: results[listIndex].query,
        rank: sourceRank,
        similarityScore:
          similarityByListAndId.get(`${listIndex}::${id}`) ?? 0,
      })),
    });
  }

  return output;
}
