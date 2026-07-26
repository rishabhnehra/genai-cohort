"use client";

import { useState } from "react";
import {
  MessageSquareIcon,
  PlusIcon,
  SendIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@repo/ui/button";
import { Bubble, BubbleContent, BubbleGroup } from "@repo/ui/bubble";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/empty";
import { Message, MessageContent } from "@repo/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@repo/ui/message-scroller";
import { Textarea } from "@repo/ui/textarea";

import { cn } from "@/lib/utils";
import {
  canonicalizeCitationIndexes,
  type MessageCitation,
} from "../citations";
import {
  useChatStream,
  useConversations,
  useDeleteConversation,
  useMessages,
  type MessageListItem,
} from "../hooks";
import { MarkdownMessage } from "./markdown-message";

export type ChatPaneProps = {
  notebookId: string;
  /** READY source IDs currently included in chat context (after opt-out). */
  selectedSourceIds: string[];
  /** Whether the notebook has any READY sources (even if all are disabled). */
  hasReadySources: boolean;
  selectedConversationId: string | null | undefined;
  onSelectedConversationIdChange: (id: string | null) => void;
  onCitationClick: (citation: MessageCitation) => void;
};

type RenderableMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: MessageCitation[];
  failed?: boolean;
};

function toRenderable(message: MessageListItem): RenderableMessage {
  const metadata = message.metadata as { citations?: MessageCitation[] } | null;
  return {
    id: message.id,
    role: message.role === "USER" ? "user" : "assistant",
    content: message.content ?? "",
    citations: metadata?.citations ?? [],
    failed: message.status === "FAILED",
  };
}

/**
 * Center workspace pane: streamed chat grounded in the currently-active
 * sources (READY sources minus any the user disabled), with inline [n]
 * citation buttons wired up to the citation viewer. Conversation switching
 * lives in the left pane's Chat History section.
 */
