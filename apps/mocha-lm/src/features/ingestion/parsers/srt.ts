import { AppError, ErrorCodes } from "@/lib/errors";
import type { ExtractedSrtArtifact, ExtractedSrtCue } from "../types";

const TIMESTAMP_RE = /(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/;

function timestampToMs(timestamp: string): number {
  const match = TIMESTAMP_RE.exec(timestamp);
  if (!match) return 0;
  const [, hours, minutes, seconds, millis] = match;
  return (
    Number(hours) * 3_600_000 +
    Number(minutes) * 60_000 +
    Number(seconds) * 1_000 +
    Number(millis)
  );
}

/** Minimal, dependency-free SubRip (.srt) cue parser. */
export function parseSrt(content: string): ExtractedSrtArtifact {
  const normalized = content.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
  const blocks = normalized.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

  const cues: ExtractedSrtCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 2) continue;

    // First line is a numeric cue index (optional in malformed files); the
    // timestamp line may therefore be lines[0] or lines[1].
    let cursor = 0;
    let index = cues.length + 1;
    if (/^\d+$/.test(lines[0].trim())) {
      index = Number(lines[0].trim());
      cursor = 1;
    }

    const timestampLine = lines[cursor];
    const timestampMatch = timestampLine?.match(
      /(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/,
    );
    if (!timestampMatch) continue;

    const text = lines
      .slice(cursor + 1)
      .join("\n")
      .replace(/<[^>]+>/g, "") // strip basic HTML-ish styling tags
      .trim();

    if (!text) continue;

    cues.push({
      index,
      startMs: timestampToMs(timestampMatch[1]),
      endMs: timestampToMs(timestampMatch[2]),
      text,
    });
  }

  if (cues.length === 0) {
    throw new AppError(ErrorCodes.EXTRACTION_FAILED, "Couldn't find any subtitle cues in that file.");
  }

  return { type: "srt", cues };
}
