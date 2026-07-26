import { v5 as uuidv5 } from "uuid";
import { qdrant } from "@/lib/qdrant";
import { env } from "@/lib/env";
import { AppError, ErrorCodes } from "@/lib/errors";
import type { SourceType } from "@/generated/prisma/enums";
import type { CitationLocator, NormalizedChunk } from "./types";

/** Fixed namespace for deriving deterministic per-chunk Qdrant point IDs. */
const CHUNK_ID_NAMESPACE = "3f2b9a3e-7c1e-4b8e-9a2a-0b6f6a2e9c11";

export type ChunkPayload = {
  userId: string;
  notebookId: string;
  sourceId: string;
  sourceType: SourceType;
  sourceTitle: string;
  chunkId: string;
  text: string;
  locator: CitationLocator;
  indexVersion: number;
};

export function chunkPointId(sourceId: string, indexVersion: number, chunkId: string) {
  return uuidv5(`${sourceId}:v${indexVersion}:${chunkId}`, CHUNK_ID_NAMESPACE);
}

export type IndexChunksInput = {
  userId: string;
  notebookId: string;
  sourceId: string;
  sourceType: SourceType;
  sourceTitle: string;
  indexVersion: number;
  chunks: NormalizedChunk[];
  vectors: number[][];
};

/**
 * Upserts freshly embedded chunks for a source's current `indexVersion`,
 * then deletes any points left over from older versions of that source.
 */
export async function indexChunks(input: IndexChunksInput): Promise<void> {
  if (input.chunks.length !== input.vectors.length) {
    throw new AppError(ErrorCodes.INDEXING_FAILED, "Chunk/embedding count mismatch.");
  }

  const points = input.chunks.map((chunk, i) => ({
    id: chunkPointId(input.sourceId, input.indexVersion, chunk.chunkId),
    vector: input.vectors[i],
    payload: {
      userId: input.userId,
      notebookId: input.notebookId,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
      sourceTitle: input.sourceTitle,
      chunkId: chunk.chunkId,
      text: chunk.text,
      locator: chunk.locator,
      indexVersion: input.indexVersion,
    } satisfies ChunkPayload,
  }));

  try {
    if (points.length > 0) {
      await qdrant.upsert(env.QDRANT_COLLECTION, { wait: true, points });
    }

    await qdrant.delete(env.QDRANT_COLLECTION, {
      wait: true,
      filter: {
        must: [{ key: "sourceId", match: { value: input.sourceId } }],
        must_not: [{ key: "indexVersion", match: { value: input.indexVersion } }],
      },
    });
  } catch (error) {
    throw new AppError(ErrorCodes.INDEXING_FAILED, "Failed to index this source.", {
      cause: error,
    });
  }
}

/** Deletes every point belonging to a source (used when a source is deleted). */
export async function deleteSourcePoints(sourceId: string): Promise<void> {
  await qdrant.delete(env.QDRANT_COLLECTION, {
    wait: true,
    filter: {
      must: [{ key: "sourceId", match: { value: sourceId } }],
    },
  });
}
