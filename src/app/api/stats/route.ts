// src/app/api/stats/route.ts
import { createClient } from "@/lib/supabase/server";
import { getGlobalStats } from "@/lib/services/stats";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const stats = await getGlobalStats(user.id);
    return Response.json(stats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
