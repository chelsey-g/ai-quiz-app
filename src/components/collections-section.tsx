"use client";

import { useState } from "react";

type CollectionRow = {
  id: string;
  name: string;
  is_public: boolean;
  deck_count: number;
};

export function CollectionsSection({
  initialCollections,
}: {
  initialCollections: CollectionRow[];
}) {
  const [collections, setCollections] = useState(initialCollections);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  async function handleTogglePublic(col: CollectionRow) {
    if (toggling.has(col.id)) return;
    setToggling((prev) => new Set(prev).add(col.id));

    const next = !col.is_public;
    setCollections((prev) =>
      prev.map((c) => (c.id === col.id ? { ...c, is_public: next } : c))
    );

    const res = await fetch(`/api/collections/${col.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: next }),
    });

    if (!res.ok) {
      setCollections((prev) =>
        prev.map((c) => (c.id === col.id ? { ...c, is_public: col.is_public } : c))
      );
    }

    setToggling((prev) => {
      const s = new Set(prev);
      s.delete(col.id);
      return s;
    });
  }

  return (
    <div>
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
        Collections
      </p>

      {collections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/40 px-4 py-5 text-center">
          <p className="text-sm text-muted-foreground/60">
            No collections yet. Create one from the dashboard, then toggle it public to show it here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {collections.map((col) => (
            <div
              key={col.id}
              className="flex items-center justify-between rounded-xl border border-border/40 bg-card/60 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-heading text-sm font-semibold text-foreground truncate">
                  {col.name}
                </p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                  {col.deck_count} {col.deck_count === 1 ? "deck" : "decks"}
                </p>
              </div>

              <button
                onClick={() => handleTogglePublic(col)}
                disabled={toggling.has(col.id)}
                className="ml-4 flex flex-none items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-50"
                style={
                  col.is_public
                    ? {
                        borderColor: "oklch(0.76 0.160 62 / 0.4)",
                        color: "oklch(0.76 0.160 62 / 0.9)",
                        background: "oklch(0.76 0.160 62 / 0.08)",
                      }
                    : {
                        borderColor: "oklch(0.225 0.011 65 / 0.4)",
                        color: "oklch(0.63 0.022 68)",
                        background: "transparent",
                      }
                }
              >
                {col.is_public ? (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Public
                  </>
                ) : (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                    Private
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
