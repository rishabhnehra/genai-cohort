import { env } from "./env";

/**
 * Centralized limits for ingestion, chunking, retrieval, and chat so tuning
 * one number doesn't require hunting through every feature module.
 */
export const limits = {
  upload: {
    maxBytes: env.MAX_UPLOAD_BYTES,
    allowedMimeTypes: {
      PDF: ["application/pdf"],
      SRT: ["application/x-subrip", "text/plain", "application/octet-stream"],
    },
    allowedExtensions: {
      PDF: [".pdf"],
      SRT: [".srt"],
    },
  },

  notebook: {
    maxSources: env.MAX_SOURCES_PER_NOTEBOOK,
  },

  ingestion: {
    concurrency: env.INGESTION_WORKER_CONCURRENCY,
    attempts: 3,
    backoffMs: 5_000,
    removeOnCompleteCount: 200,
    removeOnFailCount: 1_000,
  },

  ssrf: {
    maxRedirects: 3,
    maxBytes: 15_000_000,
    timeoutMs: 15_000,
  },

  chunking: {
    chunkSize: 1_000,
    chunkOverlap: 200,
  },

  embedding: {
    model: env.EMBEDDING_MODEL,
    dimensions: env.EMBEDDING_DIMENSIONS,
    batchSize: 64,
  },

  retrieval: {
    topK: env.RETRIEVAL_TOP_K,
    perQueryLimit: 12,
    maxSubQueries: 4,
    minSubQueries: 2,
    rrfK: 60,
    contextBudgetChars: 12_000,
    maxContextChunks: 12,
  },

  chat: {
    historyMessages: 12,
    maxMessageChars: 8_000,
  },
} as const;
