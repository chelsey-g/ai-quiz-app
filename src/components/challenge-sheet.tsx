"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/database.types";

type Card = Database["public"]["Tables"]["cards"]["Row"];

type UserResult = { id: string; display_name: string | null; avatar_url: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  deckId: string;
  deckTitle: string;
  cards: Card[];
};

type Step = "cards" | "recipients" | "confirm";

export function ChallengeSheet({ open, onClose, deckId, deckTitle, cards }: Props) {
  const [step, setStep] = useState<Step>("cards");
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set(cards.map((c) => c.id)));
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipients, setRecipients] = useState<UserResult[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("cards");
      setSelectedCardIds(new Set(cards.map((c) => c.id)));
      setQuery("");
      setSearchResults([]);
      setRecipients([]);
      setSent(false);
    }
  }, [open, cards]);

  const searchUsers = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.users ?? []);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchUsers(query), 300);
    return () => clearTimeout(t);
  }, [query, searchUsers]);

  function toggleCard(id: string) {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function toggleRecipient(user: UserResult) {
    setRecipients((prev) =>
      prev.some((r) => r.id === user.id)
        ? prev.filter((r) => r.id !== user.id)
        : [...prev, user]
    );
  }

  async function send() {
    setSending(true);
    try {
      const allSelected = selectedCardIds.size === cards.length;
      await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: deckTitle,
          deck_id: deckId,
          card_ids: allSelected ? null : Array.from(selectedCardIds),
          recipient_ids: recipients.map((r) => r.id),
        }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 shrink-0">
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              {sent ? "Challenge sent!" : step === "cards" ? "Pick cards" : step === "recipients" ? "Pick recipients" : "Send challenge"}
            </h2>
            {!sent && (
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {step === "cards" && `${selectedCardIds.size} of ${cards.length} cards selected`}
                {step === "recipients" && `${recipients.length} recipient${recipients.length !== 1 ? "s" : ""} selected`}
                {step === "confirm" && `${selectedCardIds.size} cards · ${recipients.length} recipient${recipients.length !== 1 ? "s" : ""}`}
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {sent ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">
                Your challenge has been sent to {recipients.map((r) => r.display_name ?? "someone").join(", ")}.
              </p>
            </div>
          ) : step === "cards" ? (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 mb-2">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setSelectedCardIds(new Set(cards.map((c) => c.id)))}>
                  Select all
                </Button>
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setSelectedCardIds(new Set())}>
                  Clear
                </Button>
              </div>
              {cards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => toggleCard(card.id)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    selectedCardIds.has(card.id)
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/40 opacity-50"
                  }`}
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${selectedCardIds.has(card.id) ? "bg-primary border-primary" : "border-border"}`}>
                    {selectedCardIds.has(card.id) && (
                      <svg className="h-2.5 w-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-foreground line-clamp-1">{card.front}</span>
                </button>
              ))}
            </div>
          ) : step === "recipients" ? (
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Search by display name…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                autoFocus
              />
              {recipients.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {recipients.map((r) => (
                    <span key={r.id} className="flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs text-primary">
                      {r.display_name}
                      <button onClick={() => toggleRecipient(r)} className="hover:text-primary/60">×</button>
                    </span>
                  ))}
                </div>
              )}
              {searching && <p className="text-xs text-muted-foreground/60 text-center py-2">Searching…</p>}
              {!searching && searchResults.length > 0 && (
                <div className="flex flex-col gap-1">
                  {searchResults.map((u) => {
                    const selected = recipients.some((r) => r.id === u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleRecipient(u)}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors ${selected ? "border-primary/40 bg-primary/5" : "border-border/40 hover:border-primary/30 hover:bg-muted/40"}`}
                      >
                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {(u.display_name ?? "?")[0].toUpperCase()}
                        </div>
                        <span className="text-sm text-foreground">{u.display_name}</span>
                        {selected && <span className="ml-auto text-xs text-primary">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {!searching && query.length >= 2 && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground/60 text-center py-2">No users found</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 space-y-1">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">Deck</p>
                <p className="text-sm text-foreground font-medium">{deckTitle}</p>
                <p className="text-xs text-muted-foreground/70">{selectedCardIds.size} card{selectedCardIds.size !== 1 ? "s" : ""}</p>
              </div>
              <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 space-y-2">
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/60">Sending to</p>
                {recipients.map((r) => (
                  <p key={r.id} className="text-sm text-foreground">{r.display_name}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div className="px-6 py-4 border-t border-border/50 flex gap-2 shrink-0">
            {step !== "cards" && (
              <Button variant="outline" className="flex-1" onClick={() => setStep(step === "confirm" ? "recipients" : "cards")}>
                Back
              </Button>
            )}
            {step === "cards" && (
              <Button className="flex-1" disabled={selectedCardIds.size === 0} onClick={() => setStep("recipients")}>
                Next: Pick recipients
              </Button>
            )}
            {step === "recipients" && (
              <Button className="flex-1" disabled={recipients.length === 0} onClick={() => setStep("confirm")}>
                Next: Review
              </Button>
            )}
            {step === "confirm" && (
              <Button className="flex-1" disabled={sending} onClick={send}>
                {sending ? "Sending…" : "Send challenge"}
              </Button>
            )}
          </div>
        )}
        {sent && (
          <div className="px-6 py-4 border-t border-border/50 shrink-0">
            <Button className="w-full" onClick={onClose}>Done</Button>
          </div>
        )}
      </div>
    </div>
  );
}
