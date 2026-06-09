import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

type Card = Database["public"]["Tables"]["cards"]["Row"];

const WEAK_CARD_LIMIT = 20;

/**
 * GET /api/cards/weak
 * Returns up to WEAK_CARD_LIMIT of the authenticated user's weakest cards
 * across all decks. Weak = lowest times_correct/times_seen ratio (seen cards
 * first, sorted ascending), then unseen cards appended.
 *
 * Query params:
 *   limit — override card count (default 20, max 50)
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawLimit = parseInt(url.searchParams.get("limit") ?? String(WEAK_CARD_LIMIT), 10);
  const limit = Math.min(Math.max(1, rawLimit), 500);
  const deckParam = url.searchParams.get("decks");
  const deckIds = deckParam ? deckParam.split(",").filter(Boolean) : null;
  const flaggedOnly = url.searchParams.get("flagged") === "true";

  // Fetch all user's cards in one query (join through decks to scope by user_id)
  let query = supabase
    .from("cards")
    .select("*, decks!inner(user_id)")
    .eq("decks.user_id", user.id);

  if (deckIds && deckIds.length > 0) {
    query = query.in("deck_id", deckIds);
  }

  if (flaggedOnly) {
    query = query.eq("flagged", true);
  }

  const { data: cards, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const allCards = (cards ?? []) as Card[];

  if (flaggedOnly) {
    return Response.json({ cards: allCards.slice(0, limit), total: allCards.length });
  }

  // Split seen vs unseen
  const seen = allCards.filter((c) => c.times_seen > 0);
  const unseen = allCards.filter((c) => c.times_seen === 0);

  // Sort seen cards by accuracy ratio ascending (weakest first)
  seen.sort((a, b) => {
    const ratioA = a.times_correct / a.times_seen;
    const ratioB = b.times_correct / b.times_seen;
    return ratioA - ratioB;
  });

  const weak = [...seen, ...unseen].slice(0, limit);

  return Response.json({ cards: weak, total: allCards.length });
}
