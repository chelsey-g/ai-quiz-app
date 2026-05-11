import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { collection_id } = body as { collection_id?: string };

  const admin = createAdminClient();

  const { data: attempt, error: attemptErr } = await admin
    .from("challenge_attempts")
    .select("id, challenge_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (attemptErr || !attempt) return Response.json({ error: "Not found" }, { status: 404 });

  const { data: challenge } = await admin
    .from("challenges")
    .select("title, deck_id, card_ids")
    .eq("id", attempt.challenge_id)
    .single();

  if (!challenge?.deck_id) return Response.json({ error: "No deck attached to challenge" }, { status: 400 });

  const { data: allCards } = await admin
    .from("cards")
    .select("*")
    .eq("deck_id", challenge.deck_id);

  const cards = (allCards ?? []).filter((c) =>
    challenge.card_ids?.length ? challenge.card_ids.includes(c.id) : true
  );

  const { data: newDeck, error: deckErr } = await admin
    .from("decks")
    .insert({
      title: challenge.title,
      user_id: user.id,
      topic_tags: [],
      card_count: cards.length,
      source_deck_id: challenge.deck_id,
    })
    .select()
    .single();

  if (deckErr || !newDeck) return Response.json({ error: "Failed to create deck" }, { status: 500 });

  if (cards.length > 0) {
    const cardInserts = cards.map((c) => ({
      deck_id: newDeck.id,
      front: c.front,
      back: c.back,
      card_type: c.card_type,
      tags: c.tags,
      sort_order: c.sort_order,
      mc_distractors: c.mc_distractors,
      mc_status: c.mc_status,
      times_seen: 0,
      times_correct: 0,
      ease_factor: 2.5,
      interval_days: 0,
      repetitions: 0,
      next_review_at: null,
      last_seen_at: null,
    }));
    await admin.from("cards").insert(cardInserts);
  }

  if (collection_id) {
    const { data: col } = await supabase
      .from("collections")
      .select("id")
      .eq("id", collection_id)
      .eq("user_id", user.id)
      .single();

    if (col) {
      await admin.from("collection_decks").insert({ collection_id, deck_id: newDeck.id });
    }
  }

  return Response.json({ deck: newDeck }, { status: 201 });
}
