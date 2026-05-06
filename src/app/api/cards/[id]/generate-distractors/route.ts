import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAndSaveDistractors } from "@/lib/services/distractors";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: cardId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: card } = await supabase
    .from("cards")
    .select("id, front, back, mc_status, decks(title, user_id)")
    .eq("id", cardId)
    .single();

  if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deck = Array.isArray(card.decks) ? card.decks[0] : card.decks;
  if (deck?.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (card.mc_status === "ready") return NextResponse.json({ status: "ready" });

  await generateAndSaveDistractors(cardId, card.front, card.back, deck?.title ?? null);

  return NextResponse.json({ status: "ok" });
}
