import { createHash } from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { limits } from "@/lib/limits";
import type {
  CitationLocator,
  ExtractedArtifact,
  ExtractedSrtCue,
  NormalizedChunk,
} from "./types";

export type ChunkSource = {
  /** Raw text for this logical segment (a PDF page, an SRT cue window, a web page). */
  text: string;
  /** Builds the citation locator for a chunk carved out of this segment. */
  buildLocator: (excerpt: string, charStart: number, charEnd: number) => CitationLocator;
};

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Splits one or more text segments (each carrying its own locator factory,
 * e.g. a PDF page or web document) into ~1000/200 character chunks via
 * `RecursiveCharacterTextSplitter`, preserving per-chunk citation locators.
 */
export async function chunkSources(sources: ChunkSource[]): Promise<NormalizedChunk[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: limits.chunking.chunkSize,
    chunkOverlap: limits.chunking.chunkOverlap,
  });

  const chunks: NormalizedChunk[] = [];
  let ordinal = 0;

  for (const source of sources) {
    const trimmedSource = source.text.trim();
    if (!trimmedSource) continue;

    const pieces = await splitter.splitText(trimmedSource);
    let searchFrom = 0;

    for (const piece of pieces) {
      const trimmedPiece = piece.trim();
      if (!trimmedPiece) continue;

      const lookupStart = Math.max(0, searchFrom - limits.chunking.chunkOverlap);
      let charStart = trimmedSource.indexOf(piece, lookupStart);
      if (charStart === -1) charStart = trimmedSource.indexOf(piece);
      if (charStart === -1) charStart = searchFrom;
      const charEnd = charStart + piece.length;
      searchFrom = charEnd;

      const excerpt = trimmedPiece.slice(0, 240);

      chunks.push({
        chunkId: `chunk-${ordinal}`,
        ordinal,
        text: trimmedPiece,
        locator: source.buildLocator(excerpt, charStart, charEnd),
        checksum: sha256(trimmedPiece),
      });
      ordinal += 1;
    }
  }

  return chunks;
}

type SrtWindow = { text: string; startCue: ExtractedSrtCue; endCue: ExtractedSrtCue };

/** Groups consecutive SRT cues into ~chunkSize windows before splitting. */
function groupSrtCues(cues: ExtractedSrtCue[]): SrtWindow[] {
  const windows: SrtWindow[] = [];

  let current: SrtWindow | null = null;

  for (const cue of cues) {
    if (!current) {
      current = { text: cue.text, startCue: cue, endCue: cue };
      continue;
    }

    if (current.text.length + cue.text.length + 1 <= limits.chunking.chunkSize) {
      current.text += ` ${cue.text}`;
      current.endCue = cue;
    } else {
      windows.push(current);
      current = { text: cue.text, startCue: cue, endCue: cue };
    }
  }

  if (current) windows.push(current);

  return windows;
}

/** Builds chunker input segments (with locator factories) from an extracted artifact. */
export function buildChunkSources(artifact: ExtractedArtifact): ChunkSource[] {
  if (artifact.type === "pdf") {
    return artifact.pages
      .filter((page) => page.text.trim().length > 0)
      .map((page) => ({
        text: page.text,
        buildLocator: (excerpt): CitationLocator => ({
          kind: "pdf",
          page: page.page,
          excerpt,
        }),
      }));
  }

  if (artifact.type === "srt") {
    return groupSrtCues(artifact.cues).map((window) => ({
      text: window.text,
      buildLocator: (excerpt): CitationLocator => ({
        kind: "srt",
        cueIndex: window.startCue.index,
        startMs: window.startCue.startMs,
        endMs: window.endCue.endMs,
        excerpt,
      }),
    }));
  }

  return [
    {
      text: artifact.text,
      buildLocator: (excerpt, charStart, charEnd): CitationLocator => ({
        kind: "web",
        url: artifact.url,
        heading: artifact.title,
        charStart,
        charEnd,
        excerpt,
      }),
    },
  ];
}

export async function chunkArtifact(artifact: ExtractedArtifact): Promise<NormalizedChunk[]> {
  return chunkSources(buildChunkSources(artifact));
}
