import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const display_name = typeof body.display_name === "string" ? body.display_name.trim() : null;
  if (!display_name) return Response.json({ error: "display_name is required" }, { status: 400 });
  if (display_name.length > 30) return Response.json({ error: "display_name max 30 chars" }, { status: 400 });

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, display_name });

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
