import { NextRequest, NextResponse } from "next/server";
import { createTextStreamResponse, streamText } from "ai";
import { z } from "zod";
import { openrouter } from "@/lib/openrouter";
import { env } from "@/lib/env";
import { limits } from "@/lib/limits";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes, toApiErrorResponse } from "@/lib/errors";
import { requiredUser } from "@/features/auth/actions/required-user";
import { checkNotebookExists } from "@/features/utils";
import { retrieveContext } from "@/features/retrieval/pipeline";
import { buildCitationsFromChunks, formatContextBlock, normalizeCitedAnswer } from "@/features/chat/citations";

export const runtime = "nodejs";

const bodySchema = z.object({
  notebookId: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  message: z.string().min(1).max(limits.chat.maxMessageChars),
  selectedSourceIds: z.array(z.string().min(1)).default([]),
});

const SYSTEM_PROMPT_HEADER = `You are Mocha LM's research assistant. Answer the user's question using ONLY the numbered source excerpts provided below — never rely on outside knowledge.

Rules:
- Cite every factual claim with the excerpt number(s) it came from, using the format [1], [2], placed right after the relevant sentence or clause. You may stack citations from different locations, e.g. [1][3].
- Prefer a single citation when multiple excerpts are from the same page or passage — do not stack redundant same-location citations.
- Never invent a citation number that isn't in the excerpt list below.
- If the excerpts don't contain enough information to answer, say so plainly instead of guessing.
- Format answers in clear Markdown: short paragraphs, **bold** for key terms, and bulleted or numbered lists when listing points. Use ### headings sparingly for longer multi-section answers. Do not wrap the entire answer in a code fence.`;

function encodeBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf-8").toString("base64");
}

export async function POST(request: NextRequest) {
  try {
    const user = await requiredUser();
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      throw new AppError(ErrorCodes.VALIDATION, "A message and notebookId are required.");
    }

    const { notebookId, message, selectedSourceIds } = parsed.data;
    await checkNotebookExists(notebookId, user.id);

    let conversation = parsed.data.conversationId
      ? await prisma.conversation.findFirst({
          where: { id: parsed.data.conversationId, userId: user.id, notebookId },
        })
      : null;

    if (parsed.data.conversationId && !conversation) {
      throw new AppError(ErrorCodes.NOT_FOUND, "Conversation not found.", { status: 404 });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { notebookId, userId: user.id, title: message.slice(0, 80) },
      });
    }

    const conversationId = conversation.id;

    const readySources = await prisma.source.findMany({
      where: {
        notebookId,
        userId: user.id,
        status: "READY",
        ...(selectedSourceIds.length > 0 ? { id: { in: selectedSourceIds } } : {}),
      },
      select: { id: true, indexVersion: true },
    });
    const sourceFilters = readySources.map((source) => ({ sourceId: source.id, indexVersion: source.indexVersion }));

    await prisma.message.create({
      data: { conversationId, role: "USER", status: "COMPLETE", content: message },
    });

    const { chunks, debug } = await retrieveContext({
      userId: user.id,
      notebookId,
      sources: sourceFilters,
      query: message,
    });

    const citations = buildCitationsFromChunks(chunks);
    const contextBlock =
      chunks.length > 0
        ? formatContextBlock(chunks)
        : "(No relevant excerpts were found in the selected sources. Tell the user you couldn't find supporting material.)";

    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limits.chat.historyMessages,
    });

    const modelMessages = history
      .reverse()
      .filter((entry) => entry.role === "USER" || entry.role === "ASSISTANT")
      .map((entry) => ({
        role: entry.role === "USER" ? ("user" as const) : ("assistant" as const),
        content: entry.content ?? "",
      }));

    const assistantMessage = await prisma.message.create({
      data: { conversationId, role: "ASSISTANT", status: "STREAMING", content: "" },
    });

    const result = streamText({
      model: openrouter.chat(env.CHAT_MODEL),
      system: `${SYSTEM_PROMPT_HEADER}\n\nSource excerpts:\n${contextBlock}`,
      messages: modelMessages,
      temperature: 0.2,
      onFinish: async ({ text }) => {
        // Collapse same-location markers (e.g. [3][10] both on page 19 → [3])
        // so persisted content and citation chips stay in sync.
        const { text: normalizedText, citations: usedCitations } = normalizeCitedAnswer(
          text,
          citations,
        );
        await prisma.message
          .update({
            where: { id: assistantMessage.id },
            data: {
              content: normalizedText,
              status: "COMPLETE",
              metadata: { citations: usedCitations, debug },
            },
          })
          .catch(() => {});
        await prisma.conversation
          .update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } })
          .catch(() => {});
      },
      onError: async (event) => {
        console.error("chat stream failed", event.error);
        await prisma.message
          .update({ where: { id: assistantMessage.id }, data: { status: "FAILED" } })
          .catch(() => {});
      },
    });

    const response = createTextStreamResponse({ stream: result.textStream });
    response.headers.set("X-Mocha-Conversation-Id", conversationId);
    response.headers.set("X-Mocha-Citations", encodeBase64Json(citations));
    return response;
  } catch (error) {
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
