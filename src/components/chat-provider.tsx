"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { matchDeckRoute } from "@/lib/utils/deck-route";

export type MentionableCard = { id: string; front: string };

function useChatController() {
  const pathname = usePathname();
  const deckId = useMemo(() => matchDeckRoute(pathname), [pathname]);

  const [open, setOpen] = useState(false);
  const [deckTitle, setDeckTitle] = useState<string | null>(null);
  const [availableCards, setAvailableCards] = useState<MentionableCard[]>([]);

  useEffect(() => {
    if (!deckId) {
      setDeckTitle(null);
      setAvailableCards([]);
      return;
    }

    let cancelled = false;

    fetch(`/api/decks/${deckId}`)
      .then((r) => r.json())
      .then((data: { deck?: { title?: string }; cards?: { id: string; front: string }[] }) => {
        if (cancelled) return;
        setDeckTitle(data.deck?.title ?? null);
        setAvailableCards((data.cards ?? []).map((c) => ({ id: c.id, front: c.front })));
      })
      .catch(() => {
        if (cancelled) return;
        setDeckTitle(null);
        setAvailableCards([]);
      });

    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const chat = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  return { open, setOpen, deckId, deckTitle, availableCards, ...chat };
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
