import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: challenge, error: challengeErr } = await supabase
    .from("challenges")
    .select("*")
    .eq("id", id)
    .eq("challenger_id", user.id)
    .single();

  if (challengeErr || !challenge) return Response.json({ error: "Not found" }, { status: 404 });

  const { data: attempts, error: attemptsErr } = await supabase
    .from("challenge_attempts")
    .select("*")
    .eq("challenge_id", id)
    .order("completed_at", { ascending: true });

  if (attemptsErr) return Response.json({ error: attemptsErr.message }, { status: 500 });

  let cards: unknown[] = [];
  if (challenge.deck_id) {
    const { data: allCards } = await supabase
      .from("cards")
      .select("id, front, back")
      .eq("deck_id", challenge.deck_id);

    const all = allCards ?? [];
    cards = challenge.card_ids?.length
      ? all.filter((c) => challenge.card_ids!.includes(c.id))
      : all;
  }

  const userIds = (attempts ?? []).map((a) => a.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);

  return Response.json({ challenge, attempts: attempts ?? [], cards, profiles: profiles ?? [] });
}
