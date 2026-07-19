"use server";

import { checkConversationExists } from "@/lib/utils";
import { requiredUser } from "../auth/actions/required-user";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function listMessages(conversationId: string) {
  const user = await requiredUser();
  await checkConversationExists(conversationId, user.id);

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
    },
    orderBy: { createdAt: "asc" },
  });

  return messages;
}

export async function createMessages(conversationId: string, content: string) {
  const user = await requiredUser();
  const conversation = await checkConversationExists(conversationId, user.id);
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    throw new Error("Message cannot be empty");
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      content: trimmedContent,
      role: "USER",
      status: "COMPLETE",
    },
  });

  await prisma.conversation.update({
    where: {
      id: conversationId,
    },
    data: {
      lastMessageAt: new Date(),
      title:
        conversation.title === "New Chat" || conversation.title.trim() === ""
          ? trimmedContent.slice(0, 48)
          : conversation.title,
    },
  });

  revalidatePath("/");
  revalidatePath(`/c/${conversation.id}`);

  return message;
}

export async function updateMessage(messageId: string, content: string) {
  const user = await requiredUser();
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    throw new Error("Message cannot be empty");
  }

  const existingMessage = await prisma.message.findUnique({
    where: {
      id: messageId,
    },
    include: {
      conversation: true,
    },
  });

  if (!existingMessage || existingMessage.conversation.userId !== user.id) {
    throw new Error("Message not found");
  }

  const message = await prisma.message.update({
    where: { id: messageId },
    data: { content: trimmedContent },
  });

  revalidatePath(`/c/${existingMessage.conversation.id}`);

  return message;
}

export async function deleteMessage(messageId: string) {
  const user = await requiredUser();

  const existingMessage = await prisma.message.findUnique({
    where: {
      id: messageId,
    },
    include: {
      conversation: true,
    },
  });

  if (!existingMessage || existingMessage.conversation.userId !== user.id) {
    throw new Error("Message not found");
  }

  const message = await prisma.message.delete({
    where: {
      id: messageId,
    },
  });

  revalidatePath(`/c/${existingMessage.conversation.id}`);

  return { id: message.id, conversationId: existingMessage.conversation.id };
}
