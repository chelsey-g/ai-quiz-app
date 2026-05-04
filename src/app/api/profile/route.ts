import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: { display_name?: string; avatar_url?: string } = {};

  if ("display_name" in body) {
    const display_name = typeof body.display_name === "string" ? body.display_name.trim() : null;
    if (!display_name) return Response.json({ error: "display_name is required" }, { status: 400 });
    if (display_name.length > 30) return Response.json({ error: "display_name max 30 chars" }, { status: 400 });
    updates.display_name = display_name;
  }

  if ("avatar_url" in body) {
    const avatar_url = typeof body.avatar_url === "string" ? body.avatar_url.trim() : null;
    if (!avatar_url) return Response.json({ error: "avatar_url is required" }, { status: 400 });
    updates.avatar_url = avatar_url;
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

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ display_name: data?.display_name ?? null });
}
