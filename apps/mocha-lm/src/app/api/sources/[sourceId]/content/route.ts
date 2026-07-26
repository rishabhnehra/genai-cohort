import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { AppError, ErrorCodes, toApiErrorResponse } from "@/lib/errors";
import { requiredUser } from "@/features/auth/actions/required-user";
import { checkSourceExists } from "@/features/utils";

export const runtime = "nodejs";

const CONTENT_TYPE_BY_SOURCE_TYPE: Record<string, string> = {
  PDF: "application/pdf",
  SRT: "text/plain; charset=utf-8",
  WEB: "text/html; charset=utf-8",
};

/** Serves a source's original content (uploaded file or sanitized web snapshot) for the citation viewer. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  try {
    const user = await requiredUser();
    const { sourceId } = await params;
    const source = await checkSourceExists(sourceId, user.id);

    if (!source.storageKey) {
      throw new AppError(ErrorCodes.NOT_FOUND, "This source has no content to display.", { status: 404 });
    }

    const bucket = source.type === "WEB" ? "web-snapshots" : "uploads";
    const buffer = await storage.read(bucket, source.storageKey).catch(() => {
      throw new AppError(ErrorCodes.NOT_FOUND, "That file is no longer available.", { status: 404 });
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": CONTENT_TYPE_BY_SOURCE_TYPE[source.type] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
