import { generateText } from "ai";
import { openrouter } from "@/lib/openrouter";
import { env } from "@/lib/env";

const REFINE_QUERY_SYSTEM_PROMPT = `You are a query refinement assistant for a document-grounded question answering system.

Your job is ONLY to rewrite the user's question into ONE clearer, more retrieval-friendly search query.
Do NOT answer the question. Do NOT add explanation.

Rules:
- Preserve the user's intent and every important entity, constraint, and detail.
- Fix typos, expand unclear shorthand, and resolve vague pronouns into concrete nouns when the referent is obvious from the question itself.
- Prefer a concise, keyword-rich phrasing that a dense vector search can match against source excerpts.
- Do NOT broaden into a different topic (that is step-back's job) and do NOT split into multiple questions (that is sub-query decomposition's job).
- Output a single standalone search query (one sentence or short phrase).
- Return ONLY the refined query as plain text. No JSON, no quotes, no preamble.`;

/**
 * Rewrites the user's question into a clearer retrieval query while keeping
 * the original intent and specifics intact. Used in place of the raw query
 * for dense search (alongside step-back and sub-queries).
 */
export async function generateRefinedQuery(userQuery: string): Promise<string> {
  const trimmed = userQuery.trim();
  if (!trimmed) return trimmed;

  try {
    const { text } = await generateText({
      model: openrouter.chat(env.REFINE_QUERY_MODEL),
      temperature: 0,
      system: REFINE_QUERY_SYSTEM_PROMPT,
      prompt: trimmed,
    });

    return text.trim() || trimmed;
  } catch {
    // Retrieval should degrade gracefully rather than fail the whole chat turn.
    return trimmed;
  }
}
