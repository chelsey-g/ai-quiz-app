"use client";

import { useEffect, useRef } from "react";
import { useChatWidget } from "@/components/chat-provider";
import { MentionInput } from "@/components/mention-input";
import { CardText } from "@/components/card-text";

function BubbleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.4 0-2.727-.278-3.906-.777L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export function ChatWidget() {
  const { open, setOpen, deckTitle, messages, status } = useChatWidget();
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, setOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? <CloseIcon className="h-5 w-5" /> : <BubbleIcon className="h-5 w-5" />}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-5 z-50 flex h-[28rem] w-80 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl sm:w-96"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="font-heading text-sm font-semibold text-foreground">
              {deckTitle ? `Asking about: ${deckTitle}` : "Quizly Assistant"}
            </p>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ask me anything, or type @ to reference a specific card.
              </p>
            )}
            {messages.map((message) => {
              const text = message.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("");

              return (
                <div key={message.id} className={message.role === "user" ? "text-right" : "text-left"}>
                  {message.role === "user" ? (
                    <div className="inline-block max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3 py-2 text-left text-sm text-primary-foreground shadow-sm">
                      {text}
                    </div>
                  ) : (
                    <div className="inline-block max-w-[85%] rounded-lg rounded-bl-sm border border-border/60 bg-muted px-3 py-2 text-left shadow-sm">
                      <CardText text={text} className="text-sm leading-relaxed text-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
            {status === "submitted" && <p className="text-sm text-muted-foreground">Thinking…</p>}
          </div>

          <MentionInput />
        </div>
      )}
    </>
  );
}
