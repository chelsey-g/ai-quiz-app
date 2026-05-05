"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type CollectionMeta = {
  id: string;
  name: string;
  is_public: boolean;
  deck_count: number;
  contains_deck: boolean;
};

export function CollectionPopover({ deckId }: { deckId: string }) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<CollectionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/collections?deck_id=${deckId}`);
    if (res.ok) {
      const data = await res.json();
      setCollections(data.collections);
    }
    setLoading(false);
  }, [deckId]);

  useEffect(() => {
    if (open) fetchCollections();
  }, [open, fetchCollections]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  async function handleToggle(col: CollectionMeta) {
    if (toggling.has(col.id)) return;
    setToggling((prev) => new Set(prev).add(col.id));

    setCollections((prev) =>
      prev.map((c) =>
        c.id === col.id ? { ...c, contains_deck: !c.contains_deck } : c
      )
    );

    const method = col.contains_deck ? "DELETE" : "POST";
    await fetch(`/api/collections/${col.id}/decks`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck_id: deckId }),
    });

    setToggling((prev) => {
      const next = new Set(prev);
      next.delete(col.id);
      return next;
    });
  }

  async function handleCreate(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);

    const createRes = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (createRes.ok) {
      const col = await createRes.json();
      await fetch(`/api/collections/${col.id}/decks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deck_id: deckId }),
      });

      setCollections((prev) => [
        ...prev,
        {
          id: col.id,
          name: col.name,
          is_public: col.is_public,
          deck_count: 1,
          contains_deck: true,
        },
      ]);
      setNewName("");
    }

    setCreating(false);
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label="Add to collection"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 bg-card/80 text-muted-foreground/50 transition-all hover:border-primary/30 hover:text-primary/70"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 mt-2 z-50 w-56 rounded-xl border border-border bg-card shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55 mb-2">
              Collections
            </p>

            {loading ? (
              <div className="space-y-1.5 pb-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-6 rounded bg-muted/40 animate-pulse" />
                ))}
              </div>
            ) : collections.length === 0 ? (
              <p className="pb-2 text-xs text-muted-foreground/50">No collections yet</p>
            ) : (
              <ul className="space-y-0.5 pb-1 max-h-48 overflow-y-auto">
                {collections.map((col) => (
                  <li key={col.id}>
                    <button
                      onClick={() => handleToggle(col)}
                      disabled={toggling.has(col.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted/40 disabled:opacity-50"
                    >
                      <span
                        className="flex h-4 w-4 flex-none items-center justify-center rounded border transition-all"
                        style={
                          col.contains_deck
                            ? {
                                background: "var(--dashboard-accent-teal)",
                                borderColor: "var(--dashboard-accent-teal)",
                              }
                            : {
                                background: "transparent",
                                borderColor:
                                  "color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)",
                              }
                        }
                      >
                        {col.contains_deck && (
                          <svg
                            className="h-2.5 w-2.5"
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="var(--dashboard-accent-ink)"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M2 6l3 3 5-5" />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 truncate text-foreground/80">{col.name}</span>
                      <span className="text-[10px] text-muted-foreground/40 tabular-nums">
                        {col.deck_count}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border/50 px-3 py-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleCreate}
              disabled={creating}
              placeholder="New collection…"
              className="w-full rounded-lg bg-muted/30 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
