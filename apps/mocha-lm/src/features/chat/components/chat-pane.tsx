"use client";

import { useState } from "react";
import {
  CopyIcon,
  MessageSquareIcon,
  PlusIcon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import type { UIMessage } from "ai";

import { Button } from "@repo/ui/button";
import { Skeleton } from "@repo/ui/skeleton";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { cn } from "@/lib/utils";
import {
  citationPublicUrl,
  formatCitationLocatorSummary,
  uniqueCitationsForSources,
  type MessageCitation,
} from "../citations";
import type { MochaMessageMetadata } from "../chat-ui-message";
import {
  useConversations,
  useDeleteConversation,
  useMessages,
} from "../hooks";
import {
  getMessageTextFromUIMessage,
  useMochaChat,
} from "../use-mocha-chat";
import { CitationMessageContent } from "./citation-message-content";
import {
  AssistantTypingIndicator,
  shouldShowAssistantTypingIndicator,
} from "./assistant-typing-indicator";

const EMPTY_SUGGESTIONS = [
  "Summarize the key points",
  "What are the main claims?",
  "List open questions",
] as const;

export type ChatPaneProps = {
  notebookId: string;
  selectedSourceIds: string[];
  hasReadySources: boolean;
  selectedConversationId: string | null | undefined;
  onSelectedConversationIdChange: (id: string | null) => void;
  onDraftConversationPersisted?: (conversationId: string) => void;
  onCitationClick: (citation: MessageCitation) => void;
};

/**
 * Center workspace pane: streamed chat grounded in the currently-active
 * sources, with inline citation hover cards wired up to the citation viewer.
 */
export function ChatPane(props: ChatPaneProps) {
  const { data: conversations } = useConversations(props.notebookId);
  const [draftEpoch, setDraftEpoch] = useState(0);

  const isExplicitNewChat = props.selectedConversationId === null;
  const conversationId =
    props.selectedConversationId === undefined
      ? conversations?.[0]?.id
      : (props.selectedConversationId ?? undefined);

  // Draft chats stream in-memory; only hydrate from the DB for existing conversations.
  const persistedConversationId = isExplicitNewChat ? undefined : conversationId;
  const {
    data: persistedMessages,
    isLoading: isLoadingMessages,
    isFetched: hasFetchedMessages,
  } = useMessages(persistedConversationId);

  if (persistedConversationId && isLoadingMessages && !hasFetchedMessages) {
    return <ChatPaneLoading />;
  }

  const chatMountKey = isExplicitNewChat
    ? `draft-${draftEpoch}`
    : (conversationId ?? "default");

  return (
    <ChatPaneInner
      key={chatMountKey}
      {...props}
      conversationId={conversationId}
      initialMessages={persistedMessages}
      onResetDraftSession={() => setDraftEpoch((epoch) => epoch + 1)}
      onDraftConversationPersisted={props.onDraftConversationPersisted}
    />
  );
}

function ChatPaneLoading() {
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="flex-1" />
      <Skeleton className="h-20" />
    </div>
  );
}

type ChatPaneInnerProps = ChatPaneProps & {
  conversationId: string | undefined;
  initialMessages: ReturnType<typeof useMessages>["data"];
  onResetDraftSession: () => void;
};

