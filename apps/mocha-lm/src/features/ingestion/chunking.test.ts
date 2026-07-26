import { describe, expect, it } from "vitest";
import { chunkArtifact } from "./chunking";
import type {
  ExtractedPdfArtifact,
  ExtractedSrtArtifact,
  ExtractedWebArtifact,
} from "./types";

describe("chunkArtifact", () => {
  it("preserves page numbers as PDF locators", async () => {
    const artifact: ExtractedPdfArtifact = {
      type: "pdf",
      numPages: 2,
      pages: [
        { page: 1, text: "This is the content of the first page of the document." },
        { page: 2, text: "This is the content of the second page of the document." },
      ],
    };

    const chunks = await chunkArtifact(artifact);

    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks[0].locator).toMatchObject({ kind: "pdf", page: 1 });
    expect(chunks.at(-1)?.locator).toMatchObject({ kind: "pdf", page: 2 });
    expect(chunks.every((chunk) => chunk.checksum.length === 64)).toBe(true);
  });

  it("preserves cue index/timing as SRT locators", async () => {
    const artifact: ExtractedSrtArtifact = {
      type: "srt",
      cues: [
        { index: 1, startMs: 0, endMs: 2000, text: "Hello there." },
        { index: 2, startMs: 2000, endMs: 4000, text: "General Kenobi." },
      ],
    };

    const chunks = await chunkArtifact(artifact);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].locator).toMatchObject({
      kind: "srt",
      cueIndex: 1,
      startMs: 0,
      endMs: 4000,
    });
  });

  it("preserves URL/heading as web locators", async () => {
    const artifact: ExtractedWebArtifact = {
      type: "web",
      url: "https://example.com/article",
      title: "Example Article",
      text: "This is the body text of an example article used for testing chunking.",
      snapshotKey: "snapshot.html",
    };

    const chunks = await chunkArtifact(artifact);

    expect(chunks).toHaveLength(1);
    expect(chunks[0].locator).toMatchObject({
      kind: "web",
      url: "https://example.com/article",
      heading: "Example Article",
    });
    if (chunks[0].locator.kind === "web") {
      expect(chunks[0].locator.charStart).toBe(0);
      expect(chunks[0].locator.charEnd).toBe(artifact.text.length);
    }
  });

  it("assigns strictly increasing ordinals across segments", async () => {
    const artifact: ExtractedPdfArtifact = {
      type: "pdf",
      numPages: 2,
      pages: [
        { page: 1, text: "Page one text." },
        { page: 2, text: "Page two text." },
      ],
    };

    const chunks = await chunkArtifact(artifact);
    const ordinals = chunks.map((chunk) => chunk.ordinal);

    expect(ordinals).toEqual([...ordinals].sort((a, b) => a - b));
    expect(new Set(ordinals).size).toBe(ordinals.length);
  });
});
