import Link from "next/link";
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
  dueCount = 0,
  accuracyPercent,
}: {
  deck: DeckWithStats;
  dueCount?: number;
  accuracyPercent?: number;
}) {
  // Use the explicitly-passed accuracyPercent if provided, otherwise derive from deck stats
  const pct = accuracyPercent !== undefined ? accuracyPercent : accuracyPct(deck.total_seen, deck.total_correct);
  const hasActivity = pct !== null;

  return (
    <Link href={`/decks/${deck.id}`} className="block group">
      <div className="relative h-full overflow-hidden rounded-2xl border border-border/50 bg-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_16px_48px_-16px_oklch(0.77_0.195_68_/_0.22)]">
        {/* Top accent gradient line — brighter when active */}
        <div
          className={`absolute inset-x-0 top-0 h-px transition-all duration-300 bg-gradient-to-r from-transparent to-transparent ${
            hasActivity
              ? "via-primary/65 group-hover:via-primary/90"
              : "via-border group-hover:via-primary/40"
          }`}
        />

        <div className="p-5">
          {/* Title — most prominent element */}
          <h3 className="font-heading text-base font-bold leading-snug text-foreground line-clamp-2">
            {deck.title}
          </h3>

          {/* Tags — secondary */}
          {deck.topic_tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {deck.topic_tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border/50 bg-muted/30 px-2 py-0.5 text-[10px] text-muted-foreground/65"
                >
                  {tag}
                </span>
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
                  <span className="rounded-full bg-primary/14 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {deck.unattempted_count} new
                  </span>
                )}
                {dueCount > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
                    {dueCount} due
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
    </Link>
  );
}
