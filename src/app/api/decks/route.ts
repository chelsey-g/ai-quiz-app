import { createClient } from "@/lib/supabase/server";
import { getDecks } from "@/lib/services/decks";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const decksWithStats = await getDecks(user.id);
    return Response.json(decksWithStats);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
