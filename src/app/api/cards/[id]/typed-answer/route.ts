import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const answer = typeof body.answer === "string" ? body.answer : null;
  const correct = typeof body.correct === "boolean" ? body.correct : null;
  if (!answer) return Response.json({ error: "answer is required" }, { status: 400 });

  // Verify ownership via deck join
  const { data: card } = await supabase
    .from("cards")
    .select("id, decks!inner(user_id)")
    .eq("id", id)
    .single();

  if (!card) return Response.json({ error: "Not found" }, { status: 404 });
  const owner = (card.decks as unknown as { user_id: string }).user_id;
  if (owner !== user.id) return Response.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("cards")
    .update({ last_typed_answer: answer, ...(correct !== null && { last_answer_correct: correct }) })
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
