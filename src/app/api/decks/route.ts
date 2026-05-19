import { createClient } from "@/lib/supabase/server";
import { getDecks } from "@/lib/services/decks";
import { NextRequest } from "next/server";
import { classifyCodeDeck } from "@/app/api/decks/[id]/classify-code/route";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : null;
  if (!title) return Response.json({ error: "title is required" }, { status: 400 });

  const { data: deck, error } = await supabase
    .from("decks")
    .insert({ title, user_id: user.id, topic_tags: [], card_count: 0 })
    .select()
    .single();

  if (error || !deck) return Response.json({ error: error?.message ?? "Insert failed" }, { status: 500 });

  // Fire-and-forget — classify in background, doesn't block response
  classifyCodeDeck(deck.id).catch(() => {});

  return Response.json(deck, { status: 201 });
}

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decksWithStats = await getDecks(user.id);
    return Response.json(decksWithStats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
