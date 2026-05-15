import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, username, created_at")
    .eq("username", username.toLowerCase())
    .single();

  if (error || !profile) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { data: decks } = await supabase
    .from("decks")
    .select("id, title, topic_tags, card_count, created_at")
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  const publicDecks = decks ?? [];
  const totalCards = publicDecks.reduce((sum, d) => sum + (d.card_count ?? 0), 0);

  return Response.json({
    profile,
    decks: publicDecks,
    deckCount: publicDecks.length,
    totalCards,
  });
}
