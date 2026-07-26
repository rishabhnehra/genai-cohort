import { prisma } from "@/lib/db";

export async function checkNotebookExists(notebookId: string, userId: string) {
  const notebook = await prisma.notebook.findUnique({
    where: {
      id: notebookId,
      userId,
    },
  });

  if (!notebook) {
    throw new Error(`Notebook doesn't exist for ${userId}`);
  }

  return notebook;
}

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

export async function checkSourceExists(sourceId: string, userId: string) {
  const source = await prisma.source.findUnique({
    where: {
      id: sourceId,
      userId,
    },
  });

  if (!source) {
    throw new Error(`Source doesn't exist for ${userId}`);
  }

  return source;
}
