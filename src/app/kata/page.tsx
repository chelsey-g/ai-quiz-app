import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function KataPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: codeDecks } = await supabase
    .from("decks")
    .select("id, title, topic_tags, card_count")
    .eq("user_id", user.id)
    .eq("is_code_deck", true)
    .order("created_at", { ascending: false });

  const { data: recentAttempts } = await supabase
    .from("kata_attempts")
    .select("id, deck_id, problem_title, difficulty, passed_count, total_count, created_at, decks(title)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const decks = codeDecks ?? [];
  const attempts = recentAttempts ?? [];

  return (
    <div className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="font-heading text-2xl font-bold text-foreground">Kata Practice</h1>
        <p className="mt-1 text-sm text-muted-foreground/60">
          AI-generated JavaScript challenges from your decks. Pick a deck to start.
        </p>
      </div>

      {/* Code decks grid */}
      {decks.length === 0 ? (
        <div
          className="rounded-2xl border p-10 text-center"
          style={{ borderColor: "oklch(1 0 0 / 0.07)", background: "oklch(1 0 0 / 0.02)" }}
        >
          <p className="text-sm text-muted-foreground/60">No coding decks yet.</p>
          <p className="mt-1 text-xs text-muted-foreground/40">
            Create a JavaScript or programming deck and it will appear here automatically.
          </p>
          <Link
            href="/create"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              background: "oklch(0.62 0.19 295 / 0.1)",
              borderColor: "oklch(0.62 0.19 295 / 0.25)",
              color: "#a78bfa",
            }}
          >
            Create a deck
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="group relative rounded-2xl border p-5 transition-all duration-200 hover:border-[oklch(0.62_0.19_142_/_0.35)]"
              style={{
                borderColor: "oklch(1 0 0 / 0.08)",
                background: "oklch(1 0 0 / 0.02)",
              }}
            >
              {/* Top accent */}
              <div
                className="absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-[oklch(0.62_0.19_142_/_0.3)] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />

              <h3 className="font-heading text-sm font-semibold leading-snug text-foreground line-clamp-2">
                {deck.title}
              </h3>

              {deck.topic_tags && deck.topic_tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {deck.topic_tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full px-2 py-0.5 text-[10px]"
                      style={{
                        background: "oklch(0.62 0.19 142 / 0.08)",
                        color: "oklch(0.62 0.19 142 / 0.8)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground/40">
                  {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
                </span>
                <Link
                  href={`/kata/${deck.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all hover:opacity-90"
                  style={{
                    background: "oklch(0.62 0.19 142 / 0.12)",
                    borderColor: "oklch(0.62 0.19 142 / 0.3)",
                    color: "#4ade80",
                  }}
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                  </svg>
                  Practice
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent attempts */}
      {attempts.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 font-heading text-sm font-semibold uppercase tracking-widest text-muted-foreground/50">
            Recent Attempts
          </h2>
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: "oklch(1 0 0 / 0.08)" }}
          >
            {attempts.map((attempt, i) => {
              const allPassed = attempt.passed_count === attempt.total_count;
              const pct = attempt.total_count > 0
                ? Math.round((attempt.passed_count / attempt.total_count) * 100)
                : 0;
              const deckTitle = (attempt.decks as { title: string } | null)?.title ?? "Unknown deck";

              return (
                <div
                  key={attempt.id}
                  className="flex items-center gap-4 px-5 py-3.5 text-sm"
                  style={{
                    borderTop: i > 0 ? "1px solid oklch(1 0 0 / 0.06)" : undefined,
                  }}
                >
                  {/* Pass/fail indicator */}
                  <span
                    className="shrink-0 text-base"
                    style={{ color: allPassed ? "#4ade80" : "#f87171" }}
                  >
                    {allPassed ? "✓" : "✗"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground/90">
                      {attempt.problem_title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground/50">{deckTitle}</p>
                  </div>

                  {/* Difficulty */}
                  <span
                    className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background:
                        attempt.difficulty === "easy"
                          ? "oklch(0.62 0.19 142 / 0.08)"
                          : attempt.difficulty === "hard"
                          ? "oklch(0.62 0.22 25 / 0.08)"
                          : "oklch(0.75 0.17 60 / 0.08)",
                      borderColor:
                        attempt.difficulty === "easy"
                          ? "oklch(0.62 0.19 142 / 0.2)"
                          : attempt.difficulty === "hard"
                          ? "oklch(0.62 0.22 25 / 0.2)"
                          : "oklch(0.75 0.17 60 / 0.2)",
                      color:
                        attempt.difficulty === "easy"
                          ? "#4ade80"
                          : attempt.difficulty === "hard"
                          ? "#f87171"
                          : "#fbbf24",
                    }}
                  >
                    {attempt.difficulty}
                  </span>

                  {/* Score */}
                  <span
                    className="shrink-0 text-[12px] font-medium tabular-nums"
                    style={{ color: allPassed ? "#4ade80" : "oklch(0.7 0 0)" }}
                  >
                    {pct}%
                  </span>

                  {/* Date + retry link */}
                  <span className="shrink-0 text-[11px] text-muted-foreground/40">
                    {formatDate(attempt.created_at)}
                  </span>

                  <Link
                    href={`/kata/${attempt.deck_id}`}
                    className="shrink-0 text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    retry →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
