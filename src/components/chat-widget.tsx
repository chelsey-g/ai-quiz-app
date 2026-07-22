"use client";

import { useEffect, useRef, useState } from "react";
import { useChatWidget } from "@/components/chat-provider";
import { MentionInput } from "@/components/mention-input";
import { CardText } from "@/components/card-text";
import { AddToDeckButton } from "@/components/add-to-deck-button";

const DEFAULT_SIZE = { width: 384, height: 448 };
const MAXIMIZED_SIZE = { width: 640, height: 760 };
const MIN_WIDTH = 300;
const MIN_HEIGHT = 320;
const MAX_WIDTH = 900;
const MAX_HEIGHT = 900;

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

function MaximizeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 20.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
      />
    </svg>
  );
}

function MinimizeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9V4.5M15 9h4.5M15 9l5.25-5.25M15 15v4.5M15 15h4.5M15 15l5.25 5.25"
      />
    </svg>
  );
}

function getMessageText(message: { parts: { type: string; text?: string }[] }): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function ChatWidget() {
  const { open, setOpen, deckTitle, messages, status } = useChatWidget();
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState(DEFAULT_SIZE);
  const [maximized, setMaximized] = useState(false);
  const preMaximizeSize = useRef(DEFAULT_SIZE);
  const dragState = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(
    null
  );

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

  function handleResizeStart(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startY: e.clientY, startWidth: size.width, startHeight: size.height };
    e.currentTarget.setPointerCapture(e.pointerId);
    setMaximized(false);
  }

  function handleResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return;
    const { startX, startY, startWidth, startHeight } = dragState.current;
    // Panel is anchored bottom-right, so dragging the top-left handle left/up grows it.
    const nextWidth = startWidth + (startX - e.clientX);
    const nextHeight = startHeight + (startY - e.clientY);
    setSize({
      width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, nextWidth)),
      height: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, nextHeight)),
    });
  }

  function handleResizeEnd(e: React.PointerEvent<HTMLDivElement>) {
    dragState.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  function toggleMaximize() {
    if (maximized) {
      setSize(preMaximizeSize.current);
      setMaximized(false);
    } else {
      preMaximizeSize.current = size;
      setSize(MAXIMIZED_SIZE);
      setMaximized(true);
    }
  }

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
          style={{
            width: `min(${size.width}px, calc(100vw - 2.5rem))`,
            height: `min(${size.height}px, calc(100vh - 7rem))`,
          }}
          className="fixed bottom-20 right-5 z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        >
          <div
            onPointerDown={handleResizeStart}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
            className="absolute left-0 top-0 z-10 h-4 w-4 cursor-nwse-resize touch-none"
            aria-hidden="true"
          />

          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="truncate font-heading text-sm font-semibold text-foreground">
              {deckTitle ? `Asking about: ${deckTitle}` : "Quizly Assistant"}
            </p>
            <button
              type="button"
              onClick={toggleMaximize}
              aria-label={maximized ? "Restore chat size" : "Maximize chat"}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {maximized ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ask me anything, or type @ to reference a specific card.
              </p>
            )}
            {messages.map((message, index) => {
              const text = getMessageText(message);

              if (message.role === "user") {
                return (
                  <div key={message.id} className="text-right">
                    <div className="inline-block max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3 py-2 text-left text-sm text-primary-foreground shadow-sm">
                      {text}
                    </div>
                  </div>
                );
              }

              const previousMessage = messages[index - 1];
              const question =
                previousMessage && previousMessage.role === "user"
                  ? getMessageText(previousMessage)
                  : null;

              return (
                <div key={message.id} className="text-left">
                  <div className="inline-block max-w-[85%] rounded-lg rounded-bl-sm border border-border/60 bg-muted px-3 py-2 text-left shadow-sm">
                    <CardText text={text} className="text-sm leading-relaxed text-foreground" />
                  </div>
                  {question && text && status === "ready" && (
                    <AddToDeckButton front={question} back={text} />
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
