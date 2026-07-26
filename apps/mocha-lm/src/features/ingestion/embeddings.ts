import { embedMany } from "ai";
import { openrouter } from "@/lib/openrouter";
import { AppError, ErrorCodes } from "@/lib/errors";
import { limits } from "@/lib/limits";

/** Batches `values` through the configured OpenRouter embedding model. */
export async function embedTexts(values: string[]): Promise<number[][]> {
  if (values.length === 0) return [];

  const model = openrouter.textEmbeddingModel(limits.embedding.model);
  const vectors: number[][] = [];

  for (let start = 0; start < values.length; start += limits.embedding.batchSize) {
    const batch = values.slice(start, start + limits.embedding.batchSize);

    try {
      const { embeddings } = await embedMany({ model, values: batch });
      vectors.push(...embeddings);
    } catch (error) {
      throw new AppError(ErrorCodes.EMBEDDING_FAILED, "Failed to generate embeddings for this source.", {
        cause: error,
      });
    }
  }

  return vectors;
}
