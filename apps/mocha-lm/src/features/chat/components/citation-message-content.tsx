"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationCarousel,
  InlineCitationCarouselContent,
  InlineCitationCarouselItem,
  InlineCitationQuote,
  InlineCitationSource,
} from "@/components/ai-elements/inline-citation";
import { MessageResponse } from "@/components/ai-elements/message";
import { cn } from "@/lib/utils";
import {
  canonicalizeCitationIndexes,
  citationPublicUrl,
  formatCitationLocatorSummary,
  type MessageCitation,
} from "../citations";

type CitationMessageContentProps = {
  role: "user" | "assistant";
  text: string;
  citations: MessageCitation[];
  failed?: boolean;
  isAnimating?: boolean;
  onCitationClick: (citation: MessageCitation) => void;
  className?: string;
};

type ContentPart =
  | { type: "text"; text: string }
  | { type: "citation"; citation: MessageCitation };

function splitCitations(
  text: string,
  citationsByIndex: Map<number, MessageCitation>,
  indexMap: Map<number, number>,
): ContentPart[] {
  const parts: ContentPart[] = [];
  const regex = /\[C?(\d+)\]/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let lastDisplayIndex: number | null = null;

  while ((match = regex.exec(text))) {
    const rawIndex = Number(match[1]);
    const displayIndex = indexMap.get(rawIndex) ?? rawIndex;
    const citation =
      citationsByIndex.get(displayIndex) ?? citationsByIndex.get(rawIndex);
    if (!citation) continue;

    if (match.index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
      lastDisplayIndex = null;
    }

    if (lastDisplayIndex === displayIndex && parts.at(-1)?.type === "citation") {
      lastIndex = match.index + match[0].length;
      continue;
    }

    parts.push({
      type: "citation",
      citation: { ...citation, index: displayIndex },
    });
    lastDisplayIndex = displayIndex;
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }

  return parts;
}

function buildCitationMaps(citations: MessageCitation[]) {
  const indexMap = canonicalizeCitationIndexes(citations);
  const citationsByIndex = new Map(
    citations.map((citation) => [
      indexMap.get(citation.index) ?? citation.index,
      { ...citation, index: indexMap.get(citation.index) ?? citation.index },
    ]),
  );

  for (const citation of citations) {
    if (!citationsByIndex.has(citation.index)) {
      citationsByIndex.set(citation.index, citation);
    }
  }

  return { citationsByIndex, indexMap };
}

function CitationMarker({
  citation,
  onCitationClick,
}: {
  citation: MessageCitation;
  onCitationClick: (citation: MessageCitation) => void;
}) {
  const url = citationPublicUrl(citation);
  const description = formatCitationLocatorSummary(citation.locator);
  const excerpt = citation.locator.excerpt;

  return (
    <InlineCitation>
      <InlineCitationCard>
        <InlineCitationCardTrigger
          sources={url ? [url] : [citation.sourceTitle]}
          onClick={(event) => {
            event.preventDefault();
            onCitationClick(citation);
          }}
        >
          {citation.index}
        </InlineCitationCardTrigger>
        <InlineCitationCardBody>
          <InlineCitationCarousel>
            <InlineCitationCarouselContent>
              <InlineCitationCarouselItem>
                <InlineCitationSource
                  description={description}
                  title={citation.sourceTitle}
                  url={url}
                />
                {excerpt ? <InlineCitationQuote>{excerpt}</InlineCitationQuote> : null}
              </InlineCitationCarouselItem>
            </InlineCitationCarouselContent>
          </InlineCitationCarousel>
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  );
}

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
      <CitationMarker
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

function UserPlainText({
  content,
  citationsByIndex,
  indexMap,
  onCitationClick,
}: {
  content: string;
  citationsByIndex: Map<number, MessageCitation>;
  indexMap: Map<number, number>;
  onCitationClick: (citation: MessageCitation) => void;
}) {
  const parts = splitCitations(content, citationsByIndex, indexMap);
  if (parts.length === 0) {
    return <span className="text-muted-foreground">…</span>;
  }

  return (
    <>
      {parts.map((part, index) =>
        part.type === "text" ? (
          <span key={index}>{part.text}</span>
        ) : (
          <CitationMarker
            key={index}
            citation={part.citation}
            onCitationClick={onCitationClick}
          />
        ),
      )}
    </>
  );
}

/** Renders message text with inline citation hover cards; assistant answers use Streamdown. */
export function CitationMessageContent({
  role,
  text,
  citations,
  failed,
  isAnimating = false,
  onCitationClick,
  className,
}: CitationMessageContentProps) {
  const trimmed = text.trim();
  if (!trimmed) {
    return <span className="text-muted-foreground">…</span>;
  }

  const { citationsByIndex, indexMap } = buildCitationMaps(citations);

  if (role === "user") {
    return (
      <div className={cn("whitespace-pre-wrap text-base leading-relaxed", className)}>
        <UserPlainText
          content={trimmed}
          citationsByIndex={citationsByIndex}
          indexMap={indexMap}
          onCitationClick={onCitationClick}
        />
      </div>
    );
  }

  const withCites = (children: ReactNode) =>
    injectCitations(children, citationsByIndex, indexMap, onCitationClick);

  return (
    <div className={cn("text-base leading-relaxed", failed && "text-destructive", className)}>
      <MessageResponse
        isAnimating={isAnimating}
        components={{
          p: ({ children }) => <p>{withCites(children)}</p>,
          li: ({ children }) => <li>{withCites(children)}</li>,
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
        {trimmed}
      </MessageResponse>
    </div>
  );
}
