# Durable Generation Jobs — Design

**Date:** 2026-06-10
**Status:** Approved
**Inspiration:** Addy Osmani, "Long-Running Agents" (June 2026) — checkpoint-and-resume, generator/judge separation, append-only logs, externalized done conditions, ambient processing.

## Goal

Convert Quizly's card generation from synchronous request-handler work into durable background jobs that checkpoint progress, survive crashes/timeouts, verify their own output with a separate judge model, and leave an auditable event log. Add ambient regeneration so decks stay in sync with edited notes.

This is project 1 of 2 from the article. Project 2 (long-running dev-workflow agent) is a separate spec.

## Non-goals

- No new platforms: no Vercel Workflow DevKit, no Supabase queues/pg_cron. Durability is hand-rolled on Postgres.
- No changes to study mode, quiz mode, challenges, kata, or community features.
- No fleet orchestration / multi-agent coordination (article pattern out of scope for the app).

## Architecture

```
POST /api/import | /api/generate-topic | notes generate
        │  insert generation_jobs row (queued) + event, return 202 {jobId}
        ▼
POST /api/jobs/run  (worker; fire-and-forget kick, also re-kicked by sweeper)
        │  atomically claim job (queued → running, set heartbeat)
        │  loop: one unit of work per iteration
        │    generate → judge → save → checkpoint + heartbeat + events
        │  near timeout? checkpoint, re-kick self, exit
        │  all units done? evaluate done_condition → completed | failed
        ▼
GET /api/jobs/[id]      (UI polls status + checkpoint)
GET /api/jobs/[id]/events  (event timeline)

Vercel Cron: GET /api/jobs/sweep (every minute)
  - running + heartbeat stale > 2 min → re-kick (attempts + 1)
  - attempts > max (3) → failed + event
```

### Unit of work

- `import`: one file = one unit
- `topic` / `notes`: single unit
- `regenerate`: single unit (one note → one deck)

## Data model

One migration adds two tables.

### `generation_jobs`

| column | type | notes |
|---|---|---|
| id | uuid pk default gen_random_uuid() | |
| user_id | uuid not null → auth.users | |
| type | text check in ('import','topic','notes','regenerate') | |
| status | text check in ('queued','running','completed','failed') | |
| payload | jsonb not null | input: `{files:[{name,content}]}` or `{topic}` or `{noteId,title?}` |
| checkpoint | jsonb not null default '{}' | `{units:[{key,status:'ok'|'error',deckId?,cardCount?,error?}]}` — completed units are never redone |
| done_condition | jsonb not null | written at enqueue time, e.g. `{minCardsPerUnit:5, judgePassRate:0.8}` |
| result | jsonb | final summary on completion/failure |
| attempts | int not null default 0 | |
| heartbeat_at | timestamptz | updated on claim and after every unit |
| created_at / started_at / finished_at | timestamptz | |

### `generation_events` (append-only; insert-only, never updated)

| column | type |
|---|---|
| id | bigint generated always as identity pk |
| job_id | uuid not null → generation_jobs on delete cascade |
| ts | timestamptz not null default now() |
| type | text not null — `job_queued`, `job_claimed`, `unit_started`, `model_called`, `judge_verdict`, `cards_regenerated`, `unit_completed`, `unit_failed`, `checkpoint_written`, `job_completed`, `job_failed`, `job_swept` |
| data | jsonb not null default '{}' |

**RLS:** enabled on both. Policy: `select` for `auth.uid() = user_id` (events join through jobs). All writes via service role from API routes, matching the existing pattern.

**Indexes:** `generation_jobs (status, heartbeat_at)` for the sweeper; `generation_events (job_id, id)` for timelines.

## Worker semantics

