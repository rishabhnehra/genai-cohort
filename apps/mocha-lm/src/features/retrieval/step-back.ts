import { generateText } from "ai";
import { openrouter } from "@/lib/openrouter";
import { env } from "@/lib/env";

const STEP_BACK_SYSTEM_PROMPT = `You are a query reformulation assistant for a document-grounded question answering system.

Your job is ONLY to rewrite the user's question into ONE higher-level "step-back" retrieval query.
Do NOT answer the question. Do NOT add explanation.

Rules:
- Step back to the underlying concept or principle behind the question.
- Drop overly specific details when they would hurt retrieval.
- Do NOT over-abstract — stay within the same general topic.
- Output a single standalone search query (one sentence).
- Return ONLY the reformulated query as plain text. No JSON, no quotes, no preamble.`;

/** Generates a broader "step-back" retrieval query for a user question. */
export async function generateStepBackQuery(userQuery: string): Promise<string> {
  const trimmed = userQuery.trim();
  if (!trimmed) return trimmed;

  try {
    const { text } = await generateText({
      model: openrouter.chat(env.STEP_BACK_MODEL),
      temperature: 0,
      system: STEP_BACK_SYSTEM_PROMPT,
      prompt: trimmed,
    });

    return text.trim() || trimmed;
  } catch {
    // Retrieval should degrade gracefully rather than fail the whole chat turn.
    return trimmed;
  }
}
