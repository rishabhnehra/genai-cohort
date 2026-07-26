import { getNotebook } from "@/features/notebooks/actions";
import { NotebookShell } from "@/features/notebooks/components/notebook-shell";
import { notFound } from "next/navigation";

export default async function NotebookWorkspacePage({
  params,
}: {
  params: Promise<{ notebookId: string }>;
}) {
  const { notebookId } = await params;

  try {
    await getNotebook(notebookId);
  } catch (error) {
    console.error("Notebook not found", error);
    notFound();
  }

  return <NotebookShell notebookId={notebookId} />;
}
