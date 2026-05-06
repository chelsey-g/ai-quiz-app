"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Database } from "@/lib/database.types";

type Deck = Database["public"]["Tables"]["decks"]["Row"];

export type DeckWithStats = Deck & {
  total_seen: number;
  total_correct: number;
  unattempted_count: number;
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function accuracyPct(seen: number, correct: number): number | null {
  if (seen === 0) return null;
  return Math.round((correct / seen) * 100);
}

export function DeckCard({
  deck,
  accuracyPercent,
  selected = false,
  onSelect,
  selectMode = false,
  topAction,
}: {
  deck: DeckWithStats;
  accuracyPercent?: number;
  selected?: boolean;
  onSelect?: () => void;
  selectMode?: boolean;
  topAction?: React.ReactNode;
}) {
  const router = useRouter();
  // Use the explicitly-passed accuracyPercent if provided, otherwise derive from deck stats
  const pct = accuracyPercent !== undefined ? accuracyPercent : accuracyPct(deck.total_seen, deck.total_correct);
  const hasActivity = pct !== null;

  const cardInner = (
    <div
      className="relative h-full overflow-hidden rounded-2xl border bg-card transition-all duration-200"
      style={
        selected
          ? {
              borderColor:
                "color-mix(in oklch, var(--dashboard-accent-teal) 70%, transparent)",
              boxShadow:
                "0 0 0 1px color-mix(in oklch, var(--dashboard-accent-teal) 32%, transparent)",
            }
          : selectMode
          ? { borderColor: "oklch(0.225 0.011 65 / 0.5)" }
          : undefined
      }
    >
      {/* Checkbox overlay — visible only in select mode */}
      {selectMode && (
        <div className="absolute left-3 top-3 z-10">
          <div
            className="flex h-5 w-5 items-center justify-center rounded border transition-all duration-200"
            style={
              selected
                ? {
                    background: "var(--dashboard-accent-teal)",
                    borderColor: "var(--dashboard-accent-teal)",
                  }
                : {
                    background: "transparent",
                    borderColor:
                      "color-mix(in oklch, var(--dashboard-accent-teal) 55%, transparent)",
                  }
            }
          >
            {selected && (
              <svg
                className="h-3 w-3"
                viewBox="0 0 12 12"
                fill="none"
                stroke="var(--dashboard-accent-ink)"
                style={{ stroke: "var(--dashboard-accent-ink)" }}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 6l3 3 5-5" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Top accent gradient line — brighter when active */}
      <div
        className={`absolute inset-x-0 top-0 h-px transition-all duration-300 bg-gradient-to-r from-transparent to-transparent ${
          selected
            ? "via-[var(--dashboard-accent-teal)] opacity-100"
            : hasActivity
            ? "via-[var(--dashboard-accent-teal)] opacity-80 group-hover:opacity-100"
            : "via-border opacity-70 group-hover:via-[var(--dashboard-accent-coral)] group-hover:opacity-90"
        }`}
      />

      <div className={`p-5 ${selectMode ? "pl-10" : ""}`}>
        {/* Title — most prominent element */}
        <h3 className="font-heading text-base font-bold leading-snug text-foreground line-clamp-2">
          {deck.title}
        </h3>

        {/* Tags — secondary */}
        {deck.topic_tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {deck.topic_tags.slice(0, 3).map((tag) => (
              <Link
                key={tag}
                href={`/tags/${encodeURIComponent(tag)}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-full border px-2 py-0.5 text-[10px] transition-colors hover:brightness-110"
                style={{
                  borderColor:
                    "color-mix(in oklch, var(--dashboard-accent-coral) 35%, var(--border) 65%)",
                  background:
                    "color-mix(in oklch, var(--dashboard-accent-coral) 10%, var(--muted) 90%)",
                  color:
                    "color-mix(in oklch, var(--dashboard-accent-coral) 55%, var(--muted-foreground) 45%)",
                }}
              >
                {tag}
              </Link>
            ))}
            {deck.topic_tags.length > 3 && (
              <span className="self-center text-[10px] text-muted-foreground/40">
                +{deck.topic_tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Stats — tertiary */}
        <div className="mt-4 space-y-3">
          {hasActivity && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                  Accuracy
                </span>
                <span className="font-heading text-xs font-semibold tabular-nums text-foreground/80">
                  {pct}%
                </span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs text-muted-foreground/55">
              {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
              {deck.unattempted_count > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    background:
                      "color-mix(in oklch, var(--dashboard-accent-amber) 18%, transparent)",
                    color:
                      "color-mix(in oklch, var(--dashboard-accent-amber) 70%, var(--foreground) 30%)",
                  }}
                >
                  {deck.unattempted_count} new
                </span>
              )}
            </span>
            <span className="text-[10px] text-muted-foreground/40">
              {hasActivity ? formatDate(deck.created_at) : "Not started"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  if (selectMode) {
    return (
      <div
        className="block group h-full cursor-pointer select-none"
        onClick={onSelect}
        role="checkbox"
        aria-checked={selected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onSelect?.();
          }
        }}
      >
        {cardInner}
      </div>
    );
  }

  return (
    <div className="relative h-full group">
      <div className="block h-full cursor-pointer" onClick={() => router.push(`/decks/${deck.id}`)}>
        <div className="dashboard-card-hover relative h-full overflow-hidden rounded-2xl border border-border/50 bg-card">
        {/* Top accent gradient line — brighter when active */}
        <div
          className={`absolute inset-x-0 top-0 h-px transition-all duration-300 bg-gradient-to-r from-transparent to-transparent ${
            hasActivity
              ? "via-[var(--dashboard-accent-teal)] opacity-80 group-hover:opacity-100"
              : "via-border opacity-70 group-hover:via-[var(--dashboard-accent-coral)] group-hover:opacity-90"
          }`}
        />

        <div className="p-5">
          {/* Title — most prominent element */}
          <h3 className={`font-heading text-base font-bold leading-snug text-foreground line-clamp-2 ${topAction ? "pr-7" : ""}`}>
            {deck.title}
          </h3>

          {/* Tags — secondary */}
          {deck.topic_tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {deck.topic_tags.slice(0, 3).map((tag) => (
                <Link
                  key={tag}
                  href={`/tags/${encodeURIComponent(tag)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-full border px-2 py-0.5 text-[10px] transition-colors hover:brightness-110"
                  style={{
                    borderColor:
                      "color-mix(in oklch, var(--dashboard-accent-coral) 35%, var(--border) 65%)",
                    background:
                      "color-mix(in oklch, var(--dashboard-accent-coral) 10%, var(--muted) 90%)",
                    color:
                      "color-mix(in oklch, var(--dashboard-accent-coral) 55%, var(--muted-foreground) 45%)",
                  }}
                >
                  {tag}
                </Link>
              ))}
              {deck.topic_tags.length > 3 && (
                <span className="self-center text-[10px] text-muted-foreground/40">
                  +{deck.topic_tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Stats — tertiary */}
          <div className="mt-4 space-y-3">
            {hasActivity && (
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                    Accuracy
                  </span>
                  <span className="font-heading text-xs font-semibold tabular-nums text-foreground/80">
                    {pct}%
                  </span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs text-muted-foreground/55">
                {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
                {deck.unattempted_count > 0 && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      background:
                        "color-mix(in oklch, var(--dashboard-accent-amber) 18%, transparent)",
                      color:
                        "color-mix(in oklch, var(--dashboard-accent-amber) 70%, var(--foreground) 30%)",
                    }}
                  >
                    {deck.unattempted_count} new
                  </span>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground/40">
                {hasActivity ? formatDate(deck.created_at) : "Not started"}
              </span>
            </div>
          </div>
        </div>
      </div>
      </div>
      {topAction && (
        <div className="absolute top-2 right-2 z-10">
          {topAction}
        </div>
      )}
    </div>
  );
}
