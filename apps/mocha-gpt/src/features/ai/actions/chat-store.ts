import { isTextUIPart, type UIMessage } from "ai";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

function getMessageText(message: UIMessage) {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}

function toUIMessageParts(
  parts: Prisma.JsonValue | null,
  content: string,
): UIMessage["parts"] {
  const stored = parts as UIMessage["parts"] | null;
  if (Array.isArray(stored) && stored.length > 0) {
    return stored;
  }

  return [{ type: "text", text: content }];
}

export async function loadChatMessages(conversationId: string) {
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return rows.map<UIMessage>((row) => ({
    id: row.id,
    role: row.role === "ASSISTANT" ? "assistant" : "user",
    parts: toUIMessageParts(row.parts, row.content),
  }));
}

export async function saveChatMessages(
  conversationId: string,
  messages: UIMessage[],
  options = { updateTitle: true },
) {
  // TODO: Use Promise.allSettled as performance optimisation
  for (const message of messages) {
    if (message.role === "system") continue;

    const content = getMessageText(message);
    const role = message.role === "assistant" ? "ASSISTANT" : "USER";

    await prisma.message.upsert({
      where: {
        id: message.id,
      },
      create: {
        id: message.id,
        conversationId,
        role,
        status: "COMPLETE",
        content,
        parts: message.parts as Prisma.InputJsonValue,
      },
      update: {
        content,
        status: "COMPLETE",
        parts: message.parts as Prisma.InputJsonValue,
      },
    });
  }
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: {
      id: conversationId,
    },
    select: { title: true },
  });

  // Logic to update the conversation title based on user's first message
  const firstUserMessage = messages.find((message) => message.role === "user");
  const firstUserMessageText = firstUserMessage
    ? getMessageText(firstUserMessage).trim()
    : "";

  await prisma.conversation.update({
    where: {
      id: conversationId,
    },
    data: {
      title:
        !!options.updateTitle &&
        conversation.title === "New Chat" &&
        firstUserMessageText
          ? firstUserMessageText.slice(0.48)
          : conversation.title,
    },
  });
}
