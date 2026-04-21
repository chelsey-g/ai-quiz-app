import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { NextRequest } from "next/server";

function serviceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = serviceClient();

  const [{ data: deck, error: deckError }, { data: cards, error: cardsError }] =
    await Promise.all([
      supabase.from("decks").select("*").eq("id", id).single(),
      supabase.from("cards").select("*").eq("deck_id", id).order("created_at"),
    ]);

  if (deckError) {
    const status = deckError.code === "PGRST116" ? 404 : 500;
    return Response.json({ error: deckError.message }, { status });
  }

  return Response.json({ deck, cards: cards ?? [] });
}
