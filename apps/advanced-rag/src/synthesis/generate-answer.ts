import "dotenv/config";
import OpenAI from "openai";
import type { FusedDocument } from "../adapter/types.js";

export type GenerateAnswerResult = {
  answer: string;
};

export type GenerateAnswerOptions = {
  model?: string;
};

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_ANSWER_MODEL = "gpt-4.1-nano";

const ANSWER_SYSTEM_PROMPT = `You are a helpful teaching assistant for a mobile development course (Expo / React Native lecture subtitles).

Answer the user's question using ONLY the provided context excerpts.
Rules:
- Ground every claim in the context. Do not invent facts outside it.
- If the context is insufficient, say what is missing and answer only what you can.
- Be concise and clear (a short paragraph or a few bullets when helpful).
- Do not mention RRF, retrieval ranks, or that you are using "context documents".
- Prefer course terminology from the excerpts when it fits.`;

function formatContext(documents: FusedDocument[]): string {
  if (documents.length === 0) {
    return "(No context documents were retrieved.)";
  }

  return documents
    .map(({ document, rank, rrfScore }) => {
      const { module, lecture, source } = document.metadata;
      return [
        `--- Document ${rank} (rrf=${rrfScore.toFixed(3)}) ---`,
        `module: ${module ?? "unknown"}`,
        `lecture: ${lecture ?? "unknown"}`,
        `source: ${source ?? "unknown"}`,
        "",
        document.pageContent,
      ].join("\n");
    })
    .join("\n\n");
}

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

function resolveModel(options?: GenerateAnswerOptions): string {
  return options?.model ?? process.env.ANSWER_MODEL ?? DEFAULT_ANSWER_MODEL;
}

export async function generateAnswer(
  userQuery: string,
  documents: FusedDocument[],
  options?: GenerateAnswerOptions,
): Promise<GenerateAnswerResult> {
  const trimmedQuery = userQuery.trim();
  if (!trimmedQuery) {
    throw new Error("userQuery must be a non-empty string");
  }

  const client = createOpenAIClient();
  const model = resolveModel(options);
  const context = formatContext(documents);

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: ANSWER_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          `Question: ${trimmedQuery}`,
          "",
          "Context:",
          context,
          "",
          "Answer the question using only the context above.",
        ].join("\n"),
      },
    ],
  });

  const answer = response.choices[0]?.message?.content?.trim();
  if (!answer) {
    throw new Error("Answer model returned an empty response");
  }

  return { answer };
}
