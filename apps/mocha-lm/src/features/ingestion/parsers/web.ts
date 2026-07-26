import * as cheerio from "cheerio";
import sanitizeHtml from "sanitize-html";
import { AppError, ErrorCodes } from "@/lib/errors";

export type ParsedWebPage = {
  title: string;
  text: string;
  sanitizedHtml: string;
};

const STRIP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "svg",
  "nav",
  "footer",
  "header",
  "form",
  "[aria-hidden='true']",
];

/**
 * Parses raw HTML into plain text for chunking/embedding plus a sanitized
 * HTML snapshot (safe to render back to the user in the citation viewer).
 */
export function parseWebPage(html: string, url: string): ParsedWebPage {
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(html);
  } catch (error) {
    throw new AppError(ErrorCodes.EXTRACTION_FAILED, "Couldn't parse that page.", {
      cause: error,
    });
  }

  const title = $("title").first().text().trim() || url;

  STRIP_SELECTORS.forEach((selector) => $(selector).remove());

  const bodyHtml = $("body").length ? $("body").html() ?? "" : $.html();

  const text = $("body").length
    ? $("body").text().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
    : $.root().text().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  if (!text) {
    throw new AppError(ErrorCodes.EXTRACTION_FAILED, "That page didn't contain any readable text.");
  }

  const sanitizedHtml = sanitizeHtml(bodyHtml, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["h1", "h2", "img", "mark"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["id", "class"],
      img: ["src", "alt"],
      a: ["href", "name", "target", "rel"],
    },
    allowedSchemes: ["http", "https", "mailto"],
  });

  return { title, text, sanitizedHtml };
}
