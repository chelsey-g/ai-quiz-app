"use client";

import { highlight } from "sugar-high";
import type { ReactNode } from "react";

const EXAMPLE_RE = /\bExample:\s*/i;

// Matches backtick-wrapped tokens OR camelCase identifiers (at least 2 humps)
const INLINE_CODE_RE = /`[^`]+`|\b[a-z][a-z0-9]*(?:[A-Z][a-z0-9]*)+[a-z0-9]*\b/g;

function InlineToken({ children }: { children: string }) {
  return (
    <code
      className="inline-block font-mono text-[0.82em] rounded px-[0.35em] py-[0.1em] mx-[0.1em] leading-none"
      style={{
        background: "color-mix(in oklch, var(--dashboard-accent-teal) 12%, var(--muted) 50%)",
        color: "var(--dashboard-accent-teal-strong)",
      }}
    >
      {children}
    </code>
  );
}

function tokenize(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  INLINE_CODE_RE.lastIndex = 0;

  while ((match = INLINE_CODE_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const raw = match[0];
    const code = raw.startsWith("`") ? raw.slice(1, -1) : raw;
    parts.push(<InlineToken key={match.index}>{code}</InlineToken>);
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function CodeBlock({ code }: { code: string }) {
  const html = highlight(code);
  return (
    <span className="mt-2 block">
      <span className="block text-[10px] font-semibold uppercase tracking-wider opacity-40 mb-1.5">
        Example
      </span>
      <code
        className="block whitespace-pre-wrap rounded-lg px-3 py-2.5 font-mono text-[0.78rem] leading-relaxed"
        style={{ background: "color-mix(in oklch, var(--muted) 60%, transparent)" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </span>
  );
}

export function CardText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const match = EXAMPLE_RE.exec(text);

  if (!match) {
    return <p className={className}>{tokenize(text)}</p>;
  }

  const before = text.slice(0, match.index).trim();
  const example = text.slice(match.index + match[0].length).trim();

  return (
    <p className={className}>
      {before && <>{tokenize(before)}<br /></>}
      <CodeBlock code={example} />
    </p>
  );
}
