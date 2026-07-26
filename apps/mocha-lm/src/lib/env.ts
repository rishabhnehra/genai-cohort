import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  APP_URL: z.string().url().default("http://localhost:3002"),

  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: z
    .string()
    .default("/notebooks"),

  // Database
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgres://postgres:postgres@localhost:5433/mocha_lm"),

  // Redis / BullMQ
  REDIS_URL: z.string().min(1).default("redis://localhost:6380"),

  // Qdrant
  QDRANT_URL: z.string().min(1).default("http://localhost:6335"),
  QDRANT_COLLECTION: z.string().min(1).default("mocha_lm_chunks"),

  // OpenRouter / LLM
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  CHAT_MODEL: z.string().default("openai/gpt-4o-mini"),
  STEP_BACK_MODEL: z.string().default("openai/gpt-4o-mini"),
  REFINE_QUERY_MODEL: z.string().default("openai/gpt-4o-mini"),
  SUB_QUERIES_MODEL: z.string().default("openai/gpt-4o-mini"),
  RERANK_MODEL: z.string().default("openai/gpt-4o-mini"),

  // Embeddings
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),

  // Ingestion worker
  INGESTION_WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(26_214_400),
  MAX_SOURCES_PER_NOTEBOOK: z.coerce.number().int().positive().default(50),

  // Retrieval
  RETRIEVAL_TOP_K: z.coerce.number().int().positive().default(8),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "Invalid environment variables:",
      parsed.error.flatten().fieldErrors,
    );
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

export const env = loadEnv();
