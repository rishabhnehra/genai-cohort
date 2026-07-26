import { Queue } from "bullmq";
import { getRedis } from "@/lib/redis";
import { limits } from "@/lib/limits";
import type { IngestionJobPayload } from "./types";

export const SOURCE_INGESTION_QUEUE = "source-ingestion";

declare global {
  var __mochaLmIngestionQueue: Queue<IngestionJobPayload> | undefined;
}

function getSourceIngestionQueue() {
  if (!globalThis.__mochaLmIngestionQueue) {
    globalThis.__mochaLmIngestionQueue = new Queue<IngestionJobPayload>(
      SOURCE_INGESTION_QUEUE,
      {
        connection: getRedis(),
        defaultJobOptions: {
          attempts: limits.ingestion.attempts,
          backoff: {
            type: "exponential",
            delay: limits.ingestion.backoffMs,
          },
          removeOnComplete: { count: limits.ingestion.removeOnCompleteCount },
          removeOnFail: { count: limits.ingestion.removeOnFailCount },
        },
      },
    );
  }

  return globalThis.__mochaLmIngestionQueue;
}

function jobIdFor(payload: IngestionJobPayload) {
  return `source:${payload.sourceId}:v${payload.indexVersion}`;
}

/** Enqueues (or re-enqueues, on retry) a source for ingestion. */
export async function enqueueSourceIngestion(payload: IngestionJobPayload) {
  const jobId = jobIdFor(payload);

  const job = await getSourceIngestionQueue().add("ingest-source", payload, {
    jobId,
  });

  return { jobId: job.id ?? jobId };
}
