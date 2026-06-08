"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type CollectionMeta = {
  id: string;
  name: string;
  is_public: boolean;
  created_at: string;
  deck_count: number;
};

function FolderIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v8.25" />
    </svg>
  );
}

export default function CollectionsPage() {
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionMeta[]>([]);
  const [totalDecks, setTotalDecks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [quizzing, setQuizzing] = useState(false);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleCreateQuiz() {
    if (selectedIds.size === 0 || quizzing) return;
    setQuizzing(true);
    const results = await Promise.all(
      Array.from(selectedIds).map((id) =>
        fetch(`/api/collections/${id}`).then((r) => r.ok ? r.json() : null)
      )
    );
    const deckIds = [...new Set(
      results.flatMap((r) => (r?.decks ?? []).map((d: { id: string }) => d.id))
    )];
    setQuizzing(false);
    if (deckIds.length === 0) return;
    router.push(`/quiz/quick?decks=${deckIds.join(",")}&limit=200`);
  }

  useEffect(() => {
    async function load() {
      const [colRes, deckRes] = await Promise.all([
        fetch("/api/collections"),
        fetch("/api/decks"),
      ]);
      if (colRes.ok) {
        const { collections } = await colRes.json();
        setCollections(collections);
      }
      if (deckRes.ok) {
        const decks = await deckRes.json();
        setTotalDecks(decks.length);
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!menuOpenId) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpenId]);

  async function handleCreate(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const col = await res.json();
      setCollections((prev) => [
        ...prev,
        { id: col.id, name: col.name, is_public: col.is_public, created_at: col.created_at, deck_count: 0 },
      ]);
      setNewName("");
    }
    setCreating(false);
  }

  async function handleRename(id: string) {
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;
    await fetch(`/api/collections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/collections/${id}`, { method: "DELETE" });
    setCollections((prev) => prev.filter((c) => c.id !== id));
    setDeletingId(null);
    setMenuOpenId(null);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 animate-fade-up">
      {/* Floating quiz bar */}
      {selectMode && selectedIds.size > 0 && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[420px]">
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-card/95 px-5 py-3.5 shadow-xl backdrop-blur-md select-none">
            <p className="flex-1 text-sm font-medium text-muted-foreground">
              <span className="font-heading font-semibold text-foreground">{selectedIds.size}</span>{" "}
              {selectedIds.size === 1 ? "collection" : "collections"} selected
            </p>
            <button
              onClick={handleCreateQuiz}
              disabled={quizzing}
              className="rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50"
              style={{
                border: "1px solid color-mix(in oklch, var(--dashboard-accent-teal) 65%, transparent)",
                color: "var(--dashboard-accent-teal-strong)",
              }}
            >
              {quizzing ? "Loading…" : "Create Quiz"}
            </button>
          </div>
        </div>
      )}

      <div className="mb-8 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
            Collections
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground/70">
            Organize your decks into groups
          </p>
        </div>
        {!loading && collections.length > 0 && (
          selectMode ? (
            <button
              onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
              className="rounded-lg border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted/40"
              style={{
                borderColor: "color-mix(in oklch, var(--border) 80%, transparent)",
                color: "color-mix(in oklch, var(--foreground) 62%, var(--muted-foreground) 38%)",
              }}
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={() => setSelectMode(true)}
              className="rounded-lg border px-3 py-1 text-xs font-medium transition-colors hover:bg-primary/10"
              style={{
                borderColor: "color-mix(in oklch, var(--dashboard-accent-coral) 45%, transparent)",
                color: "var(--dashboard-accent-coral)",
              }}
            >
              Select
            </button>
          )
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border border-border/40 bg-card/60 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* All Decks — always pinned first */}
          <Link href="/collections/all" className="group block h-full">
            <div className="dashboard-card-hover h-full rounded-2xl border border-border/50 bg-card p-5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl border"
                style={{
                  borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 40%, transparent)",
                  background: "color-mix(in oklch, var(--dashboard-accent-teal) 12%, transparent)",
                }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} style={{ color: "var(--dashboard-accent-teal-strong)" }} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
              </div>
              <h3 className="font-heading mt-3 text-base font-bold text-foreground">All Decks</h3>
              <p className="mt-1 text-sm text-muted-foreground/60">
                {totalDecks} {totalDecks === 1 ? "deck" : "decks"}
              </p>
            </div>
          </Link>

          {/* User collections */}
          {collections.map((col) => (
            <div key={col.id} className="group relative h-full">
              {selectMode && renamingId !== col.id && deletingId !== col.id ? (
                <button
                  onClick={() => toggleSelect(col.id)}
                  className="w-full h-full text-left"
                >
                  <div
                    className="dashboard-card-hover h-full rounded-2xl border bg-card p-5 transition-colors"
                    style={{
                      borderColor: selectedIds.has(col.id)
                        ? "var(--dashboard-accent-teal)"
                        : undefined,
                      background: selectedIds.has(col.id)
                        ? "color-mix(in oklch, var(--dashboard-accent-teal) 8%, var(--card) 92%)"
                        : undefined,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-xl border"
                        style={{
                          borderColor: "color-mix(in oklch, var(--dashboard-accent-coral) 40%, transparent)",
                          background: "color-mix(in oklch, var(--dashboard-accent-coral) 10%, transparent)",
                        }}
                      >
                        <FolderIcon className="h-4 w-4" style={{ color: "var(--dashboard-accent-coral)" }} />
                      </div>
                      <span
                        className="flex h-5 w-5 flex-none items-center justify-center rounded border transition-all"
                        style={
                          selectedIds.has(col.id)
                            ? { background: "var(--dashboard-accent-teal)", borderColor: "var(--dashboard-accent-teal)" }
                            : { background: "transparent", borderColor: "color-mix(in oklch, var(--dashboard-accent-teal) 45%, transparent)" }
                        }
                      >
                        {selectedIds.has(col.id) && (
                          <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="var(--dashboard-accent-ink)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M2 6l3 3 5-5" />
                          </svg>
                        )}
                      </span>
                    </div>
                    <h3 className="font-heading mt-3 text-base font-bold text-foreground">{col.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground/60">
                      {col.deck_count} {col.deck_count === 1 ? "deck" : "decks"}
                    </p>
                  </div>
                </button>
              ) : renamingId === col.id ? (
                <div className="h-full rounded-2xl border border-primary/40 bg-card p-5">
                  <div
                    className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border"
                    style={{
                      borderColor: "color-mix(in oklch, var(--dashboard-accent-coral) 40%, transparent)",
                      background: "color-mix(in oklch, var(--dashboard-accent-coral) 10%, transparent)",
                    }}
                  >
                    <FolderIcon className="h-4 w-4" style={{ color: "var(--dashboard-accent-coral)" }} />
                  </div>
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(col.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename(col.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    className="w-full bg-transparent font-heading text-base font-bold text-foreground focus:outline-none"
                  />
                  <p className="mt-1 text-sm text-muted-foreground/60">
                    {col.deck_count} {col.deck_count === 1 ? "deck" : "decks"}
                  </p>
                </div>
              ) : deletingId === col.id ? (
                <div className="h-full rounded-2xl border border-destructive/30 bg-card p-5">
                  <p className="text-sm font-medium text-foreground">{col.name}</p>
                  <p className="mt-2 text-xs text-muted-foreground/70">
                    Delete this collection? Decks won&apos;t be deleted.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleDelete(col.id)}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium transition-colors"
                      style={{
                        background: "oklch(0.55 0.2 27 / 0.12)",
                        border: "1px solid oklch(0.55 0.2 27 / 0.4)",
                        color: "oklch(0.75 0.18 27)",
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setDeletingId(null)}
                      className="rounded-lg border px-2.5 py-1 text-xs font-medium text-muted-foreground/70 transition-colors hover:text-foreground"
                      style={{ border: "1px solid oklch(0.5 0.01 65 / 0.3)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Link href={`/collections/${col.id}`} className="block h-full">
                    <div className="dashboard-card-hover h-full rounded-2xl border border-border/50 bg-card p-5">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-xl border"
                        style={{
                          borderColor: "color-mix(in oklch, var(--dashboard-accent-coral) 40%, transparent)",
                          background: "color-mix(in oklch, var(--dashboard-accent-coral) 10%, transparent)",
                        }}
                      >
                        <FolderIcon className="h-4 w-4" style={{ color: "var(--dashboard-accent-coral)" }} />
                      </div>
                      <h3 className="font-heading mt-3 text-base font-bold text-foreground pr-6">
                        {col.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground/60">
                        {col.deck_count} {col.deck_count === 1 ? "deck" : "decks"}
                      </p>
                    </div>
                  </Link>

                  {/* ··· menu */}
                  <div
                    className="absolute right-3 top-3 z-10"
                    ref={menuOpenId === col.id ? menuRef : null}
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMenuOpenId(menuOpenId === col.id ? null : col.id);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-muted/40 hover:text-foreground"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                      </svg>
                    </button>
                    {menuOpenId === col.id && (
                      <div className="absolute right-0 top-full mt-1 w-36 overflow-hidden rounded-xl border border-border bg-card shadow-xl z-50">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(col.id);
                            setRenameValue(col.name);
                            setMenuOpenId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted/40"
                        >
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(col.id);
                            setMenuOpenId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted/40"
                          style={{ color: "var(--destructive)" }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          {/* New collection input card */}
          <div className="rounded-2xl border border-dashed border-border/50 bg-card/40 p-5">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/50">
              New collection
            </p>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleCreate}
              disabled={creating}
              placeholder="Name and press Enter…"
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
