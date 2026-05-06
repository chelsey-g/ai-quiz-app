import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateDistractors } from "@/lib/ai/generate-distractors";

const MAX_ITEMS = 12;
const MAX_FIELD_LEN = 6000;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const deckTitle =
    typeof body.deckTitle === "string" && body.deckTitle.trim()
      ? body.deckTitle.trim().slice(0, 220)
      : undefined;

  const rawItems = body.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0)
    return NextResponse.json({ error: "items array is required" }, { status: 400 });
  if (rawItems.length > MAX_ITEMS)
    return NextResponse.json({ error: `items must have at most ${MAX_ITEMS} cards` }, { status: 400 });

  const items = [];
  for (const row of rawItems) {
    const cardId = typeof row.cardId === "string" ? row.cardId.trim() : "";
    const front = typeof row.front === "string" ? row.front.trim() : "";
    const back = typeof row.back === "string" ? row.back.trim() : "";
    if (!cardId || !front || !back) continue;
    if (front.length > MAX_FIELD_LEN || back.length > MAX_FIELD_LEN)
      return NextResponse.json({ error: "front/back exceeds max length" }, { status: 400 });
    items.push({ cardId, front, back });
  }

  if (items.length === 0)
    return NextResponse.json({ error: "no valid items" }, { status: 400 });

  const idSet = new Set(items.map((i) => i.cardId));
  if (idSet.size !== items.length)
    return NextResponse.json({ error: "duplicate cardId in batch" }, { status: 400 });

  const byCardId = await generateDistractors(items, deckTitle);
  return NextResponse.json({ byCardId });
}
