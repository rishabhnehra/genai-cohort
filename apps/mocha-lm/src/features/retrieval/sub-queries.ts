import { generateObject } from "ai";
import { z } from "zod";
import { openrouter } from "@/lib/openrouter";
import { env } from "@/lib/env";
import { limits } from "@/lib/limits";

const SUB_QUERIES_SYSTEM_PROMPT = `You are a query decomposition assistant for a document-grounded question answering system.

Your job is ONLY to break the user's question into ${limits.retrieval.minSubQueries}-${limits.retrieval.maxSubQueries} focused sub-queries that together cover the different facets or entities of the original question.

Rules:
- Each sub-query should be a standalone, self-contained search query (no pronouns referring back to the original question).
- Do NOT answer the question. Do NOT add explanation.
- If the question is already narrow and single-faceted, still return at least ${limits.retrieval.minSubQueries} paraphrased variations to broaden retrieval recall.
- Do not duplicate the original question verbatim.`;

const subQueriesSchema = z.object({
  queries: z
    .array(z.string().min(1))
    .min(1)
    .describe("Focused, standalone search queries derived from the user's question."),
});

/** Decomposes a user question into a handful of focused sub-queries to widen retrieval recall. */
export async function generateSubQueries(userQuery: string): Promise<string[]> {
  const trimmed = userQuery.trim();
  if (!trimmed) return [];

  try {
    const { object } = await generateObject({
      model: openrouter.chat(env.SUB_QUERIES_MODEL),
      schema: subQueriesSchema,
      temperature: 0.2,
      system: SUB_QUERIES_SYSTEM_PROMPT,
      prompt: trimmed,
    });

    const unique = Array.from(
      new Set(
        object.queries
          .map((query) => query.trim())
          .filter((query) => query.length > 0 && query.toLowerCase() !== trimmed.toLowerCase()),
      ),
    );

    return unique.slice(0, limits.retrieval.maxSubQueries);
  } catch {
    // Retrieval should degrade gracefully rather than fail the whole chat turn.
    return [];
  }
}
