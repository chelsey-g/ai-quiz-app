import { createClient } from "@/lib/supabase/server";
import { getOrCreateChatNotesDeck } from "@/lib/services/decks";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const deck = await getOrCreateChatNotesDeck(user.id);
    return Response.json(deck);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
