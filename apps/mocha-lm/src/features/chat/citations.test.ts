import { describe, expect, it } from "vitest";
import {
  buildCitationsFromChunks,
  canonicalizeCitationIndexes,
  citationPublicUrl,
  collapseCitationsByLocation,
  extractUsedCitations,
  formatCitationLocatorSummary,
  formatContextBlock,
  normalizeCitedAnswer,
  parseCitations,
  uniqueCitationsForSources,
  validateCitations,
} from "./citations";
import type { MessageCitation } from "./citations";
import type { RetrievedChunk } from "@/features/retrieval/types";

function chunk(
  chunkId: string,
  sourceId: string,
  page = 1,
): RetrievedChunk {
  return {
    chunkId,
    sourceId,
    sourceType: "PDF",
    sourceTitle: `Source ${sourceId}`,
    text: `Excerpt text for ${chunkId}`,
    locator: { kind: "pdf", page, excerpt: `Excerpt text for ${chunkId}` },
    indexVersion: 1,
    score: 1,
  };
}

describe("buildCitationsFromChunks", () => {
  it("numbers chunks 1..N in order", () => {
    const citations = buildCitationsFromChunks([chunk("c1", "s1"), chunk("c2", "s2")]);
    expect(citations.map((c) => c.index)).toEqual([1, 2]);
    expect(citations.map((c) => c.sourceId)).toEqual(["s1", "s2"]);
  });
});

describe("parseCitations", () => {
  it("extracts unique, in-order citation refs from both [n] and [Cn] markers", () => {
    const text = "Fact one [1]. Fact two [2][1]. Fact three [C3].";
    expect(parseCitations(text)).toEqual([
      { label: "[1]", index: 1 },
      { label: "[2]", index: 2 },
      { label: "[C3]", index: 3 },
    ]);
  });

  it("returns an empty array when there are no citations", () => {
    expect(parseCitations("No citations here.")).toEqual([]);
  });
});

describe("validateCitations", () => {
  it("drops refs outside the numbered citation range", () => {
    const refs = parseCitations("Grounded [1]. Hallucinated [7]. Also bad [0].");
    expect(validateCitations(refs, 2)).toEqual([{ label: "[1]", index: 1 }]);
  });
});

describe("canonicalizeCitationIndexes / collapseCitationsByLocation", () => {
  it("maps later same-page citations onto the earliest index", () => {
    const citations = buildCitationsFromChunks([
      chunk("c1", "s1", 19),
      chunk("c2", "s1", 20),
      chunk("c3", "s1", 19),
    ]);
    // indexes 1 and 3 share page 19
    const map = canonicalizeCitationIndexes([citations[0], citations[2]]);
    expect(map.get(1)).toBe(1);
    expect(map.get(3)).toBe(1);

    const collapsed = collapseCitationsByLocation([citations[0], citations[2]]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].index).toBe(1);
  });
});

describe("normalizeCitedAnswer / extractUsedCitations", () => {
  it("only resolves citation markers that exist in the numbered citation list", () => {
    const citations = buildCitationsFromChunks([chunk("c1", "s1"), chunk("c2", "s2")]);
    const text = "Claim A [1]. Claim B [2]. Hallucinated claim [9].";

    const used = extractUsedCitations(text, citations);

    expect(used).toHaveLength(2);
    expect(used.map((c) => c.index)).toEqual([1, 2]);
  });

  it("collapses same-page markers in text and citation metadata", () => {
    const citations = buildCitationsFromChunks([
      chunk("c1", "s1", 1),
      chunk("c2", "s1", 2),
      chunk("c3", "s1", 19),
      chunk("c4", "s1", 4),
      chunk("c5", "s1", 5),
      chunk("c6", "s1", 6),
      chunk("c7", "s1", 7),
      chunk("c8", "s1", 8),
      chunk("c9", "s1", 9),
      chunk("c10", "s1", 19),
    ]);

    const { text, citations: used } = normalizeCitedAnswer(
      "providing clarity and peace [3][10].",
      citations,
    );

    expect(text).toBe("providing clarity and peace [3].");
    expect(used).toHaveLength(1);
    expect(used[0].index).toBe(3);
    expect(used[0].locator).toMatchObject({ kind: "pdf", page: 19 });
  });

  it("returns an empty array when no known citations are used", () => {
    const citations = buildCitationsFromChunks([chunk("c1", "s1")]);
    expect(extractUsedCitations("Nothing cited here.", citations)).toEqual([]);
  });
});

describe("formatContextBlock", () => {
  it("renders numbered excerpts with source title and location", () => {
    const block = formatContextBlock([chunk("c1", "s1")]);
    expect(block).toContain("[1] (Source s1 — page 1)");
    expect(block).toContain("Excerpt text for c1");
  });
});

describe("formatCitationLocatorSummary / citationPublicUrl", () => {
  it("formats PDF pages for hover cards", () => {
    expect(formatCitationLocatorSummary({ kind: "pdf", page: 19 })).toBe("Page 19");
  });

  it("returns web URL only for web citations", () => {
    const web: MessageCitation = {
      index: 1,
      chunkId: "c1",
      sourceId: "s1",
      sourceType: "WEB",
      sourceTitle: "Example",
      locator: { kind: "web", url: "https://example.com/doc", excerpt: "hi" },
    };
    const pdf: MessageCitation = {
      index: 2,
      chunkId: "c2",
      sourceId: "s2",
      sourceType: "PDF",
      sourceTitle: "Paper",
      locator: { kind: "pdf", page: 3, excerpt: "hi" },
    };

    expect(citationPublicUrl(web)).toBe("https://example.com/doc");
    expect(citationPublicUrl(pdf)).toBeUndefined();
    expect(formatCitationLocatorSummary(web.locator)).toBe("example.com");
  });
});

describe("uniqueCitationsForSources", () => {
  it("dedupes by location for the Sources list", () => {
    const citations = buildCitationsFromChunks([
      chunk("c1", "s1", 19),
      chunk("c2", "s1", 19),
      chunk("c3", "s2", 1),
    ]);

    const unique = uniqueCitationsForSources(citations);
    expect(unique).toHaveLength(2);
    expect(unique.map((c) => c.index)).toEqual([1, 3]);
  });
});
