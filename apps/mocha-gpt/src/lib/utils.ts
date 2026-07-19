import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { prisma } from "./db";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const queryKeys = {
  conversations: {
    all: ["conversations"],
    detail: (id: string) => ["conversations", id],
  },
  messages: {
    byConversation: (conversationId: string) => ["messages", conversationId],
  },
};

export async function checkConversationExists(
  conversationId: string,
  userId: string,
) {
  const conversation = await prisma.conversation.findUnique({
    where: {
      id: conversationId,
      userId,
    },
  });

  if (!conversation) {
    throw new Error(`Conversation doesn't exist for ${userId}`);
  }

  return conversation;
}
