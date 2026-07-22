"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { matchDeckRoute } from "@/lib/utils/deck-route";

export type MentionableItem =
  | { type: "card"; id: string; label: string }
  | { type: "deck"; id: string; label: string }
  | { type: "collection"; id: string; label: string };

function useChatController() {
  const pathname = usePathname();
  const deckId = useMemo(() => matchDeckRoute(pathname), [pathname]);

  const [open, setOpen] = useState(false);
  const [deckTitle, setDeckTitle] = useState<string | null>(null);
  const [deckCards, setDeckCards] = useState<MentionableItem[]>([]);
  const [decks, setDecks] = useState<MentionableItem[]>([]);
  const [collections, setCollections] = useState<MentionableItem[]>([]);

  // Current deck's cards — scoped to whichever single-deck route is active.
  useEffect(() => {
    if (!deckId) {
      setDeckTitle(null);
      setDeckCards([]);
      return;
    }

    let cancelled = false;

    fetch(`/api/decks/${deckId}`)
      .then((r) => r.json())
      .then((data: { deck?: { title?: string }; cards?: { id: string; front: string }[] }) => {
        if (cancelled) return;
        setDeckTitle(data.deck?.title ?? null);
        setDeckCards(
          (data.cards ?? []).map((c) => ({ type: "card" as const, id: c.id, label: c.front }))
        );
      })
      .catch(() => {
        if (cancelled) return;
        setDeckTitle(null);
        setDeckCards([]);
      });

    return () => {
      cancelled = true;
    };
  }, [deckId]);

  // All of the user's decks and collections — fetched once, so @ can reference
  // any of them regardless of which page the chat is opened from.
  useEffect(() => {
    let cancelled = false;

    fetch("/api/decks")
      .then((r) => r.json())
      .then((data: { id: string; title: string }[]) => {
        if (cancelled) return;
        setDecks((data ?? []).map((d) => ({ type: "deck" as const, id: d.id, label: d.title })));
      })
      .catch(() => {
        if (!cancelled) setDecks([]);
      });

    fetch("/api/collections")
      .then((r) => r.json())
      .then((data: { collections?: { id: string; name: string }[] }) => {
        if (cancelled) return;
        setCollections(
          (data.collections ?? []).map((c) => ({ type: "collection" as const, id: c.id, label: c.name }))
        );
      })
      .catch(() => {
        if (!cancelled) setCollections([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const mentionableItems = useMemo(
    () => [...deckCards, ...decks, ...collections],
    [deckCards, decks, collections]
  );

  const chat = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  return { open, setOpen, deckId, deckTitle, mentionableItems, ...chat };
}

type ChatContextValue = ReturnType<typeof useChatController>;

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const value = useChatController();
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatWidget() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatWidget must be used within ChatProvider");
  }
  return ctx;
}
