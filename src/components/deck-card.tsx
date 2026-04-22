import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Database } from "@/lib/database.types";

type Deck = Database["public"]["Tables"]["decks"]["Row"];

export type DeckWithStats = Deck & {
  total_seen: number;
  total_correct: number;
  unattempted_count: number;
};

interface DeckCardProps {
  deck: DeckWithStats;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAccuracy(totalSeen: number, totalCorrect: number): string {
  if (totalSeen === 0) return "Not started";
  const pct = Math.round((totalCorrect / totalSeen) * 100);
  return `${pct}% accuracy`;
}

export function DeckCard({ deck }: DeckCardProps) {
  const hasActivity = deck.total_seen > 0;

  return (
    <Link href={`/decks/${deck.id}`} className="block group">
      <Card className="h-full transition-colors hover:border-border/80 hover:bg-card/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium leading-snug text-foreground group-hover:text-foreground/90">
            {deck.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {deck.topic_tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {deck.topic_tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs font-normal"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
            </span>
            <span>{formatDate(deck.created_at)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span
              className={
                hasActivity ? "text-foreground/70" : "text-muted-foreground"
              }
            >
              {formatAccuracy(deck.total_seen, deck.total_correct)}
            </span>
            {deck.unattempted_count > 0 && (
              <span className="text-muted-foreground">
                {deck.unattempted_count} new
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
