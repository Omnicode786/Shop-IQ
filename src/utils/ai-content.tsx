import { Fragment, type ReactNode } from "react";

export type ContentBlock =
  | { type: "h2"; content: string }
  | { type: "h3"; content: string }
  | { type: "h4"; content: string }
  | { type: "p"; content: string }
  | { type: "quote"; content: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

export function renderInlineFormatting(text: string): ReactNode[] {
  const parts = text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g)
    .filter(Boolean);

  return parts.map((part, index) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (/^`[^`]+`$/.test(part)) {
      return (
        <code
          key={index}
          className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const [, label, href] = link;
      const safeHref = /^https?:\/\//i.test(href) ? href : "#";

      return (
        <a
          key={index}
          href={safeHref}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline underline-offset-4"
        >
          {label}
        </a>
      );
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}

function isShortHeading(line: string, nextLine?: string) {
  const clean = line.trim();

  if (!clean) return false;
  if (clean.length > 80) return false;
  if (/[:.!?]$/.test(clean)) return false;
  if (/^[-*•]\s+/.test(clean)) return false;
  if (/^\d+[\.)]\s+/.test(clean)) return false;
  if (/^#{1,4}\s+/.test(clean)) return false;
  if (!nextLine?.trim()) return false;

  return true;
}

export function parseAiContent(raw: string): ContentBlock[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const lines = text.split("\n");
  const blocks: ContentBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1]?.trim();

    if (!line) {
      i += 1;
      continue;
    }

    if (/^###\s+/.test(line)) {
      blocks.push({ type: "h4", content: line.replace(/^###\s+/, "").trim() });
      i += 1;
      continue;
    }

    if (/^##\s+/.test(line)) {
      blocks.push({ type: "h3", content: line.replace(/^##\s+/, "").trim() });
      i += 1;
      continue;
    }

    if (/^#\s+/.test(line)) {
      blocks.push({ type: "h2", content: line.replace(/^#\s+/, "").trim() });
      i += 1;
      continue;
    }

    if (/^>\s+/.test(line)) {
      const quoteLines = [line.replace(/^>\s+/, "").trim()];
      let j = i + 1;

      while (j < lines.length && /^>\s+/.test(lines[j].trim())) {
        quoteLines.push(lines[j].trim().replace(/^>\s+/, "").trim());
        j += 1;
      }

      blocks.push({ type: "quote", content: quoteLines.join(" ") });
      i = j;
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      const items: string[] = [line.replace(/^[-*•]\s+/, "").trim()];
      let j = i + 1;

      while (j < lines.length && /^[-*•]\s+/.test(lines[j].trim())) {
        items.push(lines[j].trim().replace(/^[-*•]\s+/, "").trim());
        j += 1;
      }

      blocks.push({ type: "ul", items });
      i = j;
      continue;
    }

    if (/^\d+[\.)]\s+/.test(line)) {
      const items: string[] = [line.replace(/^\d+[\.)]\s+/, "").trim()];
      let j = i + 1;

      while (j < lines.length && /^\d+[\.)]\s+/.test(lines[j].trim())) {
        items.push(lines[j].trim().replace(/^\d+[\.)]\s+/, "").trim());
        j += 1;
      }

      blocks.push({ type: "ol", items });
      i = j;
      continue;
    }

    if (isShortHeading(line, nextLine)) {
      blocks.push({ type: "h3", content: line });
      i += 1;
      continue;
    }

    const paragraphLines = [line];
    let j = i + 1;

    while (j < lines.length) {
      const candidate = lines[j].trim();

      if (!candidate) break;
      if (/^#{1,4}\s+/.test(candidate)) break;
      if (/^>\s+/.test(candidate)) break;
      if (/^[-*•]\s+/.test(candidate)) break;
      if (/^\d+[\.)]\s+/.test(candidate)) break;
      if (isShortHeading(candidate, lines[j + 1]?.trim())) break;

      paragraphLines.push(candidate);
      j += 1;
    }

    blocks.push({ type: "p", content: paragraphLines.join(" ") });
    i = j;
  }

  return blocks;
}

export function FormattedAiContent({ content }: { content: string }) {
  const blocks = parseAiContent(content);

  if (!blocks.length) {
    return <p className="text-sm text-muted-foreground">{content}</p>;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "h2":
            return (
              <h2 key={index} className="text-base font-semibold tracking-tight text-foreground">
                {renderInlineFormatting(block.content)}
              </h2>
            );

          case "h3":
            return (
              <h3
                key={index}
                className="text-sm font-semibold uppercase tracking-[0.12em] text-foreground/85"
              >
                {renderInlineFormatting(block.content)}
              </h3>
            );

          case "h4":
            return (
              <h4 key={index} className="text-sm font-semibold text-foreground">
                {renderInlineFormatting(block.content)}
              </h4>
            );

          case "quote":
            return (
              <blockquote
                key={index}
                className="border-l-2 border-primary/30 pl-4 text-sm leading-6 text-muted-foreground"
              >
                {renderInlineFormatting(block.content)}
              </blockquote>
            );

          case "ul":
            return (
              <ul key={index} className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInlineFormatting(item)}</li>
                ))}
              </ul>
            );

          case "ol":
            return (
              <ol key={index} className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>{renderInlineFormatting(item)}</li>
                ))}
              </ol>
            );

          case "p":
            return (
              <p key={index} className="text-sm leading-6 text-muted-foreground">
                {renderInlineFormatting(block.content)}
              </p>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
