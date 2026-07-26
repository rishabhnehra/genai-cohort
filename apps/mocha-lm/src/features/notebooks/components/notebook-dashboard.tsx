"use client";

import Link from "next/link";
import {
  FileTextIcon,
  MoreHorizontalIcon,
  NotebookPenIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/empty";
import { Skeleton } from "@repo/ui/skeleton";

import {
  useCreateNotebook,
  useDeleteNotebook,
  useNotebooks,
  useRenameNotebook,
} from "../hooks";

type Notebook = NonNullable<ReturnType<typeof useNotebooks>["data"]>[number];

/** Grid dashboard listing every notebook the current user owns. */
export function NotebookDashboard() {
  const { data: notebooks, isLoading } = useNotebooks();
  const createNotebook = useCreateNotebook();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold">Notebooks</h1>
          <p className="text-sm text-muted-foreground">
            Organize sources and chat with them, notebook by notebook.
          </p>
        </div>
        <Button
          onClick={() => createNotebook.mutate(undefined)}
          disabled={createNotebook.isPending}
        >
          <PlusIcon />
          New notebook
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full" />
          ))}
        </div>
      ) : !notebooks?.length ? (
        <Empty className="flex-1">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <NotebookPenIcon />
            </EmptyMedia>
            <EmptyTitle>No notebooks yet</EmptyTitle>
            <EmptyDescription>
              Create your first notebook to start adding sources and chatting
              with them.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              onClick={() => createNotebook.mutate(undefined)}
              disabled={createNotebook.isPending}
            >
              <PlusIcon />
              New notebook
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notebooks.map((notebook) => (
            <NotebookCard key={notebook.id} notebook={notebook} />
          ))}
        </div>
      )}
    </div>
  );
}

function NotebookCard({ notebook }: { notebook: Notebook }) {
  const renameNotebook = useRenameNotebook();
  const deleteNotebook = useDeleteNotebook();

  function handleRename() {
    const next = window.prompt("Rename notebook", notebook.title);
    if (!next || next.trim() === notebook.title) return;
    renameNotebook.mutate({ id: notebook.id, title: next });
  }

  return (
    <Card className="group/notebook-card relative">
      <Link
        href={`/notebooks/${notebook.id}`}
        className="absolute inset-0"
        aria-label={notebook.title}
      />
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="truncate">{notebook.title}</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="relative z-10 shrink-0"
                />
              }
            >
              <MoreHorizontalIcon />
              <span className="sr-only">Notebook actions</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="line-clamp-2 text-muted-foreground">
          {notebook.description || "No description yet."}
        </p>
      </CardContent>
      <CardFooter className="justify-between text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileTextIcon className="size-3.5" />
          {notebook._count.sources} source
          {notebook._count.sources === 1 ? "" : "s"}
        </span>
        <span>{new Date(notebook.updatedAt).toLocaleDateString()}</span>
      </CardFooter>
    </Card>
  );
}
