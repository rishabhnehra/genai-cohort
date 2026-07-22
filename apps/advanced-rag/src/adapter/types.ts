import type { Document } from "@langchain/core/documents";

export type SearchOptions = {
  limit?: number;
};

export type ScoredDocument = {
  document: Document;
  score: number;
};

export type ResolveQueryResult = {
  query: string;
  records: ScoredDocument[];
};

export type RrfOptions = {
  /** RRF constant k. Default 60. */
  k?: number;
  /** Max fused results to return. Maps to fusion-rank topK. */
  limit?: number;
};

export type FusedDocumentAppearance = {
  query: string;
  rank: number;
  similarityScore: number;
};

export type FusedDocument = {
  document: Document;
  rrfScore: number;
  rank: number;
  appearances: FusedDocumentAppearance[];
};
