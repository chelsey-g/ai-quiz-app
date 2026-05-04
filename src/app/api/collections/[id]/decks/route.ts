import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collection_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const deck_id = typeof body.deck_id === "string" ? body.deck_id.trim() : "";
  if (!deck_id) return Response.json({ error: "deck_id is required" }, { status: 400 });

  const { data: col } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collection_id)
    .eq("user_id", user.id)
    .single();
  if (!col) return Response.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("collection_decks")
    .upsert({ collection_id, deck_id }, { onConflict: "collection_id,deck_id" });

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return new Response(null, { status: 204 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collection_id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const deck_id = typeof body.deck_id === "string" ? body.deck_id.trim() : "";
  if (!deck_id) return Response.json({ error: "deck_id is required" }, { status: 400 });

  const { data: col } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collection_id)
    .eq("user_id", user.id)
    .single();
  if (!col) return Response.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("collection_decks")
    .delete()
    .eq("collection_id", collection_id)
    .eq("deck_id", deck_id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return new Response(null, { status: 204 });
}