function ChatPaneInner({
  notebookId,
  selectedSourceIds,
  hasReadySources,
  conversationId,
  initialMessages,
  selectedConversationId,
  onSelectedConversationIdChange,
  onDraftConversationPersisted,
  onCitationClick,
  onResetDraftSession,
}: ChatPaneInnerProps) {
  const { data: conversations } = useConversations(notebookId);
  const deleteConversation = useDeleteConversation(notebookId);

  const {
    messages,
    sendNotebookMessage,
    status,
    stop,
    regenerate,
    error,
    clearError,
    persistedConversationId,
  } = useMochaChat({
    notebookId,
    conversationId,
    selectedSourceIds,
    initialMessages,
    syncSidebarHighlight: selectedConversationId === null,
    onDraftConversationPersisted,
  });

  const activeConversation = conversations?.find(
    (conversation) =>
      conversation.id === (persistedConversationId ?? conversationId),
  );

  const hasMessages = messages.length > 0;
  const canAsk = selectedSourceIds.length > 0 && status === "ready";
  const isGenerating = status === "submitted" || status === "streaming";
  const showTypingIndicator = shouldShowAssistantTypingIndicator(messages, status);
  const showEmptyState = !hasMessages && !isGenerating;
  const showSuggestions = showEmptyState && hasReadySources && selectedSourceIds.length > 0;

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

  const inputDisabled = selectedSourceIds.length === 0 || status === "error";

  async function handleSubmit({ text }: { text: string }) {
    if (!canAsk) return;
    await sendNotebookMessage(text);
  }

  function handleSuggestionClick(suggestion: string) {
    if (!canAsk) return;
    void sendNotebookMessage(suggestion);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b p-3">
        <div className="flex min-w-0 items-center gap-2 px-1">
          <MessageSquareIcon className="size-4 shrink-0" />
          <span className="truncate text-sm font-medium">
            {activeConversation?.title ??
              (selectedConversationId === null ? "New chat" : "New chat")}
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
            onClick={() => {
              onSelectedConversationIdChange(null);
              onResetDraftSession();
            }}
          >
            <PlusIcon />
            <span className="sr-only">New chat</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-destructive/10 px-3 py-2 text-sm">
          <span>Something went wrong.</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void regenerate()}>
              Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={() => clearError()}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <Conversation className="flex-1">
        {showEmptyState ? (
          <ConversationEmptyState
            title="Ask this notebook anything"
            description={emptyDescription}
            icon={<SparklesIcon className="size-6" />}
          />
        ) : (
          <ConversationContent className="gap-4 px-4 py-4 sm:px-6">
            {messages.map((message, index) => {
              const isEmptyPendingAssistant =
                showTypingIndicator &&
                index === messages.length - 1 &&
                message.role === "assistant" &&
                !getMessageTextFromUIMessage(message).trim();

              if (isEmptyPendingAssistant) {
                return null;
              }

              const isLastAssistant =
                message.role === "assistant" &&
                index ===
                  messages.findLastIndex((candidate) => candidate.role === "assistant");

              return (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isAnimating={
                    isLastAssistant && (status === "streaming" || status === "submitted")
                  }
                  showActions={
                    message.role === "assistant" &&
                    isLastAssistant &&
                    status === "ready"
                  }
                  onCitationClick={onCitationClick}
                  onRegenerate={() => void regenerate()}
                />
              );
            })}
            {showTypingIndicator && <AssistantTypingIndicator />}
          </ConversationContent>
        )}
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 space-y-2 border-t p-3">
        {showSuggestions && (
          <Suggestions>
            {EMPTY_SUGGESTIONS.map((suggestion) => (
              <Suggestion
                key={suggestion}
                suggestion={suggestion}
                onClick={handleSuggestionClick}
                disabled={!canAsk}
              />
            ))}
          </Suggestions>
        )}
        <PromptInputProvider>
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputTextarea
                placeholder={inputPlaceholder}
                disabled={inputDisabled}
              />
              <PromptInputFooter>
                <PromptInputSubmit
                  status={status}
                  onStop={() => stop()}
                  disabled={selectedSourceIds.length === 0 || (!isGenerating && inputDisabled)}
                  className="size-10"
                  size="icon-sm"
                />
              </PromptInputFooter>
            </PromptInputBody>
          </PromptInput>
        </PromptInputProvider>
      </div>
    </div>
  );
}

function ChatMessage({
  message,
  isAnimating,
  showActions,
  onCitationClick,
  onRegenerate,
}: {
  message: UIMessage;
  isAnimating: boolean;
  showActions: boolean;
  onCitationClick: (citation: MessageCitation) => void;
  onRegenerate: () => void;
}) {
  const metadata = message.metadata as MochaMessageMetadata | undefined;
  const citations = metadata?.citations ?? [];
  const text = getMessageTextFromUIMessage(message);
  const failed = metadata?.failed === true;
  const uniqueSources = uniqueCitationsForSources(citations);

  if (message.role === "system") {
    return null;
  }

  async function handleCopy() {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard may be unavailable in some contexts.
    }
  }

  return (
    <Message from={message.role}>
      <MessageContent
        className={cn(
          message.role === "assistant" && failed && "bg-destructive/10 text-destructive",
        )}
      >
        <CitationMessageContent
          role={message.role === "user" ? "user" : "assistant"}
          text={text}
          citations={citations}
          failed={failed}
          isAnimating={isAnimating}
          onCitationClick={onCitationClick}
        />
        {message.role === "assistant" && uniqueSources.length > 0 && (
          <Sources>
            <SourcesTrigger count={uniqueSources.length} />
            <SourcesContent>
              {uniqueSources.map((citation) => (
                <Source
                  key={`${citation.sourceId}-${citation.index}`}
                  href={citationPublicUrl(citation)}
                  title={citation.sourceTitle}
                  onClick={(event) => {
                    event.preventDefault();
                    onCitationClick(citation);
                  }}
                >
                  <span className="font-medium">{citation.sourceTitle}</span>
                  <span className="text-muted-foreground">
                    {formatCitationLocatorSummary(citation.locator)}
                  </span>
                </Source>
              ))}
            </SourcesContent>
          </Sources>
        )}
        {showActions && (
          <MessageActions>
            <MessageAction tooltip="Copy" onClick={() => void handleCopy()}>
              <CopyIcon className="size-4" />
            </MessageAction>
            <MessageAction tooltip="Regenerate" onClick={onRegenerate}>
              <RefreshCwIcon className="size-4" />
            </MessageAction>
          </MessageActions>
        )}
      </MessageContent>
    </Message>
  );
}
