import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { generateCards } from "@/lib/ai/generate-cards";
import type { Database } from "@/lib/database.types";
import { randomUUID } from "crypto";
import { generateAndSaveDistractorsForDeck } from "@/lib/services/distractors";

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const topic: string = typeof body.topic === "string" ? body.topic.trim() : "";

  if (!topic) {
    return Response.json({ error: "topic is required" }, { status: 400 });
  }

  if (topic.length > 200) {
    return Response.json({ error: "topic must be 200 characters or fewer" }, { status: 400 });
  }

  const db = serviceClient();

  try {
    const { deck, provider, model } = await generateCards(topic, "", "topic");

    const sourcePath = `topic-generate/${randomUUID()}`;

    const { data: note, error: noteError } = await db
      .from("notes")
      .insert({
        user_id: user.id,
        title: deck.title,
        source_path: sourcePath,
        raw_content: topic,
        github_sha: null,
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (noteError) throw new Error(`Note insert failed: ${noteError.message}`);

    const { data: newDeck, error: deckError } = await db
      .from("decks")
      .insert({
        note_id: note.id,
        user_id: user.id,
        title: deck.title,
        topic_tags: deck.topic_tags,
      })
      .select()
      .single();

    if (deckError) throw new Error(`Deck insert failed: ${deckError.message}`);

    if (deck.cards.length > 0) {
      const { error: cardsError } = await db.from("cards").insert(
        deck.cards.map((card) => ({
          deck_id: newDeck.id,
          front: card.front,
          back: card.back,
          card_type: card.card_type,
        }))
      );
      if (cardsError) throw new Error(`Cards insert failed: ${cardsError.message}`);
      generateAndSaveDistractorsForDeck(newDeck.id, deck.title).catch(() => {});
    }

    return Response.json({
      deckId: newDeck.id,
      title: deck.title,
      cardCount: deck.cards.length,
      provider,
      model,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("generate-topic error:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}
