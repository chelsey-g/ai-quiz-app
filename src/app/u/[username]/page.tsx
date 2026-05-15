import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChallengeButton } from "@/components/challenge-button";
import { ForkButton } from "@/components/fork-button";

function formatJoinDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, username, created_at")
    .eq("username", username.toLowerCase())
    .single();

  if (!profile) notFound();

  const { data: decks } = await supabase
    .from("decks")
    .select("id, title, topic_tags, card_count, created_at")
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const publicDecks = decks ?? [];
  const totalCards = publicDecks.reduce((sum, d) => sum + (d.card_count ?? 0), 0);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwnProfile = user?.id === profile.id;

  const initial = (profile.display_name ?? profile.username ?? "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {/* Profile header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-primary/15 text-lg font-bold text-primary">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.display_name ?? username}
                className="h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-foreground">
              {profile.display_name ?? `@${profile.username}`}
            </h1>
            <p className="text-sm text-muted-foreground/60">@{profile.username}</p>
            <p className="mt-0.5 text-xs text-muted-foreground/40">
              Joined {formatJoinDate(profile.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOwnProfile && (
            <Link
              href="/settings"
              className="rounded-xl border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Edit profile
            </Link>
          )}
          {!isOwnProfile && user && (
            <ChallengeButton
              targetUserId={profile.id}
              targetDisplayName={profile.display_name}
              targetAvatarUrl={profile.avatar_url}
            />
          )}
          {!user && (
            <Link
              href="/auth/login"
              className="rounded-xl border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in to challenge
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 flex gap-8">
        <div>
          <p className="font-heading text-2xl font-bold tabular-nums text-foreground">
            {publicDecks.length}
          </p>
          <p className="text-xs text-muted-foreground/55">public decks</p>
        </div>
        <div>
          <p className="font-heading text-2xl font-bold tabular-nums text-foreground">
            {totalCards}
          </p>
          <p className="text-xs text-muted-foreground/55">total cards</p>
        </div>
      </div>

      {/* Decks section */}
      <div>
        <p className="mb-4 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Public decks
        </p>

        {publicDecks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-16 text-center">
            <p className="text-sm text-muted-foreground/60">No public decks yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicDecks.map((deck) => (
              <div
                key={deck.id}
                className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
                <div className="mb-3 flex items-start justify-between gap-2">
                  <h3 className="font-heading text-sm font-semibold leading-snug text-foreground line-clamp-2">
                    {deck.title}
                  </h3>
                  {!isOwnProfile && <ForkButton deckId={deck.id} />}
                </div>
                {deck.topic_tags && deck.topic_tags.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {(deck.topic_tags as string[]).slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border/40 px-2 py-0.5 text-[10px] text-muted-foreground/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground/50">{deck.card_count} cards</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
