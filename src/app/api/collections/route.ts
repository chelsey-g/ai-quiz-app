import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const deckId = req.nextUrl.searchParams.get("deck_id");

  const { data, error } = await supabase
    .from("collections")
    .select("id, name, is_public, created_at, collection_decks(deck_id)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const collections = (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    is_public: c.is_public,
    created_at: c.created_at,
    deck_count: c.collection_decks.length,
    contains_deck: deckId
      ? c.collection_decks.some((cd) => cd.deck_id === deckId)
      : undefined,
  }));

  return Response.json({ collections });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return Response.json({ error: "Name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("collections")
    .insert({ user_id: user.id, name })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json(data, { status: 201 });
}
