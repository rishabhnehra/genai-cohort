"use client";

import { useEffect, useRef, useState } from "react";
import {
  CaptionsIcon,
  FileTextIcon,
  GlobeIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";

import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Checkbox } from "@repo/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/empty";
import { Input } from "@repo/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@repo/ui/item";
import { Progress, ProgressIndicator, ProgressTrack } from "@repo/ui/progress";
import { ScrollArea } from "@repo/ui/scroll-area";
import { Skeleton } from "@repo/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";

import { cn } from "@/lib/utils";
import {
  useConversations,
  useDeleteConversation,
} from "@/features/chat/hooks";
import {
  useAddUrlSource,
  useDeleteSource,
  useRetrySource,
  useSources,
  useUploadSources,
  type SourceListItem,
} from "../hooks";

const NONTERMINAL_STATUSES = new Set(["QUEUED", "PROCESSING", "DELETING"]);

const STAGE_LABEL: Record<string, string> = {
  QUEUED: "Queued",
  FETCHING: "Fetching",
  EXTRACTING: "Extracting",
  CHUNKING: "Chunking",
  EMBEDDING: "Embedding",
  INDEXING: "Indexing",
  COMPLETE: "Complete",
  FAILED: "Failed",
};

const TYPE_ICON: Record<string, typeof FileTextIcon> = {
  PDF: FileTextIcon,
  SRT: CaptionsIcon,
  WEB: GlobeIcon,
};

export type SourcePaneProps = {
  notebookId: string;
  selectedSourceIds: string[];
  onSelectedSourceIdsChange: (ids: string[]) => void;
  selectedConversationId: string | null | undefined;
  onSelectedConversationIdChange: (id: string | null) => void;
};

/**
 * Left workspace pane: chat history (switch / start chats) stacked above
 * sources with live ingestion status. Lifts selected sources and the active
 * conversation up to the notebook shell.
 */
