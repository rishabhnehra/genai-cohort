import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { AppError, ErrorCodes, toApiErrorResponse } from "@/lib/errors";
import { requiredUser } from "@/features/auth/actions/required-user";
import { checkSourceExists } from "@/features/utils";

export const runtime = "nodejs";

/** Serves a source's extracted artifact (PDF pages / SRT cues / web text) for the citation viewer. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> },
) {
  try {
    const user = await requiredUser();
    const { sourceId } = await params;
    const source = await checkSourceExists(sourceId, user.id);

    if (!source.extractedKey) {
      throw new AppError(ErrorCodes.NOT_FOUND, "This source hasn't finished processing yet.", { status: 404 });
    }

    const buffer = await storage.read("extracted", source.extractedKey).catch(() => {
      throw new AppError(ErrorCodes.NOT_FOUND, "That data is no longer available.", { status: 404 });
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
