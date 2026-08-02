import type { SourceType } from "@/generated/prisma/enums";
import type { CitationLocator } from "../ingestion/types";
import type { RetrievedChunk } from "../retrieval/types";

/**
 * A numbered citation the assistant can reference (e.g. `[1]`), built from a
 * retrieved chunk. Persisted on `Message.metadata` so citations survive a
 * page reload without re-running retrieval.
 */
export type MessageCitation = {
  index: number;
  chunkId: string;
  sourceId: string;
  sourceType: SourceType;
  sourceTitle: string;
  locator: CitationLocator;
};

/** A citation the user has selected (or previously selected) to view in the citation pane. */
export type CitationSnapshot = MessageCitation;

/** Numbers retrieved chunks 1..N in the order they should be presented to the model. */
export function buildCitationsFromChunks(chunks: RetrievedChunk[]): MessageCitation[] {
  return chunks.map((chunk, index) => ({
    index: index + 1,
    chunkId: chunk.chunkId,
    sourceId: chunk.sourceId,
    sourceType: chunk.sourceType,
    sourceTitle: chunk.sourceTitle,
    locator: chunk.locator,
  }));
}

/**
 * Stable key for "same place in a source" — ignores excerpt text so two
 * chunks from the same PDF page (or SRT cue / web span) collapse together.
 */
export function citationLocationKey(citation: Pick<MessageCitation, "sourceId" | "locator">): string {
  const { sourceId, locator } = citation;
  switch (locator.kind) {
    case "pdf":
      return `pdf:${sourceId}:${locator.page}`;
    case "srt":
      return `srt:${sourceId}:${locator.cueIndex}`;
    case "web":
      return `web:${sourceId}:${locator.charStart ?? 0}:${locator.charEnd ?? 0}:${locator.url}`;
  }
}

/**
 * Maps each citation index onto the first (lowest) index that points at the
 * same source location. Used so the chat UI doesn't show [3] and [10] for
 * two chunks that both open page 19 of the same PDF.
 */
export function canonicalizeCitationIndexes(
  citations: MessageCitation[],
): Map<number, number> {
  const locationToCanonical = new Map<string, number>();
  const indexMap = new Map<number, number>();

  const ordered = [...citations].sort((a, b) => a.index - b.index);
  for (const citation of ordered) {
    const key = citationLocationKey(citation);
    const canonical = locationToCanonical.get(key) ?? citation.index;
    if (!locationToCanonical.has(key)) {
      locationToCanonical.set(key, citation.index);
    }
    indexMap.set(citation.index, canonical);
  }

  return indexMap;
}

/**
 * Collapses a used-citation list down to one entry per source location,
 * keeping the earliest index and preferring a locator that still carries
 * an excerpt when available.
 */
export function collapseCitationsByLocation(citations: MessageCitation[]): MessageCitation[] {
  const byLocation = new Map<string, MessageCitation>();

  const ordered = [...citations].sort((a, b) => a.index - b.index);
  for (const citation of ordered) {
    const key = citationLocationKey(citation);
    const existing = byLocation.get(key);
    if (!existing) {
      byLocation.set(key, citation);
      continue;
    }
    // Prefer the kept (earliest) index, but upgrade its excerpt if missing.
    if (!existing.locator.excerpt && citation.locator.excerpt) {
      byLocation.set(key, {
        ...existing,
        locator: { ...existing.locator, excerpt: citation.locator.excerpt },
      });
    }
  }

  return [...byLocation.values()].sort((a, b) => a.index - b.index);
}

function describeLocator(locator: CitationLocator): string {
  switch (locator.kind) {
    case "pdf":
      return `page ${locator.page}`;
    case "srt":
      return formatSrtTimestamp(locator.startMs);
    case "web":
      return locator.heading || locator.url;
  }
}

/** Human-readable location label for the citation pane header. */
export function formatCitationLocation(locator: CitationLocator): string {
  return describeLocator(locator);
}

