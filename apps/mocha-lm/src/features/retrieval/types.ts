import type { SourceType } from "@/generated/prisma/enums";
import type { CitationLocator } from "../ingestion/types";

/** A single indexed chunk returned by a retrieval search, scored for a query. */
export type RetrievedChunk = {
  chunkId: string;
  sourceId: string;
  sourceType: SourceType;
  sourceTitle: string;
  text: string;
  locator: CitationLocator;
  indexVersion: number;
  score: number;
};

/** Scopes retrieval to one source at its current (ready) index version. */
export type SourceFilter = {
  sourceId: string;
  indexVersion: number;
};

export type RetrievalInput = {
  userId: string;
  notebookId: string;
  /** Ready sources selected for this chat turn's context. */
  sources: SourceFilter[];
  query: string;
};

export type RetrievalDebugInfo = {
  refinedQuery: string;
  stepBackQuery: string;
  subQueries: string[];
  candidateCount: number;
  fusedCount: number;
  rerankedCount: number;
};

export type RetrievalResult = {
  chunks: RetrievedChunk[];
  debug: RetrievalDebugInfo;
};
