"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  QuoteIcon,
  XIcon,
} from "lucide-react";

import { Button } from "@repo/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/empty";
import { ScrollArea } from "@repo/ui/scroll-area";
import { Spinner } from "@repo/ui/spinner";

import { cn } from "@/lib/utils";
import {
  formatCitationLocation,
  formatSrtTimestamp,
  type CitationSnapshot,
} from "@/features/chat/citations";
import type { ExtractedArtifact, ExtractedSrtCue } from "@/features/ingestion/types";

// Loaded off a CDN so we don't have to fight the bundler over worker asset resolution.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export type CitationPaneProps = {
  activeCitation: CitationSnapshot | null;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
};

/**
 * Right workspace pane surfacing the exact passage behind a citation — a
 * PDF page, an SRT cue, or a web page excerpt — once the user clicks a
 * `[1]`-style citation marker in the chat pane. Supports stepping back and
 * forth through every citation viewed so far in this session.
 */
export function CitationPane({
  activeCitation,
  onClose,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: CitationPaneProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between gap-1 border-b p-3">
        <h2 className="font-heading text-sm font-medium">Citations</h2>
        {activeCitation && (
          <div className="flex items-center gap-0.5">
            {(onPrev || onNext) && (
              <>
                <Button size="icon-sm" variant="ghost" disabled={!hasPrev} onClick={onPrev}>
                  <ChevronLeftIcon />
                  <span className="sr-only">Previous citation</span>
                </Button>
                <Button size="icon-sm" variant="ghost" disabled={!hasNext} onClick={onNext}>
                  <ChevronRightIcon />
                  <span className="sr-only">Next citation</span>
                </Button>
              </>
            )}
            <Button size="icon-sm" variant="ghost" onClick={onClose}>
              <XIcon />
              <span className="sr-only">Close citation</span>
            </Button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1">
        {!activeCitation ? (
          <div className="flex h-full flex-col overflow-y-auto p-3">
            <Empty className="flex-1">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <QuoteIcon />
                </EmptyMedia>
                <EmptyTitle>No citation selected</EmptyTitle>
                <EmptyDescription>
                  Click a citation marker like [1] in the assistant&apos;s answer to see the exact
                  passage it came from.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <CitationViewer key={`${activeCitation.sourceId}-${activeCitation.chunkId}`} citation={activeCitation} />
        )}
      </div>
    </div>
  );
}

function CitationViewer({ citation }: { citation: CitationSnapshot }) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b px-3 py-2">
        <p className="truncate text-xs font-medium" title={citation.sourceTitle}>
          {citation.sourceTitle}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Citation [{citation.index}] · {formatCitationLocation(citation.locator)}
        </p>
      </div>

      <div className="min-h-0 flex-1">
        {citation.locator.kind === "pdf" && (
          <PdfViewer
            sourceId={citation.sourceId}
            page={citation.locator.page}
            excerpt={citation.locator.excerpt}
          />
        )}
        {citation.locator.kind === "srt" && (
          <SrtViewer
            sourceId={citation.sourceId}
            cueIndex={citation.locator.cueIndex}
            excerpt={citation.locator.excerpt}
          />
        )}
        {citation.locator.kind === "web" && (
          <WebViewer
            sourceId={citation.sourceId}
            url={citation.locator.url}
            excerpt={citation.locator.excerpt}
          />
        )}
      </div>
    </div>
  );
}

function useExtractedArtifact(sourceId: string) {
  return useQuery({
    queryKey: ["source-extracted", sourceId],
    queryFn: async () => {
      const response = await fetch(`/api/sources/${sourceId}/extracted`);
      if (!response.ok) throw new Error("Couldn't load this source's content.");
      return (await response.json()) as ExtractedArtifact;
    },
    staleTime: 5 * 60 * 1000,
  });
}

