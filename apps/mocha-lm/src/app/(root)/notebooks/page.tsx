import Link from "next/link";
import { NotebookPenIcon } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { NotebookDashboard } from "@/features/notebooks/components/notebook-dashboard";

export default function NotebooksPage() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <Link
          href="/notebooks"
          className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <NotebookPenIcon className="size-4" />
          </span>
          Mocha LM
        </Link>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "size-8",
            },
          }}
        />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NotebookDashboard />
      </div>
    </div>
  );
}