/** Short locator summary for inline citation hover cards / Sources rows. */
export function formatCitationLocatorSummary(locator: CitationLocator): string {
  switch (locator.kind) {
    case "pdf":
      return `Page ${locator.page}`;
    case "srt":
      return formatSrtTimestamp(locator.startMs);
    case "web": {
      if (locator.heading) return locator.heading;
      try {
        return new URL(locator.url).hostname;
      } catch {
        return locator.url;
      }
    }
  }
}

/** Public URL when the citation is a web source; otherwise undefined. */
export function citationPublicUrl(citation: MessageCitation): string | undefined {
  return citation.locator.kind === "web" ? citation.locator.url : undefined;
}

/**
 * Unique citations for the Sources list under an assistant message,
 * deduped by source location and ordered by citation index.
 */
export function uniqueCitationsForSources(citations: MessageCitation[]): MessageCitation[] {
  return collapseCitationsByLocation(citations);
}

/** Renders numbered excerpts (`[1] (title — location)\n...text...`) for the grounded system prompt. */
export function formatContextBlock(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, index) => `[${index + 1}] (${chunk.sourceTitle} — ${describeLocator(chunk.locator)})\n${chunk.text}`)
    .join("\n\n---\n\n");
}

/** Formats milliseconds as an `HH:MM:SS` timestamp for SRT citations/transcripts. */
export function formatSrtTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, "0")).join(":");
}

export type CitationRef = { label: string; index: number };

/** Matches both `[1]` and `[C1]` style citation markers. */
const CITATION_RE = /\[C?(\d+)\]/gi;

/** Extracts citation markers from generated text, in order of first appearance, deduped by index. */
export function parseCitations(text: string): CitationRef[] {
  const refs: CitationRef[] = [];
  const seen = new Set<number>();

  for (const match of text.matchAll(CITATION_RE)) {
    const index = Number(match[1]);
    if (!Number.isFinite(index) || seen.has(index)) continue;
    seen.add(index);
    refs.push({ label: match[0], index });
  }

  return refs;
}

/** Drops citation markers that fall outside the numbered citation list the model was given. */
export function validateCitations(refs: CitationRef[], maxIndex: number): CitationRef[] {
  return refs.filter((ref) => ref.index >= 1 && ref.index <= maxIndex);
}

function resolveUsedCitations(text: string, citations: MessageCitation[]): MessageCitation[] {
  const refs = validateCitations(parseCitations(text), citations.length);
  const byIndex = new Map(citations.map((citation) => [citation.index, citation]));

  const used: MessageCitation[] = [];
  for (const ref of refs) {
    const citation = byIndex.get(ref.index);
    if (citation) used.push(citation);
  }
  return used;
}

/**
 * Rewrites answer text so markers that point at the same source location
 * share one index (e.g. `[3][10]` → `[3]` when both are page 19), and
 * returns the collapsed citation list to persist alongside it.
 */
export function normalizeCitedAnswer(
  text: string,
  citations: MessageCitation[],
): { text: string; citations: MessageCitation[] } {
  const used = resolveUsedCitations(text, citations);
  if (used.length === 0) {
    return { text, citations: [] };
  }

  const indexMap = canonicalizeCitationIndexes(used);
  const collapsed = collapseCitationsByLocation(used);

  const rewritten = text.replace(CITATION_RE, (match, rawIndex: string) => {
    const index = Number(rawIndex);
    const canonical = indexMap.get(index);
    if (canonical == null) return match;
    return `[${canonical}]`;
  });

  // Collapse stacked duplicates introduced by remapping: [3][3] → [3]
  const deduped = rewritten.replace(/(\[(\d+)\])(?:\s*\[\2\])+/g, "$1");

  return { text: deduped, citations: collapsed };
}

/**
 * Resolves the citation markers actually used in generated text against the
 * full numbered citation list, collapsing entries that point at the same
 * source location (e.g. two chunks from the same PDF page).
 */
export function extractUsedCitations(text: string, citations: MessageCitation[]): MessageCitation[] {
  return normalizeCitedAnswer(text, citations).citations;
}
