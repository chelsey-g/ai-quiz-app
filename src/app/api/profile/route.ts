import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest } from "next/server";

type NotificationPrefs = {
  challenge_received: boolean;
  challenge_completed: boolean;
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, default_study_mode, daily_goal, notification_prefs")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    display_name: data?.display_name ?? null,
    avatar_url: data?.avatar_url ?? null,
    default_study_mode: (data?.default_study_mode as string | null) ?? "flip",
    daily_goal: (data?.daily_goal as number | null) ?? null,
    notification_prefs: (data?.notification_prefs as NotificationPrefs | null) ?? {
      challenge_received: true,
      challenge_completed: true,
    },
    email: user.email ?? "",
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if ("display_name" in body) {
    const display_name = typeof body.display_name === "string" ? body.display_name.trim() : null;
    if (!display_name) return Response.json({ error: "display_name is required" }, { status: 400 });
    if (display_name.length > 30) return Response.json({ error: "display_name max 30 chars" }, { status: 400 });
    updates.display_name = display_name;
  }

  if ("avatar_url" in body) {
    const avatar_url = body.avatar_url === null ? null : typeof body.avatar_url === "string" ? body.avatar_url.trim() || null : null;
    updates.avatar_url = avatar_url;
  }

  if ("default_study_mode" in body) {
    if (body.default_study_mode !== "flip" && body.default_study_mode !== "type") {
      return Response.json({ error: "default_study_mode must be flip or type" }, { status: 400 });
    }
    updates.default_study_mode = body.default_study_mode;
  }

  if ("daily_goal" in body) {
    const daily_goal = body.daily_goal === null ? null : Number(body.daily_goal);
    if (daily_goal !== null && (isNaN(daily_goal) || daily_goal < 1)) {
      return Response.json({ error: "daily_goal must be a positive integer" }, { status: 400 });
    }
    updates.daily_goal = daily_goal;
  }

  if ("notification_prefs" in body && typeof body.notification_prefs === "object" && body.notification_prefs !== null) {
    updates.notification_prefs = {
      challenge_received: Boolean((body.notification_prefs as NotificationPrefs).challenge_received ?? true),
      challenge_completed: Boolean((body.notification_prefs as NotificationPrefs).challenge_completed ?? true),
    };
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, ...updates });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
