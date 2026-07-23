import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ results: [] });

  const { data, error } = await supabase
    .from("cards")
    .select("id, front, back, deck_id, decks!inner(id, title, user_id)")
    .eq("decks.user_id", user.id)
    .ilike("front", `%${q}%`)
    .limit(20);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results = (data ?? []).map((c) => ({
    cardId: c.id,
    front: c.front,
    back: c.back,
    deckId: c.deck_id,
    deckTitle: Array.isArray(c.decks) ? c.decks[0]?.title : (c.decks as { title: string } | null)?.title ?? "",
  }));

  return Response.json({ results });
}
