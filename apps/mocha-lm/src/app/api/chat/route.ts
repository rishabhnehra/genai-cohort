import { NextRequest, NextResponse } from "next/server";
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  buildCitationsFromChunks,
  formatContextBlock,
  normalizeCitedAnswer,
} from "@/features/chat/citations";
import {
  getMessageText,
  type MochaMessageMetadata,
} from "@/features/chat/chat-ui-message";
import {
  deleteChatMessages,
  loadChatMessages,
  saveChatMessages,
  stripTrailingAssistantMessages,
} from "@/features/chat/chat-store";
import { requiredUser } from "@/features/auth/actions/required-user";
import { checkNotebookExists } from "@/features/utils";
import { retrieveContext } from "@/features/retrieval/pipeline";
import { openrouter } from "@/lib/openrouter";
import { env } from "@/lib/env";
import { limits } from "@/lib/limits";
import { prisma } from "@/lib/db";
import { AppError, ErrorCodes, toApiErrorResponse } from "@/lib/errors";

export const runtime = "nodejs";

const uiMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(z.record(z.unknown())),
  metadata: z.record(z.unknown()).optional(),
});

const bodySchema = z.object({
  id: z.string().min(1).optional(),
  message: uiMessageSchema,
  notebookId: z.string().min(1),
  selectedSourceIds: z.array(z.string().min(1)).default([]),
  trigger: z.enum(["submit-message", "regenerate-message"]).optional(),
});

const SYSTEM_PROMPT_HEADER = `You are Mocha LM's research assistant. Answer the user's question using ONLY the numbered source excerpts provided below — never rely on outside knowledge.

Rules:
- Cite every factual claim with the excerpt number(s) it came from, using the format [1], [2], placed right after the relevant sentence or clause. You may stack citations from different locations, e.g. [1][3].
- Prefer a single citation when multiple excerpts are from the same page or passage — do not stack redundant same-location citations.
- Never invent a citation number that isn't in the excerpt list below.
- If the excerpts don't contain enough information to answer, say so plainly instead of guessing.
- Format answers in clear Markdown: short paragraphs, **bold** for key terms, and bulleted or numbered lists when listing points. Use ### headings sparingly for longer multi-section answers. Do not wrap the entire answer in a code fence.`;

const DRAFT_CHAT_ID = "new-chat";

export async function POST(request: NextRequest) {
  try {
    const user = await requiredUser();
    const json = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);

    if (!parsed.success) {
      throw new AppError(ErrorCodes.VALIDATION, "A message and notebookId are required.");
    }

    const { notebookId, message, selectedSourceIds, trigger } = parsed.data;
    const userMessage = message as UIMessage;
    const userText = getMessageText(userMessage).trim();

    if (!userText) {
      throw new AppError(ErrorCodes.VALIDATION, "Message text is required.");
    }

    await checkNotebookExists(notebookId, user.id);

    if (selectedSourceIds.length === 0) {
      throw new AppError(ErrorCodes.VALIDATION, "No sources selected.");
    }

    const requestedConversationId =
      parsed.data.id && parsed.data.id !== DRAFT_CHAT_ID ? parsed.data.id : undefined;

    let conversation = requestedConversationId
      ? await prisma.conversation.findFirst({
          where: { id: requestedConversationId, userId: user.id, notebookId },
        })
      : null;

    if (requestedConversationId && !conversation) {
      throw new AppError(ErrorCodes.NOT_FOUND, "Conversation not found.", { status: 404 });
    }

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { notebookId, userId: user.id, title: userText.slice(0, 80) },
      });
    }

    const conversationId = conversation.id;

    const readySources = await prisma.source.findMany({
      where: {
        notebookId,
        userId: user.id,
        status: "READY",
        id: { in: selectedSourceIds },
      },
      select: { id: true, indexVersion: true },
    });
    const sourceFilters = readySources.map((source) => ({
      sourceId: source.id,
      indexVersion: source.indexVersion,
    }));

    let messages = requestedConversationId ? await loadChatMessages(conversationId) : [];
    let replaceAssistantId: string | undefined;

    if (trigger === "regenerate-message") {
      const prepared = stripTrailingAssistantMessages(messages);
      messages = prepared.messages;
      replaceAssistantId = prepared.replaceAssistantId;
      if (prepared.orphanAssistantIds.length > 0) {
        await deleteChatMessages(conversationId, prepared.orphanAssistantIds);
      }
    } else {
      const alreadySaved = messages.some((entry) => entry.id === userMessage.id);
      messages = alreadySaved ? messages : [...messages, userMessage];
      if (!alreadySaved) {
        await saveChatMessages(conversationId, [userMessage], { updateTitle: false });
      }
    }

    const { chunks, debug } = await retrieveContext({
      userId: user.id,
      notebookId,
      sources: sourceFilters,
      query: userText,
    });

    const citations = buildCitationsFromChunks(chunks);
    const contextBlock =
      chunks.length > 0
        ? formatContextBlock(chunks)
        : "(No relevant excerpts were found in the selected sources. Tell the user you couldn't find supporting material.)";

    const history = messages
      .filter((entry) => entry.role === "user" || entry.role === "assistant")
      .slice(-limits.chat.historyMessages);

    const result = streamText({
      model: openrouter.chat(env.CHAT_MODEL),
      system: `${SYSTEM_PROMPT_HEADER}\n\nSource excerpts:\n${contextBlock}`,
      messages: await convertToModelMessages(history),
      temperature: 0.2,
    });

    result.consumeStream();

    let assistantMetadata: MochaMessageMetadata = {
      citations,
      debug,
      conversationId,
    };

    const fallbackMessageId = createIdGenerator({ prefix: "msg", size: 16 });
    let assistantIdToReuse = replaceAssistantId;

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        originalMessages: messages,
        // Reuse the prior assistant id on regenerate so upsert replaces the row.
        generateMessageId: () => {
          if (assistantIdToReuse) {
            const id = assistantIdToReuse;
            assistantIdToReuse = undefined;
            return id;
          }
          return fallbackMessageId();
        },
        messageMetadata: ({ part }) => {
          if (part.type === "finish") {
            return assistantMetadata;
          }
          if (part.type === "start") {
            return { conversationId };
          }
          return undefined;
        },
        onEnd: async ({ messages: finalMessages }) => {
          try {
            const lastAssistant = [...finalMessages].reverse().find((entry) => entry.role === "assistant");
            if (lastAssistant) {
              const rawText = getMessageText(lastAssistant);
              const { text: normalizedText, citations: usedCitations } = normalizeCitedAnswer(
                rawText,
                citations,
              );
              assistantMetadata = {
                citations: usedCitations,
                debug,
                conversationId,
              };
              const normalizedAssistant: UIMessage = {
                ...lastAssistant,
                parts: [{ type: "text", text: normalizedText }],
                metadata: assistantMetadata,
              };
              const persistedMessages = finalMessages.map((entry) =>
                entry.id === lastAssistant.id ? normalizedAssistant : entry,
              );
              await saveChatMessages(conversationId, persistedMessages, {
                assistantMetadata,
              });
            } else {
              await saveChatMessages(conversationId, finalMessages);
            }
          } catch (error) {
            console.error("Failed to persist chat messages", error);
          }
        },
      }),
    });
  } catch (error) {
    const { status, body } = toApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
