import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document } from "@langchain/core/documents";
import { SRTLoader } from "@langchain/community/document_loaders/fs/srt";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLASS_SUBTITLE_DIR = path.join(__dirname, "class-subtitle");

async function collectSrtFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSrtFiles(fullPath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".srt")) {
      files.push(fullPath);
    }
  }

  return files;
}

export async function loadSubtitleDocuments(): Promise<Document[]> {
  const srtFiles = await collectSrtFiles(CLASS_SUBTITLE_DIR);
  const documents: Document[] = [];

  for (const filePath of srtFiles) {
    const loader = new SRTLoader(filePath);
    const docs = await loader.load();

    const relativePath = path.relative(CLASS_SUBTITLE_DIR, filePath);
    const parts = relativePath.split(path.sep);
    const moduleName = parts[0] ?? "unknown";
    const lectureName = parts[1] ?? path.basename(filePath, ".srt");

    for (const doc of docs) {
      if (!doc.pageContent.trim()) continue;

      documents.push(
        new Document({
          pageContent: doc.pageContent,
          metadata: {
            ...doc.metadata,
            source: relativePath,
            module: moduleName,
            lecture: lectureName,
          },
        }),
      );
    }
  }

  return documents;
}
