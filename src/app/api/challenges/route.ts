import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const [sent, received] = await Promise.all([
    admin
      .from("challenges")
      .select("id, title, deck_id, status, created_at, challenge_attempts(id, user_id, status, score, total)")
      .eq("challenger_id", user.id)
      .order("created_at", { ascending: false }),
    admin
      .from("challenge_attempts")
      .select("id, status, score, total, challenge_id, challenges(id, title, challenger_id)")
      .eq("user_id", user.id)
      .order("challenge_id", { ascending: false }),
  ]);

  if (sent.error) return Response.json({ error: sent.error.message }, { status: 500 });
  if (received.error) return Response.json({ error: received.error.message }, { status: 500 });

  return Response.json({ sent: sent.data ?? [], received: received.data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { title, deck_id, card_ids, recipient_ids, quiz_mode } = body as {
    title?: string;
    deck_id?: string;
    card_ids?: string[] | null;
    recipient_ids?: string[];
    quiz_mode?: string;
  };

  if (!title?.trim()) return Response.json({ error: "title is required" }, { status: 400 });
  if (!Array.isArray(recipient_ids) || recipient_ids.length === 0)
    return Response.json({ error: "at least one recipient required" }, { status: 400 });

  const admin = createAdminClient();

  const { data: challenge, error: challengeErr } = await admin
    .from("challenges")
    .insert({
      challenger_id: user.id,
      title: title.trim(),
      deck_id: deck_id ?? null,
      card_ids: card_ids ?? null,
      quiz_mode: quiz_mode ?? "multiple-choice",
    })
    .select()
    .single();

  if (challengeErr) return Response.json({ error: challengeErr.message }, { status: 500 });

  const { data: challengerProfile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  const challengerName = challengerProfile?.display_name ?? "Someone";

  const attempts = recipient_ids.map((uid) => ({
    challenge_id: challenge.id,
    user_id: uid,
    status: "pending" as const,
    total: card_ids ? card_ids.length : null,
  }));

  const notifications = recipient_ids.map((uid) => ({
    user_id: uid,
    type: "challenge_received" as const,
    payload: {
      challenge_id: challenge.id,
      from_user_display_name: challengerName,
      title: challenge.title,
    },
  }));

  const [attemptsRes, notificationsRes] = await Promise.all([
    admin.from("challenge_attempts").insert(attempts).select(),
    admin.from("notifications").insert(notifications),
  ]);

  if (attemptsRes.error) return Response.json({ error: attemptsRes.error.message }, { status: 500 });
  if (notificationsRes.error) return Response.json({ error: notificationsRes.error.message }, { status: 500 });

  return Response.json({ challenge, attempts: attemptsRes.data }, { status: 201 });
}
