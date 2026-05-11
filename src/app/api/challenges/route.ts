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

  const sentData = sent.data ?? [];
  const receivedData = received.data ?? [];

  // Collect user IDs we need display names for
  const challengerIds = receivedData
    .map((r) => (r.challenges as unknown as { challenger_id: string } | null)?.challenger_id)
    .filter((id): id is string => Boolean(id));
  const recipientIds = sentData.flatMap((s) =>
    (s.challenge_attempts as unknown as { user_id: string }[]).map((a) => a.user_id)
  );
  const allIds = [...new Set([...challengerIds, ...recipientIds])];

  let profiles: Record<string, { display_name: string | null }> = {};
  if (allIds.length > 0) {
    const { data: profileData } = await admin
      .from("profiles")
      .select("id, display_name")
      .in("id", allIds);
    profiles = Object.fromEntries((profileData ?? []).map((p) => [p.id, p]));
  }

  return Response.json({ sent: sentData, received: receivedData, profiles });
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

  const VALID_QUIZ_MODES = ["multiple-choice", "type"] as const;
  const resolvedMode = quiz_mode ?? "multiple-choice";
  if (!VALID_QUIZ_MODES.includes(resolvedMode as typeof VALID_QUIZ_MODES[number]))
    return Response.json({ error: "invalid quiz_mode" }, { status: 400 });

  const admin = createAdminClient();

  // Filter out self-challenges
  const filteredRecipients = recipient_ids.filter((id) => id !== user.id);
  if (filteredRecipients.length === 0)
    return Response.json({ error: "at least one recipient required" }, { status: 400 });

  // Verify all recipients exist and fetch their notification prefs
  const { data: existingProfiles } = await admin
    .from("profiles")
    .select("id, notification_prefs")
    .in("id", filteredRecipients);
  const foundIds = new Set((existingProfiles ?? []).map((p) => p.id));
  const missing = filteredRecipients.filter((id) => !foundIds.has(id));
  if (missing.length > 0)
    return Response.json({ error: "one or more recipients not found" }, { status: 400 });

  const prefsMap = Object.fromEntries(
    (existingProfiles ?? []).map((p) => [
      p.id,
      (p.notification_prefs as Record<string, boolean> | null) ?? {},
    ])
  );

  const { data: challenge, error: challengeErr } = await admin
    .from("challenges")
    .insert({
      challenger_id: user.id,
      title: title.trim(),
      deck_id: deck_id ?? null,
      card_ids: card_ids ?? null,
      quiz_mode: resolvedMode,
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

  const attempts = filteredRecipients.map((uid) => ({
    challenge_id: challenge.id,
    user_id: uid,
    status: "pending" as const,
    total: card_ids ? card_ids.length : null,
  }));

  const notifications = filteredRecipients
    .filter((uid) => prefsMap[uid]?.challenge_received !== false)
    .map((uid) => ({
      user_id: uid,
      type: "challenge_received" as const,
      payload: {
        challenge_id: challenge.id,
        from_user_display_name: challengerName,
        title: challenge.title,
      },
    }));

  const attemptsRes = await admin.from("challenge_attempts").insert(attempts).select();
  if (attemptsRes.error) return Response.json({ error: attemptsRes.error.message }, { status: 500 });

  if (notifications.length > 0) {
    await admin.from("notifications").insert(notifications);
  }

  return Response.json({ challenge, attempts: attemptsRes.data }, { status: 201 });
}
