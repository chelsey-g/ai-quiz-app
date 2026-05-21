import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ForkButton } from "@/components/fork-button";
import { ForkCollectionButton } from "@/components/fork-collection-button";

export default async function PublicCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("collections")
    .select("id, name, description, is_public, user_id, created_at")
    .eq("id", id)
    .eq("is_public", true)
    .single();

  if (!collection) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, username")
    .eq("id", collection.user_id)
    .maybeSingle();

  const { data: collectionDecks } = await supabase
    .from("collection_decks")
    .select("deck_id")
    .eq("collection_id", id);

  const deckIds = (collectionDecks ?? []).map((r) => r.deck_id);

  let decks: {
    id: string;
    title: string;
    topic_tags: string[];
    card_count: number;
    description: string | null;
    avgPct: number | null;
    learnerCount: number;
  }[] = [];

  if (deckIds.length > 0) {
    const { data: rawDecks } = await supabase
      .from("decks")
      .select("id, title, topic_tags, card_count, description")
      .in("id", deckIds)
      .eq("is_public", true);

    if (rawDecks && rawDecks.length > 0) {
      const { data: sessions } = await supabase
        .from("sessions")
        .select("deck_id, score, total, user_id")
        .in("deck_id", rawDecks.map((d) => d.id))
        .not("completed_at", "is", null)
        .gt("total", 0);

      decks = rawDecks.map((deck) => {
        const ds = (sessions ?? []).filter((s) => s.deck_id === deck.id);
        const uniqueUsers = new Set(ds.map((s) => s.user_id)).size;
        const correct = ds.reduce((sum, s) => sum + (s.score ?? 0), 0);
        const total = ds.reduce((sum, s) => sum + (s.total ?? 0), 0);
        return {
          ...deck,
          avgPct: total > 0 ? Math.round((correct / total) * 100) : null,
          learnerCount: uniqueUsers,
        };
      });
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === collection.user_id;

  const initial = (profile?.display_name ?? "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href={profile?.display_name ? `/u/${encodeURIComponent(profile.display_name)}` : "/community"}
        className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        {profile?.display_name ?? "Back"}
      </Link>

      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {collection.name}
        </h1>
        {collection.description && (
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground/70">
            {collection.description}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!isOwner && <ForkCollectionButton collectionId={collection.id} deckCount={decks.length} />}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <p className="text-sm text-muted-foreground/60">
            {decks.length} {decks.length === 1 ? "deck" : "decks"}
          </p>
          {profile?.display_name && (
            <Link
              href={`/u/${encodeURIComponent(profile.display_name)}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground/50 transition-colors hover:text-foreground"
            >
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-primary/15">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt={profile.display_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[8px] font-bold leading-none text-primary">{initial}</span>
                )}
              </span>
              {profile.display_name}
            </Link>
          )}
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-16 text-center">
          <p className="text-sm text-muted-foreground/60">No public decks in this collection</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <Link
              key={deck.id}
              href={`/p/${deck.id}`}
              className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 transition-colors hover:border-primary/30 hover:bg-card/80"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-heading text-sm font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-primary/90 transition-colors">
                  {deck.title}
                </h3>
                {!isOwner && <ForkButton deckId={deck.id} />}
              </div>
              {deck.description && (
                <p className="mb-2 text-xs leading-relaxed text-muted-foreground/60 line-clamp-2">
                  {deck.description}
                </p>
              )}
              {deck.topic_tags && deck.topic_tags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1">
                  {deck.topic_tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground/60"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground/50">
                <span>{deck.card_count} cards</span>
                {deck.learnerCount > 0 && (
                  <span>{deck.learnerCount} {deck.learnerCount === 1 ? "learner" : "learners"}</span>
                )}
                {deck.avgPct !== null && (
                  <span
                    className="font-medium"
                    style={{
                      color: deck.avgPct >= 80
                        ? "var(--dashboard-accent-teal-strong)"
                        : deck.avgPct >= 60
                        ? "oklch(0.78 0.16 75)"
                        : "oklch(0.72 0.18 27)",
                    }}
                  >
                    {deck.avgPct}% avg
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
