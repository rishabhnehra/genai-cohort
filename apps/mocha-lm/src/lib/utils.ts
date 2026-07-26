import { type ClassValue } from "clsx";
import { cn as sharedCn } from "@repo/ui/lib/utils";

export function cn(...inputs: ClassValue[]) {
  return sharedCn(...inputs);
}

export const queryKeys = {
  notebooks: {
    all: ["notebooks"],
    detail: (id: string) => ["notebooks", id],
  },
  sources: {
    byNotebook: (notebookId: string) => ["sources", notebookId],
    detail: (id: string) => ["sources", "detail", id],
  },
  conversations: {
    byNotebook: (notebookId: string) => ["conversations", notebookId],
    detail: (id: string) => ["conversations", "detail", id],
  },
  messages: {
    byConversation: (conversationId: string) => ["messages", conversationId],
  },
};
