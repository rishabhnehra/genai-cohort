"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";
import type { MessageCitation } from "../citations";

type MarkdownMessageProps = {
  content: string;
  citationsByIndex: Map<number, MessageCitation>;
  indexMap: Map<number, number>;
  onCitationClick: (citation: MessageCitation) => void;
  className?: string;
};

function CitationChip({
  citation,
  onCitationClick,
}: {
  citation: MessageCitation;
  onCitationClick: (citation: MessageCitation) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onCitationClick(citation)}
      className={cn(
        "mx-0.5 inline-flex size-5 -translate-y-0.5 items-center justify-center rounded-full bg-primary/15 align-middle text-xs font-medium text-primary transition-colors hover:bg-primary/25",
      )}
    >
      {citation.index}
    </button>
  );
}

/** Turns `[1]` / `[C2]` markers inside plain text into clickable citation chips. */
function renderTextWithCitations(
  text: string,
  citationsByIndex: Map<number, MessageCitation>,
  indexMap: Map<number, number>,
  onCitationClick: (citation: MessageCitation) => void,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /\[C?(\d+)\]/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let lastDisplayIndex: number | null = null;
  let key = 0;

  while ((match = regex.exec(text))) {
    const rawIndex = Number(match[1]);
    const displayIndex = indexMap.get(rawIndex) ?? rawIndex;
    const citation =
      citationsByIndex.get(displayIndex) ?? citationsByIndex.get(rawIndex);

    if (!citation) continue;

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
      lastDisplayIndex = null;
    }

    if (lastDisplayIndex === displayIndex) {
      lastIndex = match.index + match[0].length;
      continue;
    }

    nodes.push(
      <CitationChip
        key={`cite-${key++}`}
        citation={{ ...citation, index: displayIndex }}
        onCitationClick={onCitationClick}
      />,
    );
    lastDisplayIndex = displayIndex;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function injectCitations(
  children: ReactNode,
  citationsByIndex: Map<number, MessageCitation>,
  indexMap: Map<number, number>,
  onCitationClick: (citation: MessageCitation) => void,
): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === "string") {
      return renderTextWithCitations(child, citationsByIndex, indexMap, onCitationClick);
    }
    if (isValidElement(child)) {
      const element = child as ReactElement<{ children?: ReactNode }>;
      if (element.props.children == null) return child;
      return cloneElement(
        element,
        undefined,
        injectCitations(element.props.children, citationsByIndex, indexMap, onCitationClick),
      );
    }
    return child;
  });
}

/**
 * Renders assistant markdown (GFM lists, emphasis, code, etc.) while keeping
 * `[n]` citation markers as interactive chips.
 */
export function MarkdownMessage({
  content,
  citationsByIndex,
  indexMap,
  onCitationClick,
  className,
}: MarkdownMessageProps) {
  if (!content.trim()) {
    return <span className="text-muted-foreground">…</span>;
  }

  const withCites = (children: ReactNode) =>
    injectCitations(children, citationsByIndex, indexMap, onCitationClick);

  // One shared gap for paragraphs, lists, and list items so spacing stays even.
  const stackGap = "gap-2.5";

  return (
    <div
      className={cn(
        "markdown-message flex max-w-none flex-col text-base leading-relaxed",
        stackGap,
        "[&_p]:m-0",
        "[&_strong]:font-bold",
        "[&_em]:italic",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_blockquote]:m-0 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:italic",
        "[&_hr]:m-0 [&_hr]:border-border",
        "[&_h1]:m-0 [&_h1]:font-heading [&_h1]:text-xl [&_h1]:font-semibold",
        "[&_h2]:m-0 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold",
        "[&_h3]:m-0 [&_h3]:font-heading [&_h3]:text-base [&_h3]:font-semibold",
        "[&_code]:rounded-sm [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm",
        "[&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-none [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted/50 [&_pre]:p-2.5",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{withCites(children)}</p>,
          // Flex + CSS counters keep marker/text alignment and item gaps even
          // whether the model emits a tight or loose list.
          ol: ({ children }) => (
            <ol
              className={cn(
                "m-0 flex list-none flex-col p-0 [counter-reset:item]",
                stackGap,
                "[&>li]:[counter-increment:item]",
                "[&>li]:before:w-5 [&>li]:before:shrink-0 [&>li]:before:text-right",
                "[&>li]:before:content-[counter(item)_'.']",
              )}
            >
              {children}
            </ol>
          ),
          ul: ({ children }) => (
            <ul
              className={cn(
                "m-0 flex list-none flex-col p-0",
                stackGap,
                "[&>li]:before:w-5 [&>li]:before:shrink-0 [&>li]:before:text-center",
                "[&>li]:before:content-['•']",
              )}
            >
              {children}
            </ul>
          ),
          li: ({ children }) => (
            <li className="flex gap-2 leading-relaxed">
              <div className="min-w-0 flex-1 [&>p]:m-0 [&>p+p]:mt-2.5">{withCites(children)}</div>
            </li>
          ),
          strong: ({ children }) => <strong>{withCites(children)}</strong>,
          em: ({ children }) => <em>{withCites(children)}</em>,
          h1: ({ children }) => <h1>{withCites(children)}</h1>,
          h2: ({ children }) => <h2>{withCites(children)}</h2>,
          h3: ({ children }) => <h3>{withCites(children)}</h3>,
          blockquote: ({ children }) => <blockquote>{withCites(children)}</blockquote>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {withCites(children)}
            </a>
          ),
          // Keep code as-is so citation regex doesn't mangle snippets.
          code: ({ children, className: codeClassName }) => (
            <code className={codeClassName}>{children}</code>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
