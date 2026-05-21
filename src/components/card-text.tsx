"use client";

import ReactMarkdown from "react-markdown";
import { highlight } from "sugar-high";

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
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          h1: ({ children }) => <h1 className="font-heading text-lg font-bold mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="font-heading text-base font-semibold mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="font-heading text-sm font-semibold mb-1">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-[0.95em]">{children}</li>,
          code: ({ children, className: cls }) => {
            const isBlock = cls?.startsWith("language-");
            const code = String(children).replace(/\n$/, "");
            if (isBlock) {
              const html = highlight(code);
              return (
                <code
                  className="block whitespace-pre-wrap rounded-lg px-3 py-2.5 font-mono text-[0.78rem] leading-relaxed my-2"
                  style={{ background: "color-mix(in oklch, var(--muted) 60%, transparent)" }}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              );
            }
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
          pre: ({ children }) => <>{children}</>,
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
