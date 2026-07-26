import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { limits } from "@/lib/limits";
import { AppError, ErrorCodes, toApiErrorResponse } from "@/lib/errors";
import { requiredUser } from "@/features/auth/actions/required-user";
import { checkNotebookExists } from "@/features/utils";
import { enqueueSourceIngestion } from "@/features/ingestion/queue";
import { assertPublicHttpUrl } from "@/features/ingestion/ssrf";

export const runtime = "nodejs";

const bodySchema = z.object({
  notebookId: z.string().min(1),
  url: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requiredUser();
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      throw new AppError(ErrorCodes.VALIDATION, "notebookId and url are required.");
    }

    const { notebookId, url } = parsed.data;
    await checkNotebookExists(notebookId, user.id);

    const validatedUrl = await assertPublicHttpUrl(url);

    const existingCount = await prisma.source.count({ where: { notebookId } });
    if (existingCount + 1 > limits.notebook.maxSources) {
      throw new AppError(
        ErrorCodes.LIMIT_EXCEEDED,
        `This notebook can hold at most ${limits.notebook.maxSources} sources.`,
      );
    }

    const source = await prisma.source.create({
      data: {
        notebookId,
        userId: user.id,
        type: "WEB",
        title: validatedUrl.toString(),
        originalUrl: validatedUrl.toString(),
        status: "QUEUED",
        stage: "QUEUED",
      },
    });

    const { jobId } = await enqueueSourceIngestion({
      sourceId: source.id,
      userId: user.id,
      notebookId,
      indexVersion: source.indexVersion,
    });

    const updated = await prisma.source.update({
      where: { id: source.id },
      data: { jobId },
    });

    return NextResponse.json({ source: updated }, { status: 202 });
  } catch (error) {
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
