import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getGlobalStats } from "@/lib/services/stats";
import { ProfileEditor } from "@/components/profile-editor";
import { CollectionsSection } from "@/components/collections-section";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">{label}</p>
      <p className="font-heading mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const [profileResult, stats, collectionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single(),
    getGlobalStats(user.id),
    supabase
      .from("collections")
      .select("id, name, is_public, collection_decks(deck_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  const profile = profileResult.data;
  const collections = (collectionsResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    is_public: c.is_public,
    deck_count: c.collection_decks.length,
  }));

  const streakValue =
    stats.totals.streakStatus === "none" || stats.totals.streakDays === 0
      ? "—"
      : `${stats.totals.streakDays}d`;

  const streakColor =
    stats.totals.streakStatus === "active"
      ? "text-primary"
      : stats.totals.streakStatus === "at_risk"
      ? "text-amber-400"
      : "text-foreground";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Profile</h1>
      </div>

      <div className="mb-8">
        <ProfileEditor
          userId={user.id}
          userEmail={user.email ?? ""}
          initialDisplayName={profile?.display_name ?? null}
          initialAvatarUrl={profile?.avatar_url ?? null}
        />
      </div>

      <div>
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Stats
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Streak</p>
            <p className={`font-heading mt-1 text-2xl font-bold tabular-nums ${streakColor}`}>
              {streakValue}
            </p>
          </div>
          <Tile label="Sessions" value={stats.totals.sessions.toString()} />
          <Tile
            label="Accuracy"
            value={stats.totals.accuracy !== null ? `${stats.totals.accuracy}%` : "—"}
          />
        </div>
      </div>

      <div className="mt-8">
        <CollectionsSection initialCollections={collections} />
      </div>
    </div>
  );
}
