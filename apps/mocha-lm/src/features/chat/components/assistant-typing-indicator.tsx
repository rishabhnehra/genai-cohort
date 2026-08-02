"use client";

import type { ChatStatus, UIMessage } from "ai";

import { Message, MessageContent } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";
import { getMessageTextFromUIMessage } from "../use-mocha-chat";

export function shouldShowAssistantTypingIndicator(
  messages: UIMessage[],
  status: ChatStatus,
) {
  const lastMessage = messages.at(-1);

  if (
    lastMessage?.role === "assistant" &&
    getMessageTextFromUIMessage(lastMessage).trim().length === 0
  ) {
    // Keep showing through the brief gap when status flips to ready before text lands.
    return true;
  }

  if (status !== "submitted" && status !== "streaming") {
    return false;
  }

  if (!lastMessage) {
    return true;
  }

  return lastMessage.role === "user";
}

type AssistantTypingIndicatorProps = {
  className?: string;
};

/** Shimmer loading state shown while waiting for the assistant reply. */
export function AssistantTypingIndicator({ className }: AssistantTypingIndicatorProps) {
  return (
    <Message from="assistant" className={className}>
      <MessageContent className={cn("px-1 py-1")}>
        <span aria-label="Assistant is thinking" role="status">
          <Shimmer className="text-sm" duration={1.5}>
            Thinking…
          </Shimmer>
        </span>
      </MessageContent>
    </Message>
  );
}
