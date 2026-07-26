"use server";

import { prisma } from "@/lib/db";
import { requiredUser } from "../auth/actions/required-user";
import { checkNotebookExists } from "../utils";
import { revalidatePath } from "next/cache";

export async function listNotebooks() {
  const user = await requiredUser();

  const notebooks = await prisma.notebook.findMany({
    where: {
      userId: user.id,
    },
    orderBy: [{ lastOpenedAt: "desc" }, { updatedAt: "desc" }],
    include: {
      _count: {
        select: { sources: true, conversations: true },
      },
    },
  });

  return notebooks;
}

export async function getNotebook(notebookId: string) {
  const user = await requiredUser();
  const notebook = await checkNotebookExists(notebookId, user.id);

  return notebook;
}

export async function createNotebook(title = "Untitled notebook") {
  const user = await requiredUser();

  const notebook = await prisma.notebook.create({
    data: {
      userId: user.id,
      title: title.trim() || "Untitled notebook",
    },
  });

  revalidatePath("/notebooks");

  return notebook;
}

export async function renameNotebook(notebookId: string, title: string) {
  const user = await requiredUser();
  await checkNotebookExists(notebookId, user.id);

  const notebook = await prisma.notebook.update({
    where: { id: notebookId },
    data: { title: title.trim() || "Untitled notebook" },
  });

  revalidatePath("/notebooks");
  revalidatePath(`/notebooks/${notebookId}`);

  return notebook;
}

export async function deleteNotebook(notebookId: string) {
  const user = await requiredUser();
  await checkNotebookExists(notebookId, user.id);

  const notebook = await prisma.notebook.delete({
    where: { id: notebookId },
  });

  revalidatePath("/notebooks");

  return { id: notebook.id };
}

/** Bumps `lastOpenedAt` whenever a notebook workspace is opened. */
export async function touchNotebook(notebookId: string) {
  const user = await requiredUser();
  await checkNotebookExists(notebookId, user.id);

  const notebook = await prisma.notebook.update({
    where: { id: notebookId },
    data: { lastOpenedAt: new Date() },
  });

  return notebook;
}
