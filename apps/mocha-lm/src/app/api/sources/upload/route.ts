import { createHash } from "node:crypto";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { limits } from "@/lib/limits";
import { AppError, ErrorCodes, toApiErrorResponse } from "@/lib/errors";
import { requiredUser } from "@/features/auth/actions/required-user";
import { checkNotebookExists } from "@/features/utils";
import { enqueueSourceIngestion } from "@/features/ingestion/queue";
import type { SourceType } from "@/generated/prisma/enums";

export const runtime = "nodejs";

function resolveSourceType(filename: string, mimeType: string): SourceType | null {
  const ext = path.extname(filename).toLowerCase();

  if (ext === ".pdf" || (limits.upload.allowedMimeTypes.PDF as readonly string[]).includes(mimeType)) {
    return "PDF";
  }

  if (ext === ".srt") {
    return "SRT";
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await requiredUser();

    const formData = await request.formData();
    const notebookId = formData.get("notebookId");
    if (typeof notebookId !== "string" || !notebookId) {
      throw new AppError(ErrorCodes.VALIDATION, "notebookId is required.");
    }

    await checkNotebookExists(notebookId, user.id);

    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
    if (files.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION, "No files were provided.");
    }

    const existingCount = await prisma.source.count({ where: { notebookId } });
    if (existingCount + files.length > limits.notebook.maxSources) {
      throw new AppError(
        ErrorCodes.LIMIT_EXCEEDED,
        `This notebook can hold at most ${limits.notebook.maxSources} sources.`,
      );
    }

    const createdSources = [];

    for (const file of files) {
      if (file.size > limits.upload.maxBytes) {
        throw new AppError(
          ErrorCodes.LIMIT_EXCEEDED,
          `"${file.name}" is too large (max ${Math.round(limits.upload.maxBytes / 1_000_000)}MB).`,
        );
      }

      const sourceType = resolveSourceType(file.name, file.type);
      if (!sourceType) {
        throw new AppError(
          ErrorCodes.UNSUPPORTED_FILE_TYPE,
          `"${file.name}" isn't a supported file type. Upload a PDF or .srt file.`,
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const checksum = createHash("sha256").update(buffer).digest("hex");
      const ext = path.extname(file.name).toLowerCase();

      const source = await prisma.source.create({
        data: {
          notebookId,
          userId: user.id,
          type: sourceType,
          title: file.name,
          originalFilename: file.name,
          mimeType: file.type || null,
          byteSize: file.size,
          checksum,
          status: "QUEUED",
          stage: "QUEUED",
        },
      });

      const storageKey = storage.createKey(user.id, notebookId, source.id, `original${ext}`);
      await storage.write("uploads", storageKey, buffer);

      const { jobId } = await enqueueSourceIngestion({
        sourceId: source.id,
        userId: user.id,
        notebookId,
        indexVersion: source.indexVersion,
      });

      const updated = await prisma.source.update({
        where: { id: source.id },
        data: { storageKey, jobId },
      });

      createdSources.push(updated);
    }

    return NextResponse.json({ sources: createdSources }, { status: 202 });
  } catch (error) {
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
