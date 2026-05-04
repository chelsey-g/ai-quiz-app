import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const safeQ = raw.slice(0, 100).replace(/[^a-zA-Z0-9 \-_]/g, "");
  const supabase = await createClient();

  let query = supabase
    .from("decks")
    .select("id, title, topic_tags, card_count, created_at, user_id")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (safeQ) {
    query = query.or(`title.ilike.%${safeQ}%,topic_tags.cs.{${safeQ}}`);
  }

  const { data: decksData, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set((decksData ?? []).map((d) => d.user_id).filter(Boolean))] as string[];

  const profileMap = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, p.display_name);
    }
  }

  // Check which decks the current user has already forked (optional auth)
  const { data: { user } } = await supabase.auth.getUser();
  const forkedSet = new Set<string>();
  if (user && decksData && decksData.length > 0) {
    const publicIds = decksData.map((d) => d.id);
    const { data: forks } = await supabase
      .from("decks")
      .select("source_deck_id")
      .eq("user_id", user.id)
      .in("source_deck_id", publicIds);
    for (const f of forks ?? []) {
      if (f.source_deck_id) forkedSet.add(f.source_deck_id);
    }
  }

  const decks = (decksData ?? []).map((d) => ({
    ...d,
    publisher_name: d.user_id ? (profileMap.get(d.user_id) ?? null) : null,
    already_forked: forkedSet.has(d.id),
  }));

  return Response.json({ decks });
}
