"use client";

import { useRef, useState } from "react";
import { useChatWidget, type MentionableItem } from "@/components/chat-provider";

const MENTION_PATTERN = /(?:^|\s)@(\w*)$/;
const MAX_SUGGESTIONS = 8;

const TYPE_LABEL: Record<MentionableItem["type"], string> = {
  card: "Card",
  deck: "Deck",
  collection: "Collection",
};

function MentionSuggestions({
  items,
  onSelect,
}: {
  items: MentionableItem[];
  onSelect: (item: MentionableItem) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="border-t border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        No matches. Try a deck, collection, or card title.
      </div>
    );
  }

  return (
    <div className="max-h-40 overflow-y-auto border-t border-border bg-card">
      {items.map((item) => (
        <button
          key={`${item.type}-${item.id}`}
          type="button"
          onClick={() => onSelect(item)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
        >
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
            {TYPE_LABEL[item.type]}
          </span>
          <span className="truncate">{item.label}</span>
          {item.type === "card" && item.sourceDeckTitle && (
            <span className="ml-auto shrink-0 truncate text-xs text-muted-foreground">
              {item.sourceDeckTitle}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function MentionInput() {
  const { deckId, mentionableItems, sendMessage, status } = useChatWidget();
  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<MentionableItem[]>([]);
  const [deckCardCache, setDeckCardCache] = useState<Record<string, MentionableItem[]>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  async function ensureDeckCardsLoaded(referencedDeckId: string) {
    if (deckCardCache[referencedDeckId]) return;
    try {
      const res = await fetch(`/api/decks/${referencedDeckId}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        deck?: { title?: string };
        cards?: { id: string; front: string }[];
      };
      const cards: MentionableItem[] = (data.cards ?? []).map((c) => ({
        type: "card" as const,
        id: c.id,
        label: c.front,
        sourceDeckTitle: data.deck?.title,
      }));
      setDeckCardCache((prev) => ({ ...prev, [referencedDeckId]: cards }));
    } catch {
      // Cards from this deck just won't be searchable — not fatal.
    }
  }

  // Cards from any deck the user has @ mentioned in this message become
  // searchable too, so you can drill into a specific question inside it.
  const referencedDeckCards = mentions
    .filter((m): m is Extract<MentionableItem, { type: "deck" }> => m.type === "deck")
    .flatMap((m) => deckCardCache[m.id] ?? [])
    .filter((card) => !mentionableItems.some((mi) => mi.type === "card" && mi.id === card.id));

  // Cards are sorted ahead of decks/collections so that, once a deck's cards
  // are loaded, they aren't crowded out of the MAX_SUGGESTIONS cap by an
  // account with many decks/collections.
  const cardItems = mentionableItems.filter((item) => item.type === "card");
  const otherItems = mentionableItems.filter((item) => item.type !== "card");
  const searchableItems = [...cardItems, ...referencedDeckCards, ...otherItems];

  const mentionMatch = text.match(MENTION_PATTERN);
  const query = mentionMatch?.[1]?.toLowerCase() ?? "";
  const filteredItems = mentionMatch
    ? searchableItems
        .filter(
          (item) =>
            !mentions.some((m) => m.type === item.type && m.id === item.id) &&
            item.label.toLowerCase().includes(query)
        )
        .slice(0, MAX_SUGGESTIONS)
    : [];

  function selectMention(item: MentionableItem) {
    setText((current) => current.replace(MENTION_PATTERN, (match) => (match.startsWith(" ") ? " " : "")));
    setMentions((current) => [...current, item]);
    if (item.type === "deck") {
      ensureDeckCardsLoaded(item.id);
    }
    inputRef.current?.focus();
  }

  function removeMention(type: MentionableItem["type"], id: string) {
    setMentions((current) => current.filter((m) => !(m.type === type && m.id === id)));
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
          mentionedCardIds: mentions.filter((m) => m.type === "card").map((m) => m.id),
          mentionedDeckIds: mentions.filter((m) => m.type === "deck").map((m) => m.id),
          mentionedCollectionIds: mentions.filter((m) => m.type === "collection").map((m) => m.id),
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
          {mentions.map((item) => (
            <span
              key={`${item.type}-${item.id}`}
              className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              <span className="text-[0.6rem] uppercase opacity-70">{TYPE_LABEL[item.type]}</span>
              {item.label.length > 24 ? `${item.label.slice(0, 24)}…` : item.label}
              <button
                type="button"
                onClick={() => removeMention(item.type, item.id)}
                aria-label="Remove reference"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      {mentionMatch && <MentionSuggestions items={filteredItems} onSelect={selectMention} />}

      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask anything, or @ to reference a deck, collection, or card…"
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
