import type { Job } from "bullmq";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { AppError, ErrorCodes, toSafeErrorPayload } from "@/lib/errors";
import type { ExtractedArtifact, IngestionJobPayload } from "./types";
import { safeFetch } from "./ssrf";
import { parsePdf } from "./parsers/pdf";
import { parseSrt } from "./parsers/srt";
import { parseWebPage } from "./parsers/web";
import { chunkArtifact } from "./chunking";
import { embedTexts } from "./embeddings";
import { indexChunks } from "./index-qdrant";

/**
 * Runs the full ingestion pipeline for a single source: verify → fetch →
 * extract → chunk → embed → index. Progress and stage are persisted to the
 * `Source` row at each step so the UI can poll for status.
 */
export async function processIngestionJob(
  payload: IngestionJobPayload,
  job?: Job<IngestionJobPayload>,
): Promise<void> {
  const source = await prisma.source.findUnique({ where: { id: payload.sourceId } });

  if (!source) return; // source was deleted before the job ran
  if (source.userId !== payload.userId || source.notebookId !== payload.notebookId) return;
  if (source.status === "DELETING") return;
  if (source.indexVersion !== payload.indexVersion) return; // superseded by a newer retry

  try {
    await prisma.source.update({
      where: { id: source.id },
      data: {
        status: "PROCESSING",
        stage: "FETCHING",
        progress: 5,
        startedAt: new Date(),
        errorCode: null,
        errorMessage: null,
      },
    });

    let artifact: ExtractedArtifact;

    if (source.type === "WEB") {
      if (!source.originalUrl) {
        throw new AppError(ErrorCodes.VALIDATION, "This source has no URL to fetch.");
      }

      const { buffer, finalUrl } = await safeFetch(source.originalUrl);
      const parsed = parseWebPage(buffer.toString("utf-8"), finalUrl);
      const snapshotKey = storage.createKey(source.userId, source.notebookId, source.id, "snapshot.html");
      await storage.write("web-snapshots", snapshotKey, parsed.sanitizedHtml);

      await prisma.source.update({
        where: { id: source.id },
        data: { stage: "EXTRACTING", progress: 30, title: parsed.title, storageKey: snapshotKey },
      });

      artifact = {
        type: "web",
        url: finalUrl,
        title: parsed.title,
        text: parsed.text,
        snapshotKey,
      };
    } else {
      if (!source.storageKey) {
        throw new AppError(ErrorCodes.VALIDATION, "This source has no uploaded file.");
      }

      const buffer = await storage.read("uploads", source.storageKey);

      await prisma.source.update({
        where: { id: source.id },
        data: { stage: "EXTRACTING", progress: 30 },
      });

      artifact = source.type === "PDF" ? await parsePdf(buffer) : parseSrt(buffer.toString("utf-8"));
    }

    const extractedKey = storage.createKey(source.userId, source.notebookId, source.id, "extracted.json");
    await storage.write("extracted", extractedKey, JSON.stringify(artifact));

    await prisma.source.update({
      where: { id: source.id },
      data: { extractedKey, stage: "CHUNKING", progress: 50 },
    });

    const chunks = await chunkArtifact(artifact);
    if (chunks.length === 0) {
      throw new AppError(ErrorCodes.EXTRACTION_FAILED, "No text could be extracted from this source.");
    }

    await prisma.source.update({
      where: { id: source.id },
      data: { stage: "EMBEDDING", progress: 65 },
    });

    const vectors = await embedTexts(chunks.map((chunk) => chunk.text));

    await prisma.source.update({
      where: { id: source.id },
      data: { stage: "INDEXING", progress: 85 },
    });

    await indexChunks({
      userId: source.userId,
      notebookId: source.notebookId,
      sourceId: source.id,
      sourceType: source.type,
      sourceTitle: source.title,
      indexVersion: source.indexVersion,
      chunks,
      vectors,
    });

    await prisma.source.update({
      where: { id: source.id },
      data: {
        status: "READY",
        stage: "COMPLETE",
        progress: 100,
        chunkCount: chunks.length,
        completedAt: new Date(),
        indexedAt: new Date(),
      },
    });
  } catch (error) {
    const { errorCode, errorMessage } = toSafeErrorPayload(error);

    await prisma.source
      .update({
        where: { id: source.id },
        data: {
          status: "FAILED",
          stage: "FAILED",
          errorCode,
          errorMessage,
          retryCount: job?.attemptsMade ?? source.retryCount + 1,
        },
      })
      .catch(() => {
        // Best-effort — if this also fails there's nothing more we can do here.
      });

    throw error; // let BullMQ apply its retry/backoff policy
  }
}
