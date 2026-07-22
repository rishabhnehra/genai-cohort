import OpenAI from "openai";

export type StepBackQueryResult = {
  originalQuery: string;
  stepBackQuery: string;
};

export type GenerateStepBackOptions = {
  model?: string;
};

const STEP_BACK_SYSTEM_PROMPT = `You are a query reformulation assistant for a mobile development course RAG system (Expo / React Native lecture subtitles).

Your job is ONLY to rewrite the user's question into ONE higher-level "step-back" retrieval query.
Do NOT answer the question. Do NOT add explanation.

Rules:
- Step back to the underlying concept / principle behind the question.
- Drop overly specific details (SDK versions, device names) when they hurt retrieval.
- Do NOT over-abstract (keep it in mobile / Expo / React Native territory).
- Output a single standalone search query (one sentence).
- Return ONLY the reformulated query as plain text. No JSON, no quotes, no preamble.

Examples:
User: How do I configure EAS dev builds for Android in Expo SDK 52?
Output: How does Expo handle custom native development builds?

User: What is Expo?
Output: What is cross-platform mobile app development with Expo?

User: How do I set up push notifications with Expo?
Output: How do mobile push notifications work in Expo apps?`;

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_STEP_BACK_MODEL = "gpt-4.1-nano";

function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to apps/advanced-rag/.env",
    );
  }

  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
  });
}

function resolveModel(options?: GenerateStepBackOptions): string {
  return options?.model ?? process.env.STEP_BACK_MODEL ?? DEFAULT_STEP_BACK_MODEL;
}

export async function generateStepBackQuery(
  userQuery: string,
  options?: GenerateStepBackOptions,
): Promise<StepBackQueryResult> {
  const trimmedQuery = userQuery.trim();
  if (!trimmedQuery) {
    throw new Error("userQuery must be a non-empty string");
  }

  const client = createOpenAIClient();
  const model = resolveModel(options);

  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    messages: [
      { role: "system", content: STEP_BACK_SYSTEM_PROMPT },
      { role: "user", content: trimmedQuery },
    ],
  });

  const stepBackQuery = response.choices[0]?.message?.content?.trim();
  if (!stepBackQuery) {
    throw new Error("Step-back model returned an empty response");
  }

  return {
    originalQuery: trimmedQuery,
    stepBackQuery,
  };
}
