import { createClient } from "@/lib/supabase/server";
import { getDeckById } from "@/lib/services/decks";
import { NextRequest } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { deck, cards } = await getDeckById(id, user.id);
    return Response.json({ deck, cards });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = (err as Error & { status?: number }).status ?? 500;
    return Response.json({ error: message }, { status });
  }
}
