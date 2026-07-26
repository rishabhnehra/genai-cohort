"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { AppError, ErrorCodes } from "@/lib/errors";
import { requiredUser } from "../auth/actions/required-user";
import { checkNotebookExists, checkSourceExists } from "../utils";
import { enqueueSourceIngestion } from "../ingestion/queue";
import { deleteSourcePoints } from "../ingestion/index-qdrant";

export async function listSources(notebookId: string) {
  const user = await requiredUser();
  await checkNotebookExists(notebookId, user.id);

  return prisma.source.findMany({
    where: { notebookId, userId: user.id },
    orderBy: { createdAt: "desc" },
  });
}

/** Lightweight polling payload — just enough to drive status badges/progress bars. */
export async function getSourceStatuses(notebookId: string) {
  const user = await requiredUser();
  await checkNotebookExists(notebookId, user.id);

  return prisma.source.findMany({
    where: { notebookId, userId: user.id },
    select: {
      id: true,
      status: true,
      stage: true,
      progress: true,
      errorCode: true,
      errorMessage: true,
      chunkCount: true,
      indexVersion: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteSource(sourceId: string) {
  const user = await requiredUser();
  const source = await checkSourceExists(sourceId, user.id);

  await prisma.source.update({ where: { id: sourceId }, data: { status: "DELETING" } });

  await deleteSourcePoints(sourceId).catch(() => {});

  if (source.storageKey) {
    const bucket = source.type === "WEB" ? "web-snapshots" : "uploads";
    await storage.delete(bucket, source.storageKey).catch(() => {});
  }

  if (source.extractedKey) {
    await storage.delete("extracted", source.extractedKey).catch(() => {});
  }

  await prisma.source.delete({ where: { id: sourceId } });

  revalidatePath(`/notebooks/${source.notebookId}`);

  return { id: sourceId };
}

/** Retries a failed source by bumping its index version and re-queuing it. */
export async function retrySource(sourceId: string) {
  const user = await requiredUser();
  const source = await checkSourceExists(sourceId, user.id);

  if (source.status !== "FAILED") {
    throw new AppError(ErrorCodes.VALIDATION, "Only failed sources can be retried.");
  }

  const nextIndexVersion = source.indexVersion + 1;

  const updated = await prisma.source.update({
    where: { id: sourceId },
    data: {
      status: "QUEUED",
      stage: "QUEUED",
      progress: 0,
      errorCode: null,
      errorMessage: null,
      indexVersion: nextIndexVersion,
    },
  });

  const { jobId } = await enqueueSourceIngestion({
    sourceId: updated.id,
    userId: user.id,
    notebookId: updated.notebookId,
    indexVersion: nextIndexVersion,
  });

  return prisma.source.update({ where: { id: sourceId }, data: { jobId } });
}
