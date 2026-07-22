"use client";

import { useRef, useState } from "react";
import { useChatWidget, type MentionableCard } from "@/components/chat-provider";

const MENTION_PATTERN = /(?:^|\s)@(\w*)$/;

function MentionSuggestions({
  cards,
  onSelect,
}: {
  cards: MentionableCard[];
  onSelect: (card: MentionableCard) => void;
}) {
  if (cards.length === 0) {
    return (
      <div className="border-t border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        No matching cards. Open a deck to reference its cards.
      </div>
    );
  }

  return (
    <div className="max-h-40 overflow-y-auto border-t border-border bg-card">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onSelect(card)}
          className="block w-full truncate px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
        >
          {card.front}
        </button>
      ))}
    </div>
  );
}

export function MentionInput() {
  const { deckId, availableCards, sendMessage, status } = useChatWidget();
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<MentionableCard[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const mentionMatch = text.match(MENTION_PATTERN);
  const query = mentionMatch?.[1]?.toLowerCase() ?? "";
  const filteredCards = mentionMatch
    ? availableCards.filter(
        (card) =>
          !mentions.some((m) => m.id === card.id) &&
          card.front.toLowerCase().includes(query)
      )
    : [];

  function selectMention(card: MentionableCard) {
    setText((current) => current.replace(MENTION_PATTERN, (match) => (match.startsWith(" ") ? " " : "")));
    setMentions((current) => [...current, card]);
    inputRef.current?.focus();
  }

  function removeMention(id: string) {
    setMentions((current) => current.filter((m) => m.id !== id));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    sendMessage(
      { text: trimmed },
      {
        body: {
          deckId: deckId ?? undefined,
          mentionedCardIds: mentions.map((m) => m.id),
        },
      }
    );
    setText("");
    setMentions([]);
  }

  return (
    <div className="border-t border-border">
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2">
          {mentions.map((card) => (
            <span
              key={card.id}
              className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {card.front.length > 24 ? `${card.front.slice(0, 24)}…` : card.front}
              <button type="button" onClick={() => removeMention(card.id)} aria-label="Remove reference">
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {mentionMatch && <MentionSuggestions cards={filteredCards} onSelect={selectMention} />}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask anything, or @ to reference a card…"
          disabled={status !== "ready"}
          className="h-8 flex-1 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground outline-none focus-visible:border-ring"
        />
        <button
          type="submit"
          disabled={status !== "ready" || !text.trim()}
          className="h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
