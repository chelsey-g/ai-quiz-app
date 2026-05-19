// src/app/kata/[deckId]/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KataWorkspace from "./kata-workspace";

export default async function KataPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: deck } = await supabase
    .from("decks")
    .select("id, title, topic_tags, is_code_deck")
    .eq("id", deckId)
    .single();

  if (!deck || !deck.is_code_deck) redirect(`/decks/${deckId}`);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <KataWorkspace
        deckId={deck.id}
        deckTitle={deck.title}
        deckTags={deck.topic_tags ?? []}
      />
    </div>
  );
}
