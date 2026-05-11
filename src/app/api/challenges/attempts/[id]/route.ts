import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import { NextRequest } from "next/server";

type AttemptUpdate = Database["public"]["Tables"]["challenge_attempts"]["Update"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: attempt, error: attemptErr } = await admin
    .from("challenge_attempts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (attemptErr || !attempt) return Response.json({ error: "Not found" }, { status: 404 });

  const { data: challenge, error: challengeErr } = await admin
    .from("challenges")
    .select("*")
    .eq("id", attempt.challenge_id)
    .single();

  if (challengeErr || !challenge) return Response.json({ error: "Challenge not found" }, { status: 404 });

  let cards: unknown[] = [];
  if (challenge.deck_id) {
    const { data: allCards } = await admin
      .from("cards")
      .select("*")
      .eq("deck_id", challenge.deck_id);

    const all = allCards ?? [];
    cards = challenge.card_ids?.length
      ? all.filter((c) => challenge.card_ids!.includes((c as { id: string }).id))
      : all;
  }

  return Response.json({ attempt, challenge, cards });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { status, score, total, card_results } = body as {
    status?: string;
    score?: number;
    total?: number;
    card_results?: { card_id: string; correct: boolean; chosen_answer: string }[];
  };

  const updates: AttemptUpdate = {};
  if (status === "in_progress") {
    updates.status = "in_progress";
    updates.started_at = new Date().toISOString();
  }
  if (status === "declined") {
    updates.status = "declined";
  }
  if (card_results !== undefined) updates.card_results = card_results;
  if (status === "completed") {
    updates.status = "completed";
    updates.score = score ?? null;
    updates.total = total ?? null;
    updates.completed_at = new Date().toISOString();
  }

  const admin = createAdminClient();

  const { data: attempt, error } = await admin
    .from("challenge_attempts")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)  // application-level auth guard
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  if (status === "completed" && attempt) {
    const { data: challenge } = await admin
      .from("challenges")
      .select("challenger_id, title")
      .eq("id", attempt.challenge_id)
      .single();

    if (challenge) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();

      await admin.from("notifications").insert({
        user_id: challenge.challenger_id,
        type: "challenge_completed",
        payload: {
          challenge_id: attempt.challenge_id,
          attempt_id: attempt.id,
          from_user_display_name: profile?.display_name ?? "Someone",
          title: challenge.title,
          score: score ?? 0,
          total: total ?? 0,
        },
      });
    }
  }

  return Response.json({ attempt });
}
