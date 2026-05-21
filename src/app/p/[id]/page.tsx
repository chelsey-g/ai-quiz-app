import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ForkButton } from "@/components/fork-button";

export default async function PublicDeckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deck } = await supabase
    .from("decks")
    .select("id, title, topic_tags, card_count, description, user_id, is_public")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (!deck) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, username")
    .eq("id", deck.user_id ?? "")
    .maybeSingle();

  const { data: cards } = await supabase
    .from("cards")
    .select("id, front, back")
    .eq("deck_id", id)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  const { data: sessions } = await supabase
    .from("sessions")
    .select("score, total, user_id")
    .eq("deck_id", id)
    .not("completed_at", "is", null)
    .gt("total", 0);

  let avgPct: number | null = null;
  let learnerCount = 0;
  if (sessions && sessions.length > 0) {
    learnerCount = new Set(sessions.map((s) => s.user_id)).size;
    const totalCorrect = sessions.reduce((sum, s) => sum + (s.score ?? 0), 0);
    const totalAnswers = sessions.reduce((sum, s) => sum + (s.total ?? 0), 0);
    avgPct = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === deck.user_id;

  const initial = (profile?.display_name ?? "?").charAt(0).toUpperCase();
  const allCards = cards ?? [];

  const scoreColor =
    avgPct === null
      ? "text-muted-foreground/50"
      : avgPct >= 80
      ? "text-[var(--dashboard-accent-teal-strong)]"
      : avgPct >= 60
      ? "text-[oklch(0.78_0.16_75)]"
      : "text-[oklch(0.72_0.18_27)]";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href={profile?.display_name ? `/u/${encodeURIComponent(profile.display_name)}` : "/community"}
        className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {profile?.display_name ?? "Back"}
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {deck.title}
          </h1>
          {!isOwner && <ForkButton deckId={deck.id} size="md" />}
        </div>

        {deck.description && (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground/70">
            {deck.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground/60">
            {deck.card_count} {deck.card_count === 1 ? "card" : "cards"}
          </p>
          {profile?.display_name && (
            <Link
              href={`/u/${encodeURIComponent(profile.display_name)}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground/50 transition-colors hover:text-foreground"
            >
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-primary/15">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt={profile.display_name ?? ""} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[8px] font-bold leading-none text-primary">{initial}</span>
                )}
              </span>
              {profile.display_name}
            </Link>
          )}
        </div>

        {deck.topic_tags && deck.topic_tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {deck.topic_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                style={{
                  border: "1px solid color-mix(in oklch, var(--dashboard-accent-coral) 38%, transparent)",
                  color: "color-mix(in oklch, var(--dashboard-accent-coral) 78%, var(--muted-foreground) 22%)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Community stats */}
      {(learnerCount > 0 || avgPct !== null) && (
        <div className="mb-6 flex items-center gap-6 rounded-xl border border-border/40 bg-card/50 px-5 py-4">
          {learnerCount > 0 && (
            <div>
              <p className="font-heading text-xl font-bold tabular-nums text-foreground">{learnerCount}</p>
              <p className="text-[11px] text-muted-foreground/55">{learnerCount === 1 ? "learner" : "learners"}</p>
            </div>
          )}
          {avgPct !== null && (
            <div>
              <p className={`font-heading text-xl font-bold tabular-nums ${scoreColor}`}>{avgPct}%</p>
              <p className="text-[11px] text-muted-foreground/55">avg accuracy</p>
            </div>
          )}
        </div>
      )}

      {/* Cards */}
      <div>
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Cards ({allCards.length})
        </p>
        {allCards.length === 0 ? (
          <p className="text-sm text-muted-foreground/50">No cards yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {allCards.map((card) => (
              <div
                key={card.id}
                className="rounded-xl border border-border/40 bg-card px-4 py-3"
              >
                <p className="text-sm font-medium text-foreground">{card.front}</p>
                <p className="mt-1 text-sm text-muted-foreground/70">{card.back}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
