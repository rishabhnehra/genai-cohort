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
