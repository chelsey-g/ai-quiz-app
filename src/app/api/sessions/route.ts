import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { NextRequest } from "next/server";
import { sm2, qualityFromCorrect } from "@/lib/sm2";

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    deckId: string;
    score: number;
    startedAt: string;
    results: { cardId: string; correct: boolean }[];
  };

  const { deckId, score, startedAt, results } = body;

  if (!deckId || typeof score !== "number" || !startedAt) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = serviceClient();
  const now = new Date().toISOString();

  const { error: sessionError } = await supabase.from("sessions").insert({
    deck_id: deckId,
    score,
    started_at: startedAt,
    completed_at: now,
  });

  if (sessionError) {
    return Response.json({ error: sessionError.message }, { status: 500 });
  }

  if (results.length > 0) {
    const cardIds = results.map((r) => r.cardId);
    const { data: existingCards, error: fetchError } = await supabase
      .from("cards")
      .select("id, times_seen, times_correct, repetitions, ease_factor, interval_days")
      .in("id", cardIds);

    if (!fetchError && existingCards) {
      const cardMap = new Map(existingCards.map((c) => [c.id, c]));
      await Promise.all(
        results.map(({ cardId, correct }) => {
          const card = cardMap.get(cardId);
          if (!card) return Promise.resolve();
          const scheduling = sm2(card, qualityFromCorrect(correct));
          return supabase
            .from("cards")
            .update({
              times_seen: card.times_seen + 1,
              times_correct: card.times_correct + (correct ? 1 : 0),
              last_seen_at: now,
              repetitions: scheduling.repetitions,
              ease_factor: scheduling.ease_factor,
              interval_days: scheduling.interval_days,
              next_review_at: scheduling.next_review_at,
            })
            .eq("id", cardId);
        })
      );
    }
  }

  return Response.json({ ok: true });
}
