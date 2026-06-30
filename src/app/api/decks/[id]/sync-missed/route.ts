import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: deckId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const cardIds: string[] = Array.isArray(body.cardIds) ? body.cardIds : [];
  if (cardIds.length === 0) return Response.json({ ok: true, synced: 0 });

  // Find collections this deck belongs to that the user owns
  const { data: cdRows } = await supabase
    .from("collection_decks")
    .select("collection_id")
    .eq("deck_id", deckId);

  const collectionIds = (cdRows ?? []).map((r) => r.collection_id);
  if (collectionIds.length === 0) return Response.json({ ok: true, synced: 0 });

  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, missed_deck_id")
    .in("id", collectionIds)
    .eq("user_id", user.id);

  if (!collections || collections.length === 0) return Response.json({ ok: true, synced: 0 });

  // Fetch the source cards
  const { data: sourceCards } = await supabase
    .from("cards")
    .select("id, front, back, tags")
    .in("id", cardIds);

  if (!sourceCards || sourceCards.length === 0) return Response.json({ ok: true, synced: 0 });

  let totalSynced = 0;

  for (const collection of collections) {
    let missedDeckId: string = collection.missed_deck_id ?? "";

    // Create the missed deck if it doesn't exist yet
    if (!missedDeckId) {
      const { data: newDeck, error: deckErr } = await supabase
        .from("decks")
        .insert({ title: "Missed & Flagged", user_id: user.id, card_count: 0 })
        .select("id")
        .single();

      if (deckErr || !newDeck) continue;
      missedDeckId = newDeck.id;

      await supabase.from("collection_decks").insert({
        collection_id: collection.id,
        deck_id: missedDeckId,
      });

      await supabase
        .from("collections")
        .update({ missed_deck_id: missedDeckId })
        .eq("id", collection.id);
    }

    // Deduplicate by front text against existing cards in the missed deck
    const { data: existing } = await supabase
      .from("cards")
      .select("front")
      .eq("deck_id", missedDeckId);

    const existingFronts = new Set(
      (existing ?? []).map((c) => c.front.trim().toLowerCase())
    );

    const toInsert = sourceCards
      .filter((c) => !existingFronts.has(c.front.trim().toLowerCase()))
      .map((c) => ({
        deck_id: missedDeckId,
        front: c.front,
        back: c.back,
        tags: c.tags ?? [],
      }));

    if (toInsert.length === 0) continue;

    const { data: inserted, error: insertErr } = await supabase
      .from("cards")
      .insert(toInsert)
      .select("id");

    if (insertErr || !inserted) continue;

    totalSynced += inserted.length;

    // Keep card_count accurate
    const { count } = await supabase
      .from("cards")
      .select("id", { count: "exact", head: true })
      .eq("deck_id", missedDeckId);

    await supabase
      .from("decks")
      .update({ card_count: count ?? inserted.length })
      .eq("id", missedDeckId);
  }

  return Response.json({ ok: true, synced: totalSynced });
}
