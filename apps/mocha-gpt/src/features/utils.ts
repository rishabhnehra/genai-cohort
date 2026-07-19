import { prisma } from "@/lib/db";

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
