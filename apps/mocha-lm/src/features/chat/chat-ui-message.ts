import { isTextUIPart, type UIMessage } from "ai";
import type { Prisma } from "@/generated/prisma/client";
import type { MessageRole, MessageStatus } from "@/generated/prisma/enums";
import type { MessageCitation } from "./citations";

export type MochaMessageMetadata = {
  citations?: MessageCitation[];
  debug?: unknown;
  conversationId?: string;
  failed?: boolean;
};

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

export function messageRowToUIMessage(row: {
  id: string;
  role: MessageRole;
  content: string | null;
  parts: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  status: MessageStatus;
}): UIMessage {
  const metadata = row.metadata as MochaMessageMetadata | null;

  return {
    id: row.id,
    role:
      row.role === "ASSISTANT"
        ? "assistant"
        : row.role === "SYSTEM" || row.role === "TOOL"
          ? "system"
          : "user",
    parts: toUIMessageParts(row.parts, row.content ?? ""),
    metadata: {
      ...metadata,
      failed: row.status === "FAILED" || row.status === "CANCELLED" ? true : metadata?.failed,
    },
  };
}

export function getMessageText(message: UIMessage) {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("");
}
