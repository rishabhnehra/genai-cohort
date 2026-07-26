import { NextRequest, NextResponse } from "next/server";
import { toApiErrorResponse } from "@/lib/errors";
import { getSourceStatuses } from "@/features/sources/actions";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const notebookId = request.nextUrl.searchParams.get("notebookId");
    if (!notebookId) {
      return NextResponse.json({ error: "notebookId is required." }, { status: 400 });
    }

    const statuses = await getSourceStatuses(notebookId);
    return NextResponse.json({ sources: statuses });
  } catch (error) {
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
