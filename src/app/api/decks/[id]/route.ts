import { createClient } from "@/lib/supabase/server";
import { getDeckById } from "@/lib/services/decks";
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
  const title = typeof body.title === "string" ? body.title.trim() : null;
  if (!title) return Response.json({ error: "title is required" }, { status: 400 });

  const { error, count } = await supabase
    .from("decks")
    .update({ title }, { count: "exact" })
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