export function SourcePane({
  notebookId,
  selectedSourceIds,
  onSelectedSourceIdsChange,
  selectedConversationId,
  onSelectedConversationIdChange,
}: SourcePaneProps) {
  const { data: sources, isLoading } = useSources(notebookId);
  const deleteSource = useDeleteSource(notebookId);
  const retrySource = useRetrySource(notebookId);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Drop selections for sources that no longer exist (e.g. after delete).
  useEffect(() => {
    if (!sources) return;
    const validIds = new Set(sources.map((source) => source.id));
    const filtered = selectedSourceIds.filter((id) => validIds.has(id));
    if (filtered.length !== selectedSourceIds.length) {
      onSelectedSourceIdsChange(filtered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);

  function toggleSelected(sourceId: string, checked: boolean) {
    if (checked) {
      onSelectedSourceIdsChange([...selectedSourceIds, sourceId]);
    } else {
      onSelectedSourceIdsChange(selectedSourceIds.filter((id) => id !== sourceId));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHistorySection
        notebookId={notebookId}
        selectedConversationId={selectedConversationId}
        onSelectedConversationIdChange={onSelectedConversationIdChange}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b p-3">
          <h2 className="font-heading text-sm font-medium">Sources</h2>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button size="icon-sm" variant="ghost" title="Add source" />
              }
            >
              <PlusIcon />
              <span className="sr-only">Add source</span>
            </DialogTrigger>
            <AddSourceDialogContent
              notebookId={notebookId}
              onDone={() => setDialogOpen(false)}
            />
          </Dialog>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-2 p-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))
            ) : !sources?.length ? (
              <Empty className="flex-1">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileTextIcon />
                  </EmptyMedia>
                  <EmptyTitle>No sources yet</EmptyTitle>
                  <EmptyDescription>
                    Add PDFs, subtitles, or web pages to ground chats in this
                    notebook&apos;s material.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={() => setDialogOpen(true)}>
                    <PlusIcon />
                    Add source
                  </Button>
                </EmptyContent>
              </Empty>
            ) : (
              <ItemGroup className="gap-2">
                {sources.map((source) => (
                  <SourceRow
                    key={source.id}
                    source={source}
                    selected={selectedSourceIds.includes(source.id)}
                    onToggleSelected={(checked) => toggleSelected(source.id, checked)}
                    onDelete={() => deleteSource.mutate(source.id)}
                    onRetry={() => retrySource.mutate(source.id)}
                  />
                ))}
              </ItemGroup>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ChatHistorySection({
  notebookId,
  selectedConversationId,
  onSelectedConversationIdChange,
}: {
  notebookId: string;
  selectedConversationId: string | null | undefined;
  onSelectedConversationIdChange: (id: string | null) => void;
}) {
  const { data: conversations, isLoading } = useConversations(notebookId);
  const deleteConversation = useDeleteConversation(notebookId);

  const activeConversationId =
    selectedConversationId === undefined
      ? conversations?.[0]?.id
      : (selectedConversationId ?? undefined);
  const isNewChat = selectedConversationId === null;

  return (
    <div className="flex max-h-[45%] min-h-0 shrink-0 flex-col border-b">
      <div className="flex shrink-0 items-center justify-between p-3">
        <h2 className="font-heading text-sm font-medium">Chat History</h2>
        <Button
          size="icon-sm"
          variant="ghost"
          title="New chat"
          onClick={() => onSelectedConversationIdChange(null)}
        >
          <PlusIcon />
          <span className="sr-only">New chat</span>
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 px-3 pb-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))
          ) : (
            <>
              {isNewChat && (
                <ChatHistoryRow
                  title="New chat"
                  isActive
                  onSelect={() => onSelectedConversationIdChange(null)}
                />
              )}
              {!conversations?.length && !isNewChat ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">
                  No chats yet. Ask a question to start one.
                </p>
              ) : (
                conversations?.map((conversation) => (
                  <ChatHistoryRow
                    key={conversation.id}
                    title={conversation.title}
                    isActive={conversation.id === activeConversationId}
                    onSelect={() => onSelectedConversationIdChange(conversation.id)}
                    onDelete={() => {
                      deleteConversation.mutate(conversation.id);
                      if (conversation.id === activeConversationId) {
                        onSelectedConversationIdChange(null);
                      }
                    }}
                  />
                ))
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ChatHistoryRow({
  title,
  isActive,
  onSelect,
  onDelete,
}: {
  title: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex w-full min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-muted/60",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        title={title}
      >
        <MessageSquareIcon className="size-3.5 shrink-0 opacity-70" />
        <span className="truncate">{title}</span>
      </button>
      {onDelete ? (
        <Button
          size="icon-xs"
          variant="ghost"
          className="size-6 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          title="Delete chat"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2Icon />
          <span className="sr-only">Delete chat</span>
        </Button>
      ) : null}
    </div>
  );
}

function SourceRow({
  source,
  selected,
  onToggleSelected,
  onDelete,
  onRetry,
}: {
  source: SourceListItem;
  selected: boolean;
  onToggleSelected: (checked: boolean) => void;
  onDelete: () => void;
  onRetry: () => void;
}) {
  const Icon = TYPE_ICON[source.type] ?? FileTextIcon;
  const isReady = source.status === "READY";
  const isFailed = source.status === "FAILED";
  const isNonterminal = NONTERMINAL_STATUSES.has(source.status);

  const description = sourceDescription(source);

  return (
    <Item variant="outline" size="sm" className="flex-col items-stretch gap-2">
      <div className="flex w-full min-w-0 items-start gap-2.5">
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="mt-0.5 shrink-0">
                <Checkbox
                  checked={selected}
                  disabled={!isReady}
                  onCheckedChange={(checked) => onToggleSelected(checked === true)}
                />
              </span>
            }
          />
          <TooltipContent>
            {isReady ? "Include in chat context" : "Available once processing completes"}
          </TooltipContent>
        </Tooltip>

        <ItemMedia variant="icon" className="mt-0.5">
          <Icon />
        </ItemMedia>

        <ItemContent className="min-w-0 overflow-hidden">
          <ItemTitle
            title={source.title}
            className="block w-full min-w-0 truncate"
          >
            {source.title}
          </ItemTitle>
          {description ? (
            <ItemDescription className="truncate">{description}</ItemDescription>
          ) : null}
        </ItemContent>

        <ItemActions className="shrink-0">
          <StatusBadge status={source.status} />
          {isFailed && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button size="icon-xs" variant="ghost" onClick={onRetry} />
                }
              >
                <RotateCcwIcon />
                <span className="sr-only">Retry</span>
              </TooltipTrigger>
              <TooltipContent>Retry</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  disabled={source.status === "DELETING"}
                  onClick={onDelete}
                />
              }
            >
              <Trash2Icon />
              <span className="sr-only">Delete</span>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </ItemActions>
      </div>

      {isNonterminal && (
        <Progress value={source.progress} className="w-full gap-1">
          <ProgressTrack>
            <ProgressIndicator />
          </ProgressTrack>
        </Progress>
      )}
    </Item>
  );
}

/** Stage/error copy under the title. Skips labels already shown on StatusBadge. */
function sourceDescription(source: SourceListItem): string | null {
  if (source.status === "FAILED") {
    return source.errorMessage ?? "Something went wrong.";
  }
  if (source.status === "QUEUED" || source.status === "DELETING") {
    return null;
  }
  if (source.status === "READY") {
    return source.chunkCount ? `${source.chunkCount} chunks` : null;
  }
  // PROCESSING: show pipeline stage only (badge already says "Processing").
  if (source.stage === "QUEUED" || source.stage === "COMPLETE") {
    return source.chunkCount ? `${source.chunkCount} chunks` : null;
  }
  const stage = STAGE_LABEL[source.stage] ?? source.stage;
  return source.chunkCount ? `${stage} · ${source.chunkCount} chunks` : stage;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "READY") {
    return <Badge variant="outline">Ready</Badge>;
  }
  if (status === "FAILED") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  if (status === "DELETING") {
    return (
      <Badge variant="outline">
        <Loader2Icon className="animate-spin" />
        Deleting
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <Loader2Icon className="animate-spin" />
      {status === "QUEUED" ? "Queued" : "Processing"}
    </Badge>
  );
}

function AddSourceDialogContent({
  notebookId,
  onDone,
}: {
  notebookId: string;
  onDone: () => void;
}) {
  const uploadSources = useUploadSources(notebookId);
  const addUrlSource = useAddUrlSource(notebookId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [url, setUrl] = useState("");

  async function handleUpload() {
    if (selectedFiles.length === 0) return;
    await uploadSources.mutateAsync(selectedFiles);
    setSelectedFiles([]);
    onDone();
  }

  async function handleAddUrl() {
    if (!url.trim()) return;
    await addUrlSource.mutateAsync(url.trim());
    setUrl("");
    onDone();
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add source</DialogTitle>
        <DialogDescription>
          Upload PDFs or subtitle files, or add a web page by URL.
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="upload">
        <TabsList className="w-full">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="url">Web URL</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="flex flex-col gap-3 pt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.srt,application/pdf,application/x-subrip"
            multiple
            className="hidden"
            onChange={(event) => {
              setSelectedFiles(Array.from(event.target.files ?? []));
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon />
            Choose files
          </Button>

          {selectedFiles.length > 0 && (
            <ul className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground">
              {selectedFiles.map((file) => (
                <li key={file.name} className="truncate" title={file.name}>
                  {file.name}
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploadSources.isPending}
            >
              {uploadSources.isPending && <Loader2Icon className="animate-spin" />}
              Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}
            </Button>
          </DialogFooter>
        </TabsContent>

        <TabsContent value="url" className="flex flex-col gap-3 pt-2">
          <Input
            type="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleAddUrl();
              }
            }}
          />

          <DialogFooter>
            <Button
              onClick={handleAddUrl}
              disabled={!url.trim() || addUrlSource.isPending}
            >
              {addUrlSource.isPending && <Loader2Icon className="animate-spin" />}
              Add URL
            </Button>
          </DialogFooter>
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}
