import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-6";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GitHubPushPayload {
  ref: string;
  repository: {
    full_name: string;
    default_branch: string;
  };
  head_commit: {
    id: string;
    added: string[];
    modified: string[];
    removed: string[];
  };
  commits: Array<{
    added: string[];
    modified: string[];
  }>;
  sender: {
    login: string;
  };
}

interface GeneratedCard {
  front: string;
  back: string;
  card_type: "flashcard" | "mcq" | "free_text";
}

interface ClaudeResponse {
  title: string;
  topic_tags: string[];
  cards: GeneratedCard[];
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

  // Constant-time comparison
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
    throw new Error(
      `GitHub API error fetching ${filePath}: ${res.status} ${res.statusText}`
    );
  }

  return res.text();
}

function collectChangedMarkdownFiles(payload: GitHubPushPayload): string[] {
  const seen = new Set<string>();
  for (const commit of payload.commits) {
    for (const file of [...commit.added, ...commit.modified]) {
      if (file.endsWith(".md")) seen.add(file);
    }
  }
  return Array.from(seen);
}

// ─── Claude helpers ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a study content generator. Given a Markdown note about software engineering, extract key concepts and generate study flashcards.

Return ONLY valid JSON — no prose, no markdown fences, no explanation. Schema:
{
  "title": "short descriptive title for this note",
  "topic_tags": ["array", "of", "relevant", "tags"],
  "cards": [
    {
      "front": "question or term",
      "back": "answer or definition",
      "card_type": "flashcard"
    }
  ]
}

Rules:
- Generate 5–15 cards per note depending on content depth
- front should be a clear question or term, never more than one sentence
- back should be a concise but complete answer
- topic_tags should reflect the main technologies or concepts (e.g. "React", "TypeScript", "Big O")
- card_type is always "flashcard" for now
- If the note is too short or contains no learnable concepts, return an empty cards array`;

async function generateCards(
  content: string,
  filePath: string,
  anthropicKey: string
): Promise<ClaudeResponse> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `File: ${filePath}\n\n${content}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${res.status} — ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;

  if (!text) throw new Error("Claude returned empty content");

  try {
    return JSON.parse(text) as ClaudeResponse;
  } catch {
    throw new Error(`Failed to parse Claude JSON response: ${text.slice(0, 200)}`);
  }
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
    generated: ClaudeResponse;
  }
) {
  const { userId, repoFullName, filePath, sha, rawContent, generated } = params;

  // Upsert note (match on source_path + github_sha to avoid reprocessing)
  const { data: note, error: noteError } = await supabase
    .from("notes")
    .upsert(
      {
        user_id: userId,
        title: generated.title,
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

  // Delete existing deck for this note so we regenerate cleanly
  await supabase.from("decks").delete().eq("note_id", note.id);

  // Insert fresh deck
  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .insert({
      note_id: note.id,
      user_id: userId,
      title: generated.title,
      topic_tags: generated.topic_tags,
    })
    .select()
    .single();

  if (deckError) throw new Error(`Deck insert failed: ${deckError.message}`);

  // Bulk insert cards
  if (generated.cards.length > 0) {
    const { error: cardsError } = await supabase.from("cards").insert(
      generated.cards.map((card) => ({
        deck_id: deck.id,
        front: card.front,
        back: card.back,
        card_type: card.card_type,
      }))
    );

    if (cardsError) throw new Error(`Cards insert failed: ${cardsError.message}`);
  }

  return { note, deck, cardCount: generated.cards.length };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
  const githubToken = Deno.env.get("GITHUB_TOKEN");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!webhookSecret || !githubToken || !anthropicKey || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing required environment variables");
    return new Response("Server misconfiguration", { status: 500 });
  }

  const body = await req.text();

  // Verify GitHub signature
  const signature = req.headers.get("x-hub-signature-256");
  const valid = await verifySignature(body, signature, webhookSecret);
  if (!valid) {
    console.error("Invalid webhook signature");
    return new Response("Unauthorized", { status: 401 });
  }

  // Only process push events
  const event = req.headers.get("x-github-event");
  if (event !== "push") {
    return new Response(JSON.stringify({ skipped: true, event }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = JSON.parse(body) as GitHubPushPayload;
  const mdFiles = collectChangedMarkdownFiles(payload);

  if (mdFiles.length === 0) {
    return new Response(JSON.stringify({ processed: 0, message: "No markdown files changed" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const results: Array<{ file: string; status: "ok" | "error"; detail?: string; cardCount?: number }> = [];

  for (const filePath of mdFiles) {
    try {
      console.log(`Processing: ${filePath}`);

      const rawContent = await fetchFileContent(
        payload.repository.full_name,
        filePath,
        payload.head_commit.id,
        githubToken
      );

      const generated = await generateCards(rawContent, filePath, anthropicKey);

      const { cardCount } = await upsertDeck(supabase, {
        userId: null, // anonymous for MVP — wire up auth later
        repoFullName: payload.repository.full_name,
        filePath,
        sha: payload.head_commit.id,
        rawContent,
        generated,
      });

      console.log(`Done: ${filePath} — ${cardCount} cards`);
      results.push({ file: filePath, status: "ok", cardCount });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(`Failed: ${filePath} — ${detail}`);
      results.push({ file: filePath, status: "error", detail });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
