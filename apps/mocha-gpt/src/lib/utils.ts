import { type ClassValue } from "clsx";
import { cn as sharedCn } from "@repo/ui/lib/utils";

export function cn(...inputs: ClassValue[]) {
  return sharedCn(...inputs);
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
