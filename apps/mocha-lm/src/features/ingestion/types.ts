export type CitationLocator =
  | { kind: "pdf"; page: number; excerpt?: string }
  | {
      kind: "srt";
      cueIndex: number;
      startMs: number;
      endMs: number;
      excerpt?: string;
    }
  | {
      kind: "web";
      url: string;
      heading?: string;
      charStart?: number;
      charEnd?: number;
      excerpt?: string;
    };

export type NormalizedChunk = {
  chunkId: string;
  ordinal: number;
  text: string;
  locator: CitationLocator;
  checksum: string;
};

export type IngestionJobPayload = {
  sourceId: string;
  userId: string;
  notebookId: string;
  indexVersion: number;
};

/** Per-page text extracted from a PDF, 1-indexed to match citation locators. */
export type ExtractedPdfPage = {
  page: number;
  text: string;
};

export type ExtractedPdfArtifact = {
  type: "pdf";
  numPages: number;
  pages: ExtractedPdfPage[];
};

export type ExtractedSrtCue = {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
};

export type ExtractedSrtArtifact = {
  type: "srt";
  cues: ExtractedSrtCue[];
};

export type ExtractedWebArtifact = {
  type: "web";
  url: string;
  title: string;
  text: string;
  /** Sanitized HTML snapshot key (relative to the `web-snapshots` bucket). */
  snapshotKey: string;
};

export type ExtractedArtifact =
  | ExtractedPdfArtifact
  | ExtractedSrtArtifact
  | ExtractedWebArtifact;