function PdfViewer({
  sourceId,
  page,
  excerpt,
}: {
  sourceId: string;
  page: number;
  excerpt?: string;
}) {
  const [pageNumber, setPageNumber] = useState(page);
  const [numPages, setNumPages] = useState<number | null>(null);

  // Re-sync the shown page when a new citation targets this viewer, computed
  // during render (rather than in an effect) to avoid an extra render pass.
  const syncKey = `${sourceId}:${page}`;
  const [lastSyncKey, setLastSyncKey] = useState(syncKey);
  if (lastSyncKey !== syncKey) {
    setLastSyncKey(syncKey);
    setPageNumber(page);
  }

  return (
    <div className="flex h-full flex-col">
      {excerpt ? (
        <blockquote className="shrink-0 border-b border-l-2 border-primary bg-primary/5 px-3 py-2 text-xs italic leading-relaxed">
          &ldquo;{excerpt}&rdquo;
        </blockquote>
      ) : null}
      <ScrollArea className="flex-1">
        <div className="flex justify-center p-3">
          <Document
            file={`/api/sources/${sourceId}/content`}
            onLoadSuccess={({ numPages: loadedPages }) => setNumPages(loadedPages)}
            loading={<Spinner className="my-12" />}
            error={<p className="p-4 text-xs text-muted-foreground">Couldn&apos;t load this PDF.</p>}
          >
            <Page pageNumber={pageNumber} width={320} loading={<Spinner className="my-12" />} />
          </Document>
        </div>
      </ScrollArea>
      <div className="flex shrink-0 items-center justify-between border-t p-2">
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={pageNumber <= 1}
          onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
        >
          <ChevronLeftIcon />
          <span className="sr-only">Previous page</span>
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {pageNumber}
          {numPages ? ` of ${numPages}` : ""}
        </span>
        <Button
          size="icon-sm"
          variant="ghost"
          disabled={numPages != null && pageNumber >= numPages}
          onClick={() => setPageNumber((current) => (numPages ? Math.min(numPages, current + 1) : current + 1))}
        >
          <ChevronRightIcon />
          <span className="sr-only">Next page</span>
        </Button>
      </div>
    </div>
  );
}

function SrtViewer({
  sourceId,
  cueIndex,
  excerpt,
}: {
  sourceId: string;
  cueIndex: number;
  excerpt?: string;
}) {
  const { data, isLoading, isError } = useExtractedArtifact(sourceId);

  useEffect(() => {
    const el = document.getElementById(`mocha-cue-${cueIndex}`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [cueIndex, data]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !data || data.type !== "srt") {
    return <p className="p-4 text-xs text-muted-foreground">Couldn&apos;t load this transcript.</p>;
  }

  return (
    <div className="flex h-full flex-col">
      {excerpt ? (
        <blockquote className="shrink-0 border-b border-l-2 border-primary bg-primary/5 px-3 py-2 text-xs italic leading-relaxed">
          &ldquo;{excerpt}&rdquo;
        </blockquote>
      ) : null}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 p-3">
          {data.cues.map((cue: ExtractedSrtCue) => (
            <div
              key={cue.index}
              id={`mocha-cue-${cue.index}`}
              className={cn(
                "rounded-none border-l-2 px-2.5 py-1.5 text-xs leading-relaxed",
                cue.index === cueIndex ? "border-primary bg-primary/10" : "border-transparent",
              )}
            >
              <p className="mb-0.5 font-mono text-[10px] text-muted-foreground">
                {formatSrtTimestamp(cue.startMs)}
              </p>
              <p>{cue.text}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function WebViewer({ sourceId, url, excerpt }: { sourceId: string; url: string; excerpt?: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["source-content-html", sourceId],
    queryFn: async () => {
      const response = await fetch(`/api/sources/${sourceId}/content`);
      if (!response.ok) throw new Error("Couldn't load this page.");
      return response.text();
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-3">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 truncate text-xs text-primary hover:underline"
        >
          <ExternalLinkIcon className="size-3 shrink-0" />
          <span className="truncate">{url}</span>
        </a>

        {excerpt && (
          <blockquote className="border-l-2 border-primary bg-primary/5 px-2.5 py-2 text-xs italic leading-relaxed">
            &ldquo;{excerpt}&rdquo;
          </blockquote>
        )}

        {isLoading ? (
          <Spinner />
        ) : isError || !data ? (
          <p className="text-xs text-muted-foreground">Couldn&apos;t load this page.</p>
        ) : (
          <div
            className="text-xs leading-relaxed [&_a]:text-primary [&_a]:underline [&_img]:max-w-full"
            // Sanitized server-side at ingestion time (see `features/ingestion/parsers/web.ts`).
            dangerouslySetInnerHTML={{ __html: data }}
          />
        )}
      </div>
    </ScrollArea>
  );
}
