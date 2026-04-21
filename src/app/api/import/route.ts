import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateCards } from "@/lib/ai/generate-cards";
import type { Database } from "@/lib/database.types";

function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface ImportFile {
  name: string;
  content: string;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const files: ImportFile[] = body.files;

  if (!Array.isArray(files) || files.length === 0) {
    return Response.json({ error: "No files provided" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const results: Array<{
    file: string;
    status: "ok" | "error";
    title?: string;
    cardCount?: number;
    provider?: string;
    model?: string;
    error?: string;
  }> = [];

  for (const file of files) {
    try {
      const { deck, provider, model } = await generateCards(file.content, file.name);

      const { data: note, error: noteError } = await supabase
        .from("notes")
        .upsert(
          {
            user_id: null,
            title: deck.title,
            source_path: `direct-import/${file.name}`,
            raw_content: file.content,
            github_sha: null,
            processed_at: new Date().toISOString(),
          },
          { onConflict: "source_path, github_sha" }
        )
        .select()
        .single();

      if (noteError) throw new Error(`Note upsert failed: ${noteError.message}`);

      await supabase.from("decks").delete().eq("note_id", note.id);

      const { data: newDeck, error: deckError } = await supabase
        .from("decks")
        .insert({
          note_id: note.id,
          user_id: null,
          title: deck.title,
          topic_tags: deck.topic_tags,
        })
        .select()
        .single();

      if (deckError) throw new Error(`Deck insert failed: ${deckError.message}`);

      if (deck.cards.length > 0) {
        const { error: cardsError } = await supabase.from("cards").insert(
          deck.cards.map((card) => ({
            deck_id: newDeck.id,
            front: card.front,
            back: card.back,
            card_type: card.card_type,
          }))
        );
        if (cardsError) throw new Error(`Cards insert failed: ${cardsError.message}`);
      }

      results.push({
        file: file.name,
        status: "ok",
        title: deck.title,
        cardCount: deck.cards.length,
        provider,
        model,
      });
    } catch (err) {
      results.push({
        file: file.name,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return Response.json({ processed: results.length, results });
}
