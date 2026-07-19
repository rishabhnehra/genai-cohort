"use server";

import { prisma } from "@/lib/db";
import { requiredUser } from "../auth/actions/required-user";
import { revalidatePath } from "next/cache";
import { Conversation } from "@/generated/prisma/client";
import { checkConversationExists } from "../utils";

export async function listConversations() {
  const user = await requiredUser();

  const conversations = await prisma.conversation.findMany({
    where: {
      userId: user.id,
      isArchived: false,
    },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
    // TODO: add "select" projection if needed
  });

  return conversations;
}

export async function getConversation(id: string) {
  const user = await requiredUser();
  const conversation = await checkConversationExists(id, user.id);

  return conversation;
}

export async function createConversation(title = "New chat") {
  const user = await requiredUser();

  const conversation = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: title.trim(),
    },
  });

  return conversation;
}

export async function updateConversation(
  conversationId: string,
  data: Partial<Pick<Conversation, "title" | "isArchived" | "isPinned">>,
) {
  const user = await requiredUser();
  await checkConversationExists(conversationId, user.id);

  const conversation = await prisma.conversation.update({
    where: {
      id: conversationId,
    },
    data: {
      title: data?.title || "New Chat",
      isArchived: data?.isArchived ?? false,
      isPinned: data?.isPinned ?? false,
    },
  });

  revalidatePath("/");
  revalidatePath(`/c/${conversationId}`);

  return conversation;
}

export async function deleteConversation(conversationId: string) {
  const user = await requiredUser();
  await checkConversationExists(conversationId, user.id);

  const conversation = await prisma.conversation.delete({
    where: {
      id: conversationId,
    },
  });

  // Try to remove this and see how Next.js cache behaves
  revalidatePath("/");

  return { id: conversation.id };
}
