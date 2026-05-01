import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const supabase = await createClient();

  let query = supabase
    .from("decks")
    .select("id, title, topic_tags, card_count, created_at, user_id, profiles(display_name)")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (q) {
    query = query.or(`title.ilike.%${q}%,topic_tags.cs.{${q}}`);
  }

  const { data, error } = await query;

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const decks = (data ?? []).map((d) => {
    const { profiles, ...deck } = d as typeof d & { profiles: { display_name: string | null } | null };
    return { ...deck, publisher_name: profiles?.display_name ?? null };
  });

  return Response.json({ decks });
}
