import type { UIMessage } from "ai";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  getMessageText,
  messageRowToUIMessage,
  type MochaMessageMetadata,
} from "./chat-ui-message";

export type { MochaMessageMetadata } from "./chat-ui-message";
export { messageRowToUIMessage } from "./chat-ui-message";

export async function loadChatMessages(conversationId: string) {
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return rows
    .filter((row) => row.status !== "STREAMING")
    .map(messageRowToUIMessage);
}

/**
 * Drop trailing assistant turns before regenerating.
 * The most recent assistant id is reused so persistence updates that row
 * instead of inserting a duplicate; any older trailing assistants are orphans.
 */
export function stripTrailingAssistantMessages(messages: UIMessage[]) {
  const removedIds: string[] = [];
  let next = messages;

  while (next.length > 0 && next.at(-1)?.role === "assistant") {
    removedIds.push(next.at(-1)!.id);
    next = next.slice(0, -1);
  }

  return {
    messages: next,
    replaceAssistantId: removedIds[0] as string | undefined,
    orphanAssistantIds: removedIds.slice(1),
  };
}

export async function deleteChatMessages(
  conversationId: string,
  messageIds: string[],
) {
  if (messageIds.length === 0) return;

  await prisma.message.deleteMany({
    where: { conversationId, id: { in: messageIds } },
  });
}

export async function saveChatMessages(
  conversationId: string,
  messages: UIMessage[],
  options: {
    updateTitle?: boolean;
    assistantMetadata?: MochaMessageMetadata;
  } = {},
) {
  for (const message of messages) {
    if (message.role === "system") continue;

    const content = getMessageText(message);
    const role = message.role === "assistant" ? "ASSISTANT" : "USER";
    const metadata =
      message.role === "assistant" && options.assistantMetadata
        ? { ...(message.metadata as MochaMessageMetadata | undefined), ...options.assistantMetadata }
        : (message.metadata as MochaMessageMetadata | undefined);

    const status =
      metadata?.failed === true ? "FAILED" : content.trim() ? "COMPLETE" : "STREAMING";

    await prisma.message.upsert({
      where: { id: message.id },
      create: {
        id: message.id,
        conversationId,
        role,
        status,
        content,
        parts: message.parts as Prisma.InputJsonValue,
        metadata: metadata as Prisma.InputJsonValue,
      },
      update: {
        content,
        status,
        parts: message.parts as Prisma.InputJsonValue,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    select: { title: true },
  });

  const firstUserMessage = messages.find((message) => message.role === "user");
  const firstUserMessageText = firstUserMessage ? getMessageText(firstUserMessage).trim() : "";

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      title:
        options.updateTitle !== false &&
        conversation.title === "New chat" &&
        firstUserMessageText
          ? firstUserMessageText.slice(0, 80)
          : conversation.title,
    },
  });
}
