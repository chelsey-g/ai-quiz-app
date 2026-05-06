import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDecksByTag } from "@/lib/services/decks";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  const { tag } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const decks = await getDecksByTag(decodeURIComponent(tag), user.id);
  return Response.json({ tag: decodeURIComponent(tag), decks });
}
