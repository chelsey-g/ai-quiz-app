import { createClient } from "jsr:@supabase/supabase-js@2";
import { generateObject } from "npm:ai";
import { createAnthropic } from "npm:@ai-sdk/anthropic";
import { createOpenAI } from "npm:@ai-sdk/openai";
import { z } from "npm:zod";

// ─── Schema ───────────────────────────────────────────────────────────────────

const DeckSchema = z.object({
  title: z.string().describe("Short descriptive title for this note"),
  topic_tags: z.array(z.string()).describe("Main technologies or concepts covered"),
  cards: z.array(
    z.object({
      front: z.string().describe("Question or term — one sentence max"),
      back: z.string().describe("Concise but complete answer or definition"),
      card_type: z.enum(["flashcard", "mcq", "free_text"]).default("flashcard"),
    })
  ).describe("5–15 flashcards depending on content depth"),
});

type GeneratedDeck = z.infer<typeof DeckSchema>;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GitHubPushPayload {
  repository: { full_name: string };
  head_commit: { id: string; added: string[]; modified: string[]; removed: string[] };
  commits: Array<{ added: string[]; modified: string[] }>;
}

// ─── Webhook signature verification ──────────────────────────────────────────

async function verifySignature(
  body: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature?.startsWith("sha256=")) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected =
    "sha256=" +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── GitHub helpers ───────────────────────────────────────────────────────────

async function fetchFileContent(
  repoFullName: string,
  filePath: string,
  sha: string,
  githubToken: string
): Promise<string> {
  const url = `https://api.github.com/repos/${repoFullName}/contents/${filePath}?ref=${sha}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github.v3.raw",
      "User-Agent": "ai-quiz-app-ingest",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error fetching ${filePath}: ${res.status} ${res.statusText}`);
  }

  return res.text();
}

function collectChangedMarkdownFiles(payload: GitHubPushPayload): string[] {
  const seen = new Set<string>();
  for (const commit of payload.commits) {
    for (const file of [...commit.added, ...commit.modified]) {
      if (file.startsWith("notes/") && file.endsWith(".md")) seen.add(file);
    }
  }
  return Array.from(seen);
}

// ─── AI generation — cheapest model first ────────────────────────────────────

const SYSTEM_PROMPT =
  "You are a study content generator. Given a Markdown note about software engineering, " +
  "extract key concepts and generate flashcards for active recall practice. " +
  "Generate 5–15 cards depending on content depth. If the note has no learnable concepts, return an empty cards array.";

// Ordered cheapest → most capable. Skipped if the provider key isn't set.
const MODEL_PRIORITY = [
  { provider: "openai" as const, model: "gpt-4o-mini" },
  { provider: "anthropic" as const, model: "claude-haiku-4-5-20251001" },
  { provider: "anthropic" as const, model: "claude-sonnet-4-6" },
  { provider: "openai" as const, model: "gpt-4o" },
];

async function generateCards(
  content: string,
  filePath: string,
  anthropicKey: string,
  openaiKey: string | undefined
): Promise<{ deck: GeneratedDeck; provider: string; model: string }> {
  const anthropic = createAnthropic({ apiKey: anthropicKey });
  const openai = openaiKey ? createOpenAI({ apiKey: openaiKey }) : null;

  const errors: string[] = [];

  for (const { provider, model } of MODEL_PRIORITY) {
    const client = provider === "anthropic" ? anthropic : openai;
    if (!client) continue;

    try {
      const { object } = await generateObject({
        model: client(model),
        schema: DeckSchema,
        system: SYSTEM_PROMPT,
        prompt: `File: ${filePath}\n\n${content}`,
      });
      return { deck: object, provider, model };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push(`${provider}/${model}: ${reason}`);
      console.warn(`Model failed, trying next. ${provider}/${model}: ${reason}`);
    }
  }

  throw new Error(`All models failed:\n${errors.join("\n")}`);
}

// ─── Supabase upsert ──────────────────────────────────────────────────────────

async function upsertDeck(
  supabase: ReturnType<typeof createClient>,
  params: {
    userId: string | null;
    repoFullName: string;
    filePath: string;
    sha: string;
    rawContent: string;
    deck: GeneratedDeck;
  }
) {
  const { userId, repoFullName, filePath, sha, rawContent, deck } = params;

  const { data: note, error: noteError } = await supabase
    .from("notes")
    .upsert(
      {
        user_id: userId,
        title: deck.title,
        source_path: `${repoFullName}/${filePath}`,
        raw_content: rawContent,
        github_sha: sha,
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
      user_id: userId,
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

  return { note, deck: newDeck, cardCount: deck.cards.length };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
  const githubToken = Deno.env.get("GITHUB_TOKEN");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY"); // optional fallback
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!webhookSecret || !githubToken || !anthropicKey || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing required environment variables");
    return new Response("Server misconfiguration", { status: 500 });
  }

  const body = await req.text();

  const signature = req.headers.get("x-hub-signature-256");
  if (!(await verifySignature(body, signature, webhookSecret))) {
    console.error("Invalid webhook signature");
    return new Response("Unauthorized", { status: 401 });
  }

  const event = req.headers.get("x-github-event");
  if (event !== "push") {
    return new Response(JSON.stringify({ skipped: true, event }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = JSON.parse(body) as GitHubPushPayload;
  const mdFiles = collectChangedMarkdownFiles(payload);

  if (mdFiles.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, message: "No markdown files changed" }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const results: Array<{
    file: string;
    status: "ok" | "error";
    provider?: string;
    model?: string;
    cardCount?: number;
    error?: string;
  }> = [];

  for (const filePath of mdFiles) {
    try {
      console.log(`Processing: ${filePath}`);

      const rawContent = await fetchFileContent(
        payload.repository.full_name,
        filePath,
        payload.head_commit.id,
        githubToken
      );

      const { deck, provider, model } = await generateCards(rawContent, filePath, anthropicKey, openaiKey);

      const { cardCount } = await upsertDeck(supabase, {
        userId: null,
        repoFullName: payload.repository.full_name,
        filePath,
        sha: payload.head_commit.id,
        rawContent,
        deck,
      });

      console.log(`Done [${provider}/${model}]: ${filePath} — ${cardCount} cards`);
      results.push({ file: filePath, status: "ok", provider, model, cardCount });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`Failed: ${filePath} — ${error}`);
      results.push({ file: filePath, status: "error", error });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
