import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { env } from "./env";

/**
 * Shared OpenRouter provider instance used for chat completions, retrieval
 * helper calls (step-back/sub-queries/rerank), and embeddings. A single
 * `OPENROUTER_API_KEY` covers all of it.
 */
export const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  appName: "Mocha LM",
});
