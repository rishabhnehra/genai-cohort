import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export function getChatModel(modelId = "gpt-4o-mini") {
  const openrouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY,
  });

  return openrouter(modelId);
}
