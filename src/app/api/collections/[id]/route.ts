import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import { getDecksByCollection } from "@/lib/services/decks";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: collection, error: colError } = await supabase
    .from("collections")
    .select("id, name, is_public, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (colError || !collection)
    return Response.json({ error: "Not found" }, { status: 404 });

  try {
    const decks = await getDecksByCollection(id, user.id);
    return Response.json({ collection, decks });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const updates: { name?: string; is_public?: boolean } = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return Response.json({ error: "Name cannot be blank" }, { status: 400 });
    updates.name = name;
  }
  if (typeof body.is_public === "boolean") {
    updates.is_public = body.is_public;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("collections")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });

  return Response.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return new Response(null, { status: 204 });
}
