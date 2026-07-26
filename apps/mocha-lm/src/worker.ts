import { Worker } from "bullmq";
import { env } from "./lib/env";
import { createRedisConnection } from "./lib/redis";
import { ensureQdrantCollection } from "./lib/qdrant";
import { SOURCE_INGESTION_QUEUE } from "./features/ingestion/queue";
import { processIngestionJob } from "./features/ingestion/pipeline";
import type { IngestionJobPayload } from "./features/ingestion/types";

declare global {
  var __mochaLmIngestionWorker: Worker<IngestionJobPayload> | undefined;
}

export type StartIngestionWorkerOptions = {
  /**
   * When true (CLI `pnpm worker`), exit the process on boot failure or after
   * signal-driven shutdown. When false (embedded via instrumentation), keep the
   * Next.js process alive even if the worker fails to start.
   */
  exitOnFailure?: boolean;
};

/**
 * Ingestion worker entrypoint: consumes the `source-ingestion` BullMQ queue
 * and runs each job through the fetch → extract → chunk → embed → index
 * pipeline (see `features/ingestion/pipeline.ts`).
 */
export async function startIngestionWorker(
  options: StartIngestionWorkerOptions = {},
): Promise<Worker<IngestionJobPayload> | undefined> {
  const { exitOnFailure = false } = options;

  if (globalThis.__mochaLmIngestionWorker) {
    console.log("ingestion worker already running, skipping start");
    return globalThis.__mochaLmIngestionWorker;
  }

  try {
    console.log("worker starting", {
      redis: env.REDIS_URL,
      qdrant: env.QDRANT_URL,
      concurrency: env.INGESTION_WORKER_CONCURRENCY,
    });

    await ensureQdrantCollection();

    const worker = new Worker<IngestionJobPayload>(
      SOURCE_INGESTION_QUEUE,
      async (job) => {
        await processIngestionJob(job.data, job);
      },
      {
        // Dedicated connection — must not share the Queue's Redis client.
        connection: createRedisConnection(),
        concurrency: env.INGESTION_WORKER_CONCURRENCY,
      },
    );

    globalThis.__mochaLmIngestionWorker = worker;

    worker.on("completed", (job) => {
      console.log("ingestion job completed", { jobId: job.id, sourceId: job.data.sourceId });
    });

    worker.on("failed", (job, error) => {
      console.error("ingestion job failed", {
        jobId: job?.id,
        sourceId: job?.data.sourceId,
        attemptsMade: job?.attemptsMade,
        error: error?.message,
      });
    });

    const shutdown = async (signal: string) => {
      console.log(`worker received ${signal}, shutting down gracefully`);
      await worker.close();
      globalThis.__mochaLmIngestionWorker = undefined;
      if (exitOnFailure) {
        process.exit(0);
      }
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));

    return worker;
  } catch (error) {
    console.error("worker failed to start", error);
    if (exitOnFailure) {
      process.exit(1);
    }
    throw error;
  }
}

function isCliEntrypoint(): boolean {
  const arg = process.argv[1];
  if (!arg) return false;
  const normalized = arg.replace(/\\/g, "/");
  return /\/worker\.(ts|js|mjs|cjs)$/.test(normalized) || normalized.endsWith("/worker");
}

if (isCliEntrypoint()) {
  // Local/standalone CLI only — prod Docker uses env vars, not .env files.
  void import("dotenv/config").then(() =>
    startIngestionWorker({ exitOnFailure: true }),
  );
}
