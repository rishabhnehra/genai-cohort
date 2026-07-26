import { AppError, ErrorCodes } from "@/lib/errors";
import type { ExtractedPdfArtifact } from "../types";

type PdfTextItem = { str: string };
type PdfTextContent = { items: PdfTextItem[] };
type PdfPageProxy = { getTextContent: () => Promise<PdfTextContent> };

/**
 * Parses a PDF buffer into page-aware text using `pdf-parse`'s custom
 * `pagerender` hook (the library only exposes concatenated text by
 * default). Falls back gracefully if a page fails to render.
 */
export async function parsePdf(buffer: Buffer): Promise<ExtractedPdfArtifact> {
  // pdf-parse ships as CJS with no ESM-friendly types; import dynamically.
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = (pdfParseModule.default ?? pdfParseModule) as (
    data: Buffer,
    options?: Record<string, unknown>,
  ) => Promise<{ numpages: number }>;

  const pages: { page: number; text: string }[] = [];
  let pageNumber = 0;

  try {
    const result = await pdfParse(buffer, {
      pagerender: async (pageData: PdfPageProxy) => {
        pageNumber += 1;
        const currentPage = pageNumber;
        try {
          const textContent = await pageData.getTextContent();
          const text = textContent.items.map((item) => item.str).join(" ").trim();
          pages.push({ page: currentPage, text });
          return text;
        } catch {
          pages.push({ page: currentPage, text: "" });
          return "";
        }
      },
    });

    return {
      type: "pdf",
      numPages: result.numpages,
      pages,
    };
  } catch (error) {
    throw new AppError(ErrorCodes.EXTRACTION_FAILED, "Couldn't read that PDF.", {
      cause: error,
    });
  }
}
