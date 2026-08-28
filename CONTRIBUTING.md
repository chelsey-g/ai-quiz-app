# Contributing to Quizly

Thanks for your interest. This is a small project — the process is light, but a
few things matter.

## Getting set up

Follow [README.md → Setup](./README.md#setup). You need Node 24+, a Supabase
project (or the local stack), and a Vercel AI Gateway key.

Before pushing:

```bash
npm run lint
npm test
npm run build
```

CI runs all three plus a migrations check on every PR; a PR that fails any of
them won't merge.

## Proposing a change

1. Open an issue first for anything non-trivial, so we can agree on the approach.
2. Branch off `main`. Name it `feat/<short-desc>`, `fix/<short-desc>`, or
   `chore/<short-desc>`.
3. Keep PRs focused — one logical change. Separate unrelated refactors.
4. Write or update tests for logic changes. Unit tests live next to the code as
   `*.test.ts` under `src/lib/`.
5. Open a PR into `main`. Direct pushes to `main` are blocked.

### Commit messages

Conventional-commits style, matching the existing history:

```
feat(quiz): add keyboard shortcuts to answer review
fix(cards): reset MC data when answer text changes
chore: bump supabase-js
```

## Database changes

The schema is defined entirely by the files in `supabase/migrations/`. It is the
**single source of truth** — the live database must never be ahead of it.

Rules:

- **Forward-only.** There are no down migrations. To undo something, write a new
  migration that reverses it.
- **Always a new file.** Never edit a migration that has already been applied
  anywhere. Create a new timestamped file instead:
  `supabase/migrations/<YYYYMMDDHHMMSS>_short_description.sql`
  (`npx supabase migration new short_description` generates the name).
- **Idempotent SQL** where practical — `add column if not exists`,
  `create table if not exists`, `create policy` guarded by a drop, etc.
- **RLS.** Every new table gets `enable row level security` and explicit
  policies in the same migration. Access is scoped by `user_id` via the
  cookie-based server client. Service-role (`supabase/admin.ts`) is the
  exception and must be justified in the PR.
- **Regenerate types** in the same PR:
  `npx supabase gen types typescript --linked > src/lib/database.types.ts`
- Apply locally / to your own project with `npx supabase db push` and verify
  before opening the PR.

## Code style

- Match the surrounding code — naming, structure, comment density.
- TypeScript, no `any` without a reason.
- All AI calls go through `generateObject` + a Zod schema. Never parse raw model
  text. Handle model errors with the gateway fallback chain, never silent
  failure.
- Don't add dependencies without raising it in the issue first.
- This is **not** a stock Next.js version — check `node_modules/next/dist/docs/`
  before using an App Router API you're unsure about. See [AGENTS.md](./AGENTS.md).

## Reporting bugs

Open an issue with repro steps, what you expected, and what happened. Include the
route and whether you were signed in.

## Security

Don't open a public issue for security problems. Use GitHub's private
vulnerability reporting: the repo's **Security** tab → **Report a vulnerability**.
