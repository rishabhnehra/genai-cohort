import { generateObject } from "ai";
import { z } from "zod";
import { openrouter } from "@/lib/openrouter";
import { env } from "@/lib/env";
import { limits } from "@/lib/limits";
import type { RetrievedChunk } from "./types";

const RERANK_SYSTEM_PROMPT = `You are a relevance-ranking assistant for a document-grounded question answering system.

You will be given a user question and a numbered list of candidate excerpts. Order the excerpt ids from MOST to LEAST relevant to answering the question.

Rules:
- Only use excerpt ids that appear in the candidate list.
- Include every excerpt id exactly once.
- Do NOT answer the question. Do NOT add explanation.`;

const rerankSchema = z.object({
  rankedChunkIds: z
    .array(z.string().min(1))
    .min(1)
    .describe("Excerpt ids ordered from most to least relevant to the question."),
});

const MAX_CANDIDATE_CHARS = 600;

function formatCandidates(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk) => `[${chunk.chunkId}] (${chunk.sourceTitle}) ${chunk.text.slice(0, MAX_CANDIDATE_CHARS)}`)
    .join("\n\n");
}

/**
 * Re-orders retrieved chunks by relevance to the (original, non-decomposed)
 * user query using an LLM judge, then trims to `topK`. Falls back to the
 * incoming (fused) order if the model call fails or returns something we
 * can't parse.
 */
export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[],
  topK: number = limits.retrieval.maxContextChunks,
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return [];
  if (chunks.length <= topK) return chunks;

  try {
    const { object } = await generateObject({
      model: openrouter.chat(env.RERANK_MODEL),
      schema: rerankSchema,
      temperature: 0,
      system: RERANK_SYSTEM_PROMPT,
      prompt: `Question: ${query}\n\nCandidate excerpts:\n${formatCandidates(chunks)}`,
    });

    const order = new Map(object.rankedChunkIds.map((chunkId, index) => [chunkId, index]));
    const ranked = [...chunks].sort((a, b) => {
      const rankA = order.get(a.chunkId) ?? Number.MAX_SAFE_INTEGER;
      const rankB = order.get(b.chunkId) ?? Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });

    return ranked.slice(0, topK);
  } catch {
    // Retrieval should degrade gracefully rather than fail the whole chat turn.
    return chunks.slice(0, topK);
  }
}
