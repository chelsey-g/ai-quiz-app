import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const collectionId = typeof body.collectionId === "string" ? body.collectionId : null;
  if (!collectionId) return Response.json({ error: "collectionId is required" }, { status: 400 });

  // Verify source collection is public
  const { data: source } = await supabase
    .from("collections")
    .select("id, name, description")
    .eq("id", collectionId)
    .eq("is_public", true)
    .single();

  if (!source) return Response.json({ error: "Collection not found" }, { status: 404 });

  // Get public decks in this collection
  const { data: collectionDecks } = await supabase
    .from("collection_decks")
    .select("deck_id")
    .eq("collection_id", collectionId);

  const deckIds = (collectionDecks ?? []).map((r) => r.deck_id);

  const { data: sourceDecks } = deckIds.length > 0
    ? await supabase
        .from("decks")
        .select("id, title, topic_tags, card_count, description")
        .in("id", deckIds)
        .eq("is_public", true)
    : { data: [] };

  const publicDecks = sourceDecks ?? [];

  // Create the new collection
  const { data: newCollection, error: colErr } = await supabase
    .from("collections")
    .insert({ user_id: user.id, name: source.name, description: source.description, is_public: false })
    .select("id")
    .single();

  if (colErr || !newCollection) {
    return Response.json({ error: colErr?.message ?? "Failed to create collection" }, { status: 500 });
  }

  // Fork each deck and add to the new collection
  for (const deck of publicDecks) {
    // Skip if already forked
    const { data: existing } = await supabase
      .from("decks")
      .select("id")
      .eq("user_id", user.id)
      .eq("source_deck_id", deck.id)
      .maybeSingle();

    let forkedDeckId: string;

    if (existing) {
      forkedDeckId = existing.id;
    } else {
      const { data: newDeck, error: deckErr } = await supabase
        .from("decks")
        .insert({
          title: deck.title,
          topic_tags: deck.topic_tags,
          card_count: deck.card_count,
          description: deck.description,
          user_id: user.id,
          is_public: false,
          source_deck_id: deck.id,
        })
        .select("id")
        .single();

      if (deckErr || !newDeck) continue;
      forkedDeckId = newDeck.id;

      // Copy cards
      const { data: sourceCards } = await supabase
        .from("cards")
        .select("front, back, card_type, tags")
        .eq("deck_id", deck.id);

      if (sourceCards && sourceCards.length > 0) {
        await supabase.from("cards").insert(
          sourceCards.map((c) => ({
            deck_id: forkedDeckId,
            front: c.front,
            back: c.back,
            card_type: c.card_type,
            tags: c.tags ?? [],
          }))
        );
      }
    }

    await supabase
      .from("collection_decks")
      .insert({ collection_id: newCollection.id, deck_id: forkedDeckId })
      .select();
  }

  return Response.json({ collectionId: newCollection.id }, { status: 201 });
}
