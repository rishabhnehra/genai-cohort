import { describe, expect, it } from "vitest";
import { fuseRankedLists } from "./rrf";
import type { RetrievedChunk } from "./types";

function chunk(chunkId: string, score: number): RetrievedChunk {
  return {
    chunkId,
    sourceId: "source-1",
    sourceType: "PDF",
    sourceTitle: "Test source",
    text: `text for ${chunkId}`,
    locator: { kind: "pdf", page: 1 },
    indexVersion: 1,
    score,
  };
}

describe("fuseRankedLists", () => {
  it("boosts documents that rank highly across multiple lists", () => {
    const listA = [chunk("chunk-a", 0.9), chunk("chunk-b", 0.8), chunk("chunk-c", 0.7)];
    const listB = [chunk("chunk-c", 0.95), chunk("chunk-a", 0.6), chunk("chunk-d", 0.5)];

    const fused = fuseRankedLists([listA, listB]);
    const ids = fused.map((entry) => entry.chunkId);

    // chunk-a (rank 1 + rank 2) and chunk-c (rank 3 + rank 1) both appear in
    // both lists and should outrank chunk-b/chunk-d, which only appear once.
    expect(ids.slice(0, 2).sort()).toEqual(["chunk-a", "chunk-c"]);
    expect(ids).toContain("chunk-b");
    expect(ids).toContain("chunk-d");
    expect(ids.indexOf("chunk-a")).toBeLessThan(ids.indexOf("chunk-b"));
    expect(ids.indexOf("chunk-c")).toBeLessThan(ids.indexOf("chunk-d"));
  });

  it("passes a single result list through unchanged (rank-ordered)", () => {
    const listA = [chunk("chunk-a", 0.9), chunk("chunk-b", 0.5)];
    const fused = fuseRankedLists([listA, []]);

    expect(fused.map((entry) => entry.chunkId)).toEqual(["chunk-a", "chunk-b"]);
  });

  it("returns an empty array when every list is empty", () => {
    expect(fuseRankedLists([[], []])).toEqual([]);
  });

  it("keeps chunk identity (sourceId/chunkId/locator) intact after fusion", () => {
    const listA = [chunk("chunk-a", 0.9)];
    const listB = [chunk("chunk-a", 0.4)];

    const [fused] = fuseRankedLists([listA, listB]);

    expect(fused.chunkId).toBe("chunk-a");
    expect(fused.sourceId).toBe("source-1");
    expect(fused.locator).toEqual({ kind: "pdf", page: 1 });
  });
});
