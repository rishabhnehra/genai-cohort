"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  NotebookPenIcon,
  PencilIcon,
  PlusIcon,
  QuoteIcon,
  Trash2Icon,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";
import { useTheme } from "next-themes";

import { Button } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { useIsMobile } from "@repo/ui/hooks/use-mobile";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@repo/ui/sidebar";
import { Skeleton } from "@repo/ui/skeleton";

import { cn } from "@/lib/utils";
import { ChatPane } from "@/features/chat/components/chat-pane";
import type { CitationSnapshot } from "@/features/chat/citations";
import { CitationPane } from "@/features/sources/components/citation-pane";
import { SourcePane } from "@/features/sources/components/source-pane";
import {
  useCreateNotebook,
  useDeleteNotebook,
  useNotebook,
  useNotebooks,
  useRenameNotebook,
  useTouchNotebook,
} from "../hooks";

type Notebook = NonNullable<ReturnType<typeof useNotebooks>["data"]>[number];

/**
 * Notebook workspace shell: a collapsible notebook-switcher sidebar plus a
 * three-pane (sources / chat / citations) workspace. Panes collapse into
 * sheets on mobile. Owns selected sources, the active conversation, and the
 * active citation that tie the panes together.
 */
export function NotebookShell({ notebookId }: { notebookId: string }) {
  const { data: notebook } = useNotebook(notebookId);
  const touchNotebook = useTouchNotebook();
  const isMobile = useIsMobile();
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [citationsOpen, setCitationsOpen] = useState(false);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  // `undefined` = default to the most recent chat; `null` = explicit new chat.
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null | undefined
  >(undefined);
  const [activeCitation, setActiveCitation] = useState<CitationSnapshot | null>(null);

  // Reset per-notebook state during render (rather than in an effect) when
  // the workspace being viewed changes. See: "Adjusting state when a prop
  // changes" in the React docs.
  const [renderedNotebookId, setRenderedNotebookId] = useState(notebookId);
  if (renderedNotebookId !== notebookId) {
    setRenderedNotebookId(notebookId);
    setSelectedSourceIds([]);
    setSelectedConversationId(undefined);
    setActiveCitation(null);
  }

  useEffect(() => {
    touchNotebook.mutate(notebookId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notebookId]);

  function handleCitationClick(citation: CitationSnapshot) {
    setActiveCitation(citation);
    if (isMobile) setCitationsOpen(true);
  }

  const showCitations = activeCitation !== null;

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <NotebookNavSidebar activeNotebookId={notebookId} />
      {/*
        Don't set h-svh on SidebarInset when the sidebar is variant="inset":
        inset applies md:m-2, so h-svh + margins overflows the viewport by ~1rem
        and creates a tiny page scrollbar. Fill via flex-1 inside the clipped provider.
      */}
      <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center gap-1 border-b p-2">
          <SidebarTrigger />
          <Button
            variant="ghost"
            size="icon-sm"
            nativeButton={false}
            render={<Link href="/notebooks" />}
          >
            <ArrowLeftIcon />
            <span className="sr-only">Back to notebooks</span>
          </Button>
          <h1 className="truncate font-heading text-sm font-medium">
            {notebook?.title ?? "Notebook"}
          </h1>

          {isMobile && (
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSourcesOpen(true)}
              >
                <FileTextIcon />
                Sources
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCitationsOpen(true)}
              >
                <QuoteIcon />
                Citations
              </Button>
            </div>
          )}
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {isMobile ? (
            <>
              <div className="h-full min-h-0">
                <ChatPane
                  notebookId={notebookId}
                  selectedSourceIds={selectedSourceIds}
                  selectedConversationId={selectedConversationId}
                  onSelectedConversationIdChange={setSelectedConversationId}
                  onCitationClick={handleCitationClick}
                />
              </div>

              <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
                <SheetContent side="left" className="w-5/6 p-0 sm:max-w-sm">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Chats & sources</SheetTitle>
                    <SheetDescription>
                      Chat history and sources for this notebook.
                    </SheetDescription>
                  </SheetHeader>
                  <SourcePane
                    notebookId={notebookId}
                    selectedSourceIds={selectedSourceIds}
                    onSelectedSourceIdsChange={setSelectedSourceIds}
                    selectedConversationId={selectedConversationId}
                    onSelectedConversationIdChange={setSelectedConversationId}
                  />
                </SheetContent>
              </Sheet>

              <Sheet open={citationsOpen} onOpenChange={setCitationsOpen}>
                <SheetContent side="right" className="w-5/6 p-0 sm:max-w-sm">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Citations</SheetTitle>
                    <SheetDescription>
                      Citations for the active answer.
                    </SheetDescription>
                  </SheetHeader>
                  <CitationPane
                    activeCitation={activeCitation}
                    onClose={() => {
                      setActiveCitation(null);
                      setCitationsOpen(false);
                    }}
                  />
                </SheetContent>
              </Sheet>
            </>
          ) : (
            // react-resizable-panels v4: numbers = pixels, strings = percentages.
            // Using percentage strings so sources/citations get real columns.
            <ResizablePanelGroup
              key={showCitations ? "with-citations" : "chat-only"}
              orientation="horizontal"
              className="h-full w-full"
            >
              <ResizablePanel
                id="sources"
                defaultSize="22%"
                minSize="16%"
                maxSize="32%"
                className="min-w-0"
              >
                <div className="h-full min-h-0 overflow-hidden border-r">
                  <SourcePane
                    notebookId={notebookId}
                    selectedSourceIds={selectedSourceIds}
                    onSelectedSourceIdsChange={setSelectedSourceIds}
                    selectedConversationId={selectedConversationId}
                    onSelectedConversationIdChange={setSelectedConversationId}
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel
                id="chat"
                defaultSize={showCitations ? "53%" : "78%"}
                minSize="30%"
                className="min-w-0"
              >
                <div className="h-full min-h-0 overflow-hidden">
                  <ChatPane
                    notebookId={notebookId}
                    selectedSourceIds={selectedSourceIds}
                    selectedConversationId={selectedConversationId}
                    onSelectedConversationIdChange={setSelectedConversationId}
                    onCitationClick={handleCitationClick}
                  />
                </div>
              </ResizablePanel>
              {showCitations && (
                <>
                  <ResizableHandle withHandle />
                  <ResizablePanel
                    id="citations"
                    defaultSize="25%"
                    minSize="18%"
                    maxSize="40%"
                    className="min-w-0"
                  >
                    <div className="h-full min-h-0 overflow-hidden border-l">
                      <CitationPane
                        activeCitation={activeCitation}
                        onClose={() => setActiveCitation(null)}
                      />
                    </div>
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/** Collapsible left-hand sidebar for switching between notebooks. */
function NotebookNavSidebar({ activeNotebookId }: { activeNotebookId: string }) {
  const { data: notebooks, isLoading } = useNotebooks();
  const createNotebook = useCreateNotebook();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="gap-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="font-semibold tracking-tight"
              render={<Link href="/notebooks" />}
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
                <NotebookPenIcon className="size-4" />
              </span>
              <span>Mocha LM</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="New notebook"
              onClick={() => createNotebook.mutate(undefined)}
            >
              <PlusIcon />
              <span>New notebook</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Notebooks</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <NotebookList
                notebooks={notebooks}
                isLoading={isLoading}
                activeId={activeNotebookId}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarFooterMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NotebookList({
  notebooks,
  isLoading,
  activeId,
}: {
  notebooks: Notebook[] | undefined;
  isLoading: boolean;
  activeId: string;
}) {
  if (isLoading) {
    return (
      <>
        {Array.from({ length: 4 }).map((_, index) => (
          <SidebarMenuItem key={index}>
            <Skeleton className="h-8 w-full" />
          </SidebarMenuItem>
        ))}
      </>
    );
  }

  if (!notebooks?.length) {
    return (
      <p className="px-2 py-1.5 text-xs text-muted-foreground">
        No notebooks yet
      </p>
    );
  }

  return (
    <>
      {notebooks.map((notebook) => (
        <NotebookListItem
          key={notebook.id}
          notebook={notebook}
          isActive={activeId === notebook.id}
        />
      ))}
    </>
  );
}

function NotebookListItem({
  notebook,
  isActive,
}: {
  notebook: Notebook;
  isActive: boolean;
}) {
  const renameNotebook = useRenameNotebook();
  const deleteNotebook = useDeleteNotebook(isActive ? notebook.id : undefined);

  function handleRename() {
    const next = window.prompt("Rename notebook", notebook.title);
    if (!next || next.trim() === notebook.title) return;
    renameNotebook.mutate({ id: notebook.id, title: next });
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        tooltip={notebook.title}
        render={<Link href={`/notebooks/${notebook.id}`} />}
        className={cn(isActive && "font-medium")}
      >
        <span className="truncate">{notebook.title}</span>
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuAction
              showOnHover
              className="data-popup-open:bg-sidebar-accent"
            />
          }
        >
          <MoreHorizontalIcon />
          <span className="sr-only">Notebook actions</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem onClick={handleRename}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => deleteNotebook.mutate(notebook.id)}
          >
            <Trash2Icon />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

function SidebarFooterMenu() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          Toggle theme
        </Button>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <div className="flex items-center gap-2 px-1 py-1.5">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-8",
              },
            }}
          />
          <span className="truncate text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
            Account
          </span>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
