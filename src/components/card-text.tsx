"use client";

import ReactMarkdown from "react-markdown";
import { highlight } from "sugar-high";

type HastText = { type: "text"; value: string };
type HastElement = {
  type: "element";
  tagName: string;
  properties?: { className?: string[] };
  children?: (HastText | HastElement)[];
};

function extractText(children: (HastText | HastElement)[]): string {
  return children
    .map((c) => (c.type === "text" ? c.value : c.children ? extractText(c.children) : ""))
    .join("");
}

export function CardText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          // pre is ONLY called for fenced code blocks — handle all block code here
          pre: ({ node }) => {
            const codeNode = (node as unknown as HastElement).children?.[0] as HastElement | undefined;
            if (codeNode?.type === "element" && codeNode.tagName === "code") {
              const raw = extractText(codeNode.children ?? []).replace(/\n$/, "");
              const html = highlight(raw);
              return (
                <div className="code-editor my-2 overflow-x-auto rounded-lg" style={{ background: "#0e1117" }}>
                  <pre className="px-4 py-3 m-0 overflow-x-auto">
                    <code
                      className="block font-mono text-[0.78rem] leading-relaxed text-[#cdd9e5] whitespace-pre"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  </pre>
                </div>
              );
            }
            return null;
          },
          // code is now only inline code
          code: ({ children }) => {
            const code = String(children);
            return (
              <code
                className="inline-block font-mono text-[0.82em] rounded px-[0.35em] py-[0.1em] mx-[0.1em] leading-none"
                style={{
                  background: "color-mix(in oklch, var(--dashboard-accent-teal) 12%, var(--muted) 50%)",
                  color: "var(--dashboard-accent-teal-strong)",
                }}
              >
                {code}
              </code>
            );
          },
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="font-heading text-lg font-bold mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="font-heading text-base font-semibold mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="font-heading text-sm font-semibold mb-1">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-[0.95em]">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border/60 pl-3 italic text-muted-foreground/70 my-2">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-border/40" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
