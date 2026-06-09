import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { flagged } = await req.json();

  // Verify the card belongs to this user (via deck)
  const { data: card } = await supabase
    .from("cards")
    .select("id, decks!inner(user_id)")
    .eq("id", id)
    .eq("decks.user_id", user.id)
    .single();

  if (!card) return Response.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("cards")
    .update({ flagged })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ flagged });
}
