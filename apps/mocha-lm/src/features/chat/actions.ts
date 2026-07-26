"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requiredUser } from "../auth/actions/required-user";
import { checkConversationExists, checkNotebookExists } from "../utils";

export async function listConversations(notebookId: string) {
  const user = await requiredUser();
  await checkNotebookExists(notebookId, user.id);

  return prisma.conversation.findMany({
    where: { notebookId, userId: user.id },
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getMessages(conversationId: string) {
  const user = await requiredUser();
  await checkConversationExists(conversationId, user.id);

  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createConversation(notebookId: string, title = "New chat") {
  const user = await requiredUser();
  await checkNotebookExists(notebookId, user.id);

  const conversation = await prisma.conversation.create({
    data: { notebookId, userId: user.id, title: title.trim() || "New chat" },
  });

  revalidatePath(`/notebooks/${notebookId}`);

  return conversation;
}

export async function renameConversation(conversationId: string, title: string) {
  const user = await requiredUser();
  const conversation = await checkConversationExists(conversationId, user.id);

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { title: title.trim() || "New chat" },
  });

  revalidatePath(`/notebooks/${conversation.notebookId}`);

  return updated;
}

export async function deleteConversation(conversationId: string) {
  const user = await requiredUser();
  const conversation = await checkConversationExists(conversationId, user.id);

  await prisma.conversation.delete({ where: { id: conversationId } });

  revalidatePath(`/notebooks/${conversation.notebookId}`);

  return { id: conversationId };
}
