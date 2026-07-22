import "dotenv/config";
import OpenAI from "openai";

export type SubQueriesResult = {
  originalQuery: string;
  subQueries: string[];
};

export type GenerateSubQueriesOptions = {
  model?: string;
  maxSubQueries?: number;
};

const SUB_QUERIES_SYSTEM_PROMPT = `You are a query decomposition assistant for a mobile development course RAG system (Expo / React Native lecture subtitles).

Your job is ONLY to break the user's question into standalone retrieval sub-queries.
Do NOT answer the question. Do NOT add explanation.

Rules:
- Decompose into 1 to N self-contained search queries (N is given in the user message).
- Each sub-query must be searchable on its own against lecture subtitles.
- Cover all distinct facets of the original question; do not duplicate near-identical queries.
- Drop overly specific details (SDK patch versions, device names) when they hurt retrieval.
- Stay in mobile / Expo / React Native territory.
- For simple single-topic questions, return exactly ONE sub-query.
- Output a JSON array of strings only, e.g. ["query one", "query two"]. No markdown fences, no extra keys, no preamble.

Examples:
User: How do I configure EAS dev builds for Android and set up Expo push notifications?
Max sub-queries: 5
Output: ["How do I configure EAS development builds for Android in Expo?", "How do I set up push notifications in an Expo app?"]

User: What is Expo?
Max sub-queries: 5
Output: ["What is Expo and how does it work for mobile app development?"]

User: How do I use React Navigation for stack and tab navigation in Expo?
Max sub-queries: 5
Output: ["How do I set up stack navigation with React Navigation in Expo?", "How do I set up tab navigation with React Navigation in Expo?"]`;

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_SUB_QUERIES_MODEL = "gpt-4.1-nano";
const DEFAULT_MAX_SUB_QUERIES = 5;

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

function resolveModel(options?: GenerateSubQueriesOptions): string {
  return (
    options?.model ?? process.env.SUB_QUERIES_MODEL ?? DEFAULT_SUB_QUERIES_MODEL
  );
}

function stripMarkdownCodeFence(content: string): string {
  const trimmed = content.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return fenceMatch?.[1]?.trim() ?? trimmed;
}

function parseSubQueriesResponse(
  content: string,
  maxSubQueries: number,
): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripMarkdownCodeFence(content));
  } catch {
    throw new Error("Sub-queries model returned invalid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Sub-queries model returned invalid JSON");
  }

  const subQueries: string[] = [];
  const seen = new Set<string>();

  for (const item of parsed) {
    if (typeof item !== "string") {
      continue;
    }

    const query = item.trim();
    if (!query) {
      continue;
    }

    const key = query.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    subQueries.push(query);
  }

  if (subQueries.length === 0) {
    throw new Error("Sub-queries model returned no usable queries");
  }

  return subQueries.slice(0, maxSubQueries);
}

export async function generateSubQueries(
  userQuery: string,
  options?: GenerateSubQueriesOptions,
): Promise<SubQueriesResult> {
  const trimmedQuery = userQuery.trim();
  if (!trimmedQuery) {
    throw new Error("userQuery must be a non-empty string");
  }

  const maxSubQueries = options?.maxSubQueries ?? DEFAULT_MAX_SUB_QUERIES;
  const client = createOpenAIClient();
  const model = resolveModel(options);

  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SUB_QUERIES_SYSTEM_PROMPT },
      {
        role: "user",
        content: `${trimmedQuery}\nMax sub-queries: ${maxSubQueries}`,
      },
    ],
  });

  const rawContent = response.choices[0]?.message?.content?.trim();
  if (!rawContent) {
    throw new Error("Sub-queries model returned an empty response");
  }

  const subQueries = parseSubQueriesResponse(rawContent, maxSubQueries);

  return {
    originalQuery: trimmedQuery,
    subQueries,
  };
}

// generateSubQueries(
//   "What is Temporal Deadzone in Node.js",
// ).then((msg) => console.log(msg));
