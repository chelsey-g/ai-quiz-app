"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useCallback } from "react";
import { NotificationPanel } from "@/components/notification-panel";
import type { User } from "@supabase/supabase-js";

type SearchResult = {
  cardId: string;
  front: string;
  deckId: string;
  deckTitle: string;
};

function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 250);
    return () => clearTimeout(t);
  }, [query, search]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(result: SearchResult) {
    setQuery("");
    setResults([]);
    setOpen(false);
    router.push(`/decks/${result.deckId}`);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <div className="relative">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search questions…"
          className="w-full rounded-lg border border-border/40 bg-muted/30 py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-border/70 focus:bg-muted/50 transition-colors"
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin rounded-full border border-muted-foreground/30 border-t-muted-foreground/70" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border/50 bg-card shadow-lg overflow-hidden">
          <div className="max-h-72 overflow-y-auto divide-y divide-border/30">
            {results.map((r) => (
              <button
                key={r.cardId}
                onClick={() => handleSelect(r)}
                className="w-full px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
              >
                <p className="text-xs text-foreground line-clamp-2 leading-snug">{r.front}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{r.deckTitle}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border/50 bg-card shadow-lg px-3 py-3">
          <p className="text-xs text-muted-foreground/50 text-center">No questions found</p>
        </div>
      )}
    </div>
  );
}

function GearIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function TopBar({ user }: { user: User }) {
  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/40 bg-background/80 px-3 backdrop-blur-sm md:px-4">
      <SearchBar />
      <div className="flex shrink-0 items-center gap-0.5">
        <NotificationPanel userId={user.id} />
        <Link
          href="/settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-muted/40 hover:text-foreground"
          aria-label="Settings"
        >
          <GearIcon />
        </Link>
      </div>
    </header>
  );
}
