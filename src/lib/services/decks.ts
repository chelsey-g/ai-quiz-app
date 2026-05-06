import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { DeckWithStats } from "@/components/deck-card";
import { getDeckStats } from "@/lib/services/stats";
import type { DeckStatsResult } from "@/lib/services/stats";

type Card = Database["public"]["Tables"]["cards"]["Row"];
type Deck = Database["public"]["Tables"]["decks"]["Row"];

/**
 * Returns all decks for the given user, with computed stats (total_seen,
 * total_correct, unattempted_count). Mirrors the aggregation in GET /api/decks.
 */
export async function getDecks(userId: string): Promise<DeckWithStats[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("decks")
    .select("*, cards(times_seen, times_correct)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((deck) => {
    const cards = (deck.cards ?? []) as Pick<Card, "times_seen" | "times_correct">[];
    const totalSeen = cards.reduce((s, c) => s + c.times_seen, 0);
    const totalCorrect = cards.reduce((s, c) => s + c.times_correct, 0);
    const unattemptedCount = cards.filter((c) => c.times_seen === 0).length;
    const { cards: _, ...deckBase } = deck;
    return {
      ...deckBase,
      total_seen: totalSeen,
      total_correct: totalCorrect,
      unattempted_count: unattemptedCount,
    } as DeckWithStats;
  });
}

/**
 * Returns a single deck and its cards. Scoped to the given user via user_id
 * check on the deck row. Throws if the deck is not found or belongs to another user.
 */
export async function getDeckById(
  deckId: string,
  userId: string
): Promise<{ deck: Deck; cards: Card[]; deckStats: DeckStatsResult }> {
  const supabase = await createClient();

  const [{ data: deck, error: deckError }, { data: cards, error: cardsError }, deckStats] =
    await Promise.all([
      supabase
        .from("decks")
        .select("*")
        .eq("id", deckId)
        .eq("user_id", userId)
        .single(),
      supabase
        .from("cards")
        .select("*")
        .eq("deck_id", deckId)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true }),
      getDeckStats(deckId, userId),
    ]);

  if (deckError) {
    const notFound = deckError.code === "PGRST116";
    const err = new Error(deckError.message) as Error & { status?: number };
    err.status = notFound ? 404 : 500;
    throw err;
  }

  if (cardsError) {
    throw new Error(cardsError.message);
  }

  return { deck: deck as Deck, cards: (cards ?? []) as Card[], deckStats };
}

export async function getDecksByCollection(
  collectionId: string,
  userId: string
): Promise<DeckWithStats[]> {
  const supabase = await createClient();

  const { data: membership, error: membershipError } = await supabase
    .from("collection_decks")
    .select("deck_id")
    .eq("collection_id", collectionId);

  if (membershipError) throw new Error(membershipError.message);

  const deckIds = (membership ?? []).map((m) => m.deck_id);
  if (deckIds.length === 0) return [];

  const { data, error } = await supabase
    .from("decks")
    .select("*, cards(times_seen, times_correct)")
    .eq("user_id", userId)
    .in("id", deckIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((deck) => {
    const cards = (deck.cards ?? []) as Pick<Card, "times_seen" | "times_correct">[];
    const totalSeen = cards.reduce((s, c) => s + c.times_seen, 0);
    const totalCorrect = cards.reduce((s, c) => s + c.times_correct, 0);
    const unattemptedCount = cards.filter((c) => c.times_seen === 0).length;
    const { cards: _, ...deckBase } = deck;
    return {
      ...deckBase,
      total_seen: totalSeen,
      total_correct: totalCorrect,
      unattempted_count: unattemptedCount,
    } as DeckWithStats;
  });
}
