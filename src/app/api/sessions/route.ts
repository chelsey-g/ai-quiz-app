import { createClient } from "@/lib/supabase/server";
import { saveSession } from "@/lib/services/sessions";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  try {
    await saveSession({
      userId: user.id,
      deckId,
      score,
      startedAt,
      results: results ?? [],
    });
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
