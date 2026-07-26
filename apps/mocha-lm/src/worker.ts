import "dotenv/config";
import { Worker } from "bullmq";
import { env } from "./lib/env";
import { getRedis } from "./lib/redis";
import { ensureQdrantCollection } from "./lib/qdrant";
import { SOURCE_INGESTION_QUEUE } from "./features/ingestion/queue";
import { processIngestionJob } from "./features/ingestion/pipeline";
import type { IngestionJobPayload } from "./features/ingestion/types";

/**
 * Ingestion worker entrypoint: consumes the `source-ingestion` BullMQ queue
 * and runs each job through the fetch → extract → chunk → embed → index
 * pipeline (see `features/ingestion/pipeline.ts`).
 */
async function main() {
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
      connection: getRedis(),
      concurrency: env.INGESTION_WORKER_CONCURRENCY,
    },
  );

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
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((error) => {
  console.error("worker failed to start", error);
  process.exit(1);
});
