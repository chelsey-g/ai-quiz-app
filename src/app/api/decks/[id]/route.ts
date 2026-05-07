import { createClient } from "@/lib/supabase/server";
import { getDeckById } from "@/lib/services/decks";
import { generateAndSaveDistractorsForDeck } from "@/lib/services/distractors";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { deck, cards, deckStats } = await getDeckById(id, user.id);
    if (cards.some((c: { mc_status: string | null }) => c.mc_status === "pending" || c.mc_status === "failed")) {
      generateAndSaveDistractorsForDeck(id, deck.title).catch(() => {});
    }
    return Response.json({ deck, cards, deckStats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = (err as Error & { status?: number }).status ?? 500;
    return Response.json({ error: message }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: { title?: string; is_public?: boolean } = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return Response.json({ error: "title cannot be empty" }, { status: 400 });
    updates.title = title;
  }

  if (typeof body.is_public === "boolean") {
    updates.is_public = body.is_public;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error, count } = await supabase
    .from("decks")
    .update(updates, { count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!count || count === 0) return Response.json({ error: "Deck not found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership before deleting
  const { data: deck, error: fetchError } = await supabase
    .from("decks")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !deck) {
    return Response.json({ error: "Deck not found" }, { status: 404 });
  }

  const { error } = await supabase.from("decks").delete().eq("id", id).eq("user_id", user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