export function ChatPane({
  notebookId,
  selectedSourceIds,
  hasReadySources,
  selectedConversationId,
  onSelectedConversationIdChange,
  onCitationClick,
}: ChatPaneProps) {
  const { data: conversations } = useConversations(notebookId);
  const deleteConversation = useDeleteConversation(notebookId);

  // `undefined` = "no explicit choice yet, default to the most recent chat".
  // `null` = "explicitly started a new, not-yet-persisted chat".
  const conversationId =
    selectedConversationId === undefined
      ? conversations?.[0]?.id
      : (selectedConversationId ?? undefined);
  const activeConversation = conversations?.find(
    (conversation) => conversation.id === conversationId,
  );

  const { data: messages } = useMessages(conversationId);
  const { pendingMessages, isStreaming, sendMessage } = useChatStream({
    notebookId,
    conversationId,
    selectedSourceIds,
    onConversationCreated: (newConversationId) =>
      onSelectedConversationIdChange(newConversationId),
  });

  const [input, setInput] = useState("");
  const canAsk = selectedSourceIds.length > 0 && !isStreaming;
  const allMessages: RenderableMessage[] = [
    ...(messages ?? []).map(toRenderable),
    ...pendingMessages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      citations: message.citations,
      failed: message.status === "failed",
    })),
  ];
  const hasMessages = allMessages.length > 0;

  const emptyDescription = !hasReadySources
    ? "Add a source on the left, then ask a question about this notebook."
    : selectedSourceIds.length === 0
      ? "Enable at least one source on the left to chat."
      : "Ask a question — answers will cite exactly where they came from.";

  const inputPlaceholder = !hasReadySources
    ? "Add a ready source to start chatting..."
    : selectedSourceIds.length === 0
      ? "Enable a source to start chatting..."
      : "Ask a question about your sources...";

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !canAsk) return;
    setInput("");
    void sendMessage(trimmed);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b p-3">
        <div className="flex min-w-0 items-center gap-2 px-1">
          <MessageSquareIcon className="size-4 shrink-0" />
          <span className="truncate text-sm font-medium">
            {activeConversation?.title ?? "New chat"}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {activeConversation && (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Delete this chat"
              onClick={() => {
                deleteConversation.mutate(activeConversation.id);
                onSelectedConversationIdChange(null);
              }}
            >
              <Trash2Icon />
              <span className="sr-only">Delete this chat</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            title="New chat"
            onClick={() => onSelectedConversationIdChange(null)}
          >
            <PlusIcon />
            <span className="sr-only">New chat</span>
          </Button>
        </div>
      </div>

      {!hasMessages ? (
        <div className="flex flex-1 flex-col overflow-y-auto p-3">
          <Empty className="flex-1">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SparklesIcon />
              </EmptyMedia>
              <EmptyTitle>Ask this notebook anything</EmptyTitle>
              <EmptyDescription>
                {emptyDescription}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      ) : (
        <MessageScrollerProvider>
          <MessageScroller className="flex-1">
            <MessageScrollerViewport>
              <MessageScrollerContent className="w-full gap-4 px-4 py-4 sm:px-6">
                {allMessages.map((message, index) => (
                  <MessageScrollerItem
                    key={message.id}
                    scrollAnchor={index === allMessages.length - 1}
                  >
                    <ChatBubble message={message} onCitationClick={onCitationClick} />
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        </MessageScrollerProvider>
      )}

      <div className="flex shrink-0 items-end gap-2 border-t p-3">
        <Textarea
          placeholder={inputPlaceholder}
          value={input}
          disabled={selectedSourceIds.length === 0}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          className="min-h-10 flex-1 resize-none text-base md:text-base"
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim() || !canAsk}>
          <SendIcon />
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </div>
  );
}

type ContentPart =
  | { type: "text"; text: string }
  | { type: "citation"; citation: MessageCitation };

function splitCitations(
  text: string,
  citationsByIndex: Map<number, MessageCitation>,
  indexMap: Map<number, number>,
): ContentPart[] {
  const parts: ContentPart[] = [];
  const regex = /\[C?(\d+)\]/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let lastDisplayIndex: number | null = null;

  while ((match = regex.exec(text))) {
    const rawIndex = Number(match[1]);
    const displayIndex = indexMap.get(rawIndex) ?? rawIndex;
    const citation =
      citationsByIndex.get(displayIndex) ?? citationsByIndex.get(rawIndex);
    if (!citation) continue;

    if (match.index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
      lastDisplayIndex = null;
    }

    if (lastDisplayIndex === displayIndex && parts.at(-1)?.type === "citation") {
      lastIndex = match.index + match[0].length;
      continue;
    }

    parts.push({
      type: "citation",
      citation: { ...citation, index: displayIndex },
    });
    lastDisplayIndex = displayIndex;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }

  return parts;
}

function ChatBubble({
  message,
  onCitationClick,
}: {
  message: RenderableMessage;
  onCitationClick: (citation: MessageCitation) => void;
}) {
  const isUser = message.role === "user";
  const indexMap = canonicalizeCitationIndexes(message.citations);
  const citationsByIndex = new Map(
    message.citations.map((citation) => [
      indexMap.get(citation.index) ?? citation.index,
      { ...citation, index: indexMap.get(citation.index) ?? citation.index },
    ]),
  );
  // Keep raw indexes too so pre-normalization streamed answers still resolve.
  for (const citation of message.citations) {
    if (!citationsByIndex.has(citation.index)) {
      citationsByIndex.set(citation.index, citation);
    }
  }

  return (
    <Message align={isUser ? "end" : "start"}>
      <MessageContent>
        <BubbleGroup>
          <Bubble
            variant={isUser ? "default" : message.failed ? "destructive" : "secondary"}
            align={isUser ? "end" : "start"}
            className="max-w-[70%]"
          >
            <BubbleContent
              className={cn(
                "max-w-full px-3.5 py-2.5 text-base leading-relaxed",
                isUser ? "whitespace-pre-wrap" : "w-full",
              )}
            >
              {isUser ? (
                <UserPlainText
                  content={message.content.trim()}
                  citationsByIndex={citationsByIndex}
                  indexMap={indexMap}
                  onCitationClick={onCitationClick}
                />
              ) : (
                <MarkdownMessage
                  content={message.content}
                  citationsByIndex={citationsByIndex}
                  indexMap={indexMap}
                  onCitationClick={onCitationClick}
                />
              )}
            </BubbleContent>
          </Bubble>
        </BubbleGroup>
      </MessageContent>
    </Message>
  );
}

/** Plain-text renderer for user bubbles (no markdown). */
function UserPlainText({
  content,
  citationsByIndex,
  indexMap,
  onCitationClick,
}: {
  content: string;
  citationsByIndex: Map<number, MessageCitation>;
  indexMap: Map<number, number>;
  onCitationClick: (citation: MessageCitation) => void;
}) {
  const parts = splitCitations(content, citationsByIndex, indexMap);
  if (parts.length === 0) {
    return <span className="text-muted-foreground">…</span>;
  }

  return (
    <>
      {parts.map((part, index) =>
        part.type === "text" ? (
          <span key={index}>{part.text}</span>
        ) : (
          <button
            key={index}
            type="button"
            onClick={() => onCitationClick(part.citation)}
            className={cn(
              "mx-0.5 inline-flex size-5 -translate-y-0.5 items-center justify-center rounded-full bg-primary/15 align-middle text-xs font-medium text-primary transition-colors hover:bg-primary/25",
            )}
          >
            {part.citation.index}
          </button>
        ),
      )}
    </>
  );
}
