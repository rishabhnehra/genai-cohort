import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