- **Claiming:** `UPDATE generation_jobs SET status='running', heartbeat_at=now(), started_at=coalesce(started_at,now()), attempts=attempts+1 WHERE id=$1 AND status IN ('queued') RETURNING *` — also used by the sweeper with `OR (status='running' AND heartbeat_at < now() - interval '2 minutes')`. No row returned → someone else owns it; exit.
- **Checkpointing:** after each unit, write `checkpoint`, `heartbeat_at`, and a `checkpoint_written` event in one round trip. Resume = skip units already `ok` in checkpoint.
- **Time budget:** the worker tracks elapsed time; with < 60s left of the function budget it checkpoints, sets status back to `queued`, fires a new kick to `/api/jobs/run`, and exits. The sweeper is the backstop if the kick is lost.
- **Auth:** worker and sweeper routes accept either a Vercel Cron header check or an internal secret (`JOBS_WORKER_SECRET`) — they are not user-facing.
- **Per-unit isolation:** a unit that throws is recorded as `status:'error'` in the checkpoint with a `unit_failed` event; the job continues to the next unit.

## Judge stage (generator ≠ evaluator)

After `generateCards` returns a deck for a unit:

1. Call `generateObject` with a cheap judge model (`anthropic/claude-haiku-4.5` via the gateway) and a `JudgeVerdictSchema`: per card `{index, pass, reasons[]}`. Criteria: back is factually correct; card is self-contained; front is an actual prompt/question; not a near-duplicate of another card in the same deck.
2. Failing cards get **one** regeneration attempt: failure reasons are passed back to the generator, replacements are re-judged.
3. Cards failing twice are dropped, recorded in a `judge_verdict` event.
4. Before saving, evaluate the unit against `done_condition` (enough surviving cards, pass rate met). Unmet → unit fails with the judge's reasons in the event log. Never silently save a deck that failed its done condition.

New module: `src/lib/ai/judge-cards.ts` (schema + judge call + regenerate-failed helper). `generate-cards.ts` stays a pure generator.

## Ambient regeneration

- Saving a note with **changed content** enqueues a `regenerate` job — skipped if a `queued`/`running` regenerate job already exists for that note (debounce).
- Regeneration diffs against existing cards by exact `front+back` match: unchanged cards keep their rows (SM-2 stats survive), new cards are inserted, removed cards are deleted. This replaces today's delete-deck-and-recreate behavior for re-imports too.
- Card diff lives in `src/lib/services/card-diff.ts` with unit tests.

## API & UI changes

- `POST /api/import`: validates, enqueues, kicks worker, returns `202 {jobId}`. Same for topic/notes generation routes.
- `GET /api/jobs?limit=` — recent jobs for the user. `GET /api/jobs/[id]` — status + checkpoint. `GET /api/jobs/[id]/events` — timeline.
- Import page: polls job status, shows per-file progress (pending / generating / judging / done / failed) instead of one long await.
- New `/jobs` page: recent jobs list; detail view renders the event timeline (model calls, fallbacks, judge verdicts, checkpoints). Follow the Quizly colour scheme memory.
- `vercel.ts`/`vercel.json` cron entry for `/api/jobs/sweep` every minute.

## Error handling

- Gateway model fallback chain unchanged; each fallback recorded as a `model_called` event.
- Max 3 attempts per job, then `failed` with a `job_failed` event explaining the last error.
- Payload size: import payloads live in the job row (jsonb); fine at current scale (.md files). Revisit if PDFs land in payloads.

## Testing

- **Checkpoint/resume:** unit test the worker loop with an injected "crash" after unit 1; re-run; assert unit 1 is not reprocessed and the job completes.
- **Done condition:** evaluation helper tested for pass/fail/edge (zero cards).
- **Judge:** mocked model — fail → regenerate → pass; fail → fail → dropped; pass-rate breach fails the unit.
- **Card diff:** unchanged cards keep ids; adds/removes correct.
- **Sweeper:** stale-heartbeat query claims only stale jobs; attempts cap → failed.

## Build order

1. Migration + jobs/events tables + worker + sweeper; convert `/api/import` (judge stubbed to pass-all).
2. Judge stage + done conditions.
3. Jobs UI (import-page progress + `/jobs` timeline).
4. Ambient regeneration + card diff (convert remaining generation routes).
