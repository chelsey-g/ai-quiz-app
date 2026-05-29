import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getGlobalStats } from "@/lib/services/stats";
import { CollectionsSection } from "@/components/collections-section";
import { StatsCharts } from "@/components/stats-charts";
import type { StreakStatus } from "@/lib/streak";

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">{label}</p>
      <p className={`font-heading mt-1 text-2xl font-bold tabular-nums ${highlight ? "text-amber-400" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}

function StreakTile({ streakDays, streakStatus }: { streakDays: number; streakStatus: StreakStatus }) {
  const value = streakStatus === "none" || streakDays === 0 ? "—" : `${streakDays}`;
  const label = streakDays === 1 ? "day" : "days";
  const color =
    streakStatus === "active"
      ? "text-primary"
      : streakStatus === "at_risk"
      ? "text-amber-400"
      : "text-foreground";

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground/55">Streak</p>
      <div className="mt-1 flex items-baseline gap-1">
        <p className={`font-heading text-2xl font-bold tabular-nums ${color}`}>{value}</p>
        {streakDays > 0 && streakStatus !== "none" && (
          <span className={`font-heading text-sm font-medium ${color} opacity-70`}>{label}</span>
        )}
      </div>
      {streakStatus === "at_risk" && (
        <p className="mt-0.5 text-[10px] text-amber-400/80">at risk</p>
      )}
    </div>
  );
}

function formatStudyTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const displayName = (profileData as { display_name?: string | null } | null)?.display_name ?? null;

  const [stats, collectionsResult] = await Promise.all([
    getGlobalStats(user.id),
    supabase
      .from("collections")
      .select("id, name, is_public, collection_decks(deck_id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  const collections = (collectionsResult.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    is_public: c.is_public,
    deck_count: c.collection_decks.length,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">Profile</h1>
          {displayName ? (
            <Link
              href={`/u/${encodeURIComponent(displayName)}`}
              className="rounded-xl border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View public profile →
            </Link>
          ) : (
            <Link
              href="/settings"
              className="rounded-xl border border-border/50 px-4 py-2 text-sm font-medium text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              Set display name to get public profile
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Stats
        </p>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Tile label="Sessions" value={stats.totals.sessions.toString()} />
          <Tile label="Study time" value={formatStudyTime(stats.totals.studyTimeMinutes)} />
          <Tile
            label="Accuracy"
            value={stats.totals.accuracy !== null ? `${stats.totals.accuracy}%` : "—"}
          />
          <Tile label="Cards seen" value={stats.totals.cardsSeen.toString()} />
          <StreakTile streakDays={stats.totals.streakDays} streakStatus={stats.totals.streakStatus} />
        </div>
        <StatsCharts activityByWeek={stats.activityByWeek} accuracyByDay={stats.accuracyByDay} />
      </div>

      {/* Deck breakdown */}
      <div className="mb-8">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
          Deck breakdown
        </p>
        <div className="overflow-hidden rounded-2xl border border-border/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40 bg-muted/20">
                <th className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-muted-foreground/55 font-medium">
                  Deck
                </th>
                <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-muted-foreground/55 font-medium">
                  Sessions
                </th>
                <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-muted-foreground/55 font-medium">
                  Accuracy
                </th>
                <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-muted-foreground/55 font-medium">
                  Mastered
                </th>
                <th className="px-4 py-3 text-right text-[10px] uppercase tracking-widest text-muted-foreground/55 font-medium">
                  Last studied
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.deckStats.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground/40">
                    No decks yet — create one to start tracking stats.
                  </td>
                </tr>
              ) : (
                stats.deckStats.map((d) => (
                  <tr
                    key={d.deckId}
                    className="border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/decks/${d.deckId}`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {d.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {d.sessions}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {d.accuracy !== null ? `${d.accuracy}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {d.seen} / {d.total}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {d.lastStudied ? formatDate(d.lastStudied) : "Never"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CollectionsSection initialCollections={collections} />
    </div>
  );
}
