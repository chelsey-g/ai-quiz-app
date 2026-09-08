---
title: Staging environment (DIY second Supabase project)
date: 2026-09-08
status: draft
---

# Staging environment — design

## Problem

Trove has **one** deployed environment. The production Supabase project
(`wlghyvhrzdhfnkykhcoj`) backs both Vercel `Production` **and** Vercel `Preview`
deployments — the Supabase↔Vercel marketplace integration syncs the same
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
`SUPABASE_SERVICE_ROLE_KEY` values to both targets.

Consequences:

- Every PR preview deploy reads and writes **production data**. A bad query, a
  destructive migration, or a seed script in a branch hits real user rows.
- Schema migrations are only ever exercised against a throwaway Postgres in CI
  (the `migrations` job) or by a manual `supabase db push` straight to prod.
  There is no persistent non-prod database that mirrors prod's schema for
  end-to-end testing before release.

This is the one item deliberately deferred from the 2026-08-28 repo-hardening
plan (workstream E). Branch protection, CI, and the consolidated migration
baseline all shipped; staging did not.

## Goal

A persistent, non-production Supabase project that all **Preview** deployments
use, with PR migrations applied to it automatically before the preview build
runs. Production deploy flow is unchanged.

Non-goals:

- No new Vercel custom environment, no new long-lived git branch. The existing
  `local → PR (Preview) → merge → main (Production)` flow becomes the staging
  path; the PR *is* the staging gate.
- No automated production migrations. `supabase db push` to prod stays a
  deliberate manual step (per `CONTRIBUTING.md`). Only staging gets the
  automated pipeline.
- No data sync from prod. Staging starts empty; contributors sign up test
  accounts and generate test decks against it.
- Supabase Branching (per-PR isolated DBs) is explicitly **not** chosen — it
  requires the Pro plan ($25/mo). This is a solo repo with sequential PRs, so
  one shared staging DB covers the risk.

## Architecture

### Components

| Component | What it is | Depends on |
|---|---|---|
| `trove-staging` Supabase project | New free-tier project, Postgres 17 (matches prod `major_version = 17`). Region us-east-2 to match prod. Holds `auth` + `storage` + `public` schema, seeded from the migration baseline. | — |
| GitHub Actions secrets | `SUPABASE_ACCESS_TOKEN` (personal access token, staging-capable), `SUPABASE_STAGING_PROJECT_REF`, `SUPABASE_STAGING_DB_PASSWORD`. Repo-level secrets. | `trove-staging` created |
| `staging-migrations` CI job | New job in `.github/workflows/ci.yml`, runs on `pull_request` to `main`. Links to `trove-staging` and runs `supabase db push` so any migration in the PR is live on staging before the preview build reads it. | secrets, `trove-staging` |
| Vercel env var split | The three `NEXT_PUBLIC_SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` vars: narrow the marketplace-synced values to **Production only**; add **Preview-only** overrides pointing at `trove-staging`. | `trove-staging` keys known |
| Docs updates | `README.md` "Database" + a new "Environments" section; `CONTRIBUTING.md` "Database changes"; `.env.example` comment noting prod vs staging. | — |

### Data flow — a schema change

```
dev writes migration file locally
  → supabase db push  (against own project or local stack)   [unchanged]
  → git push, open PR to main
      → CI `quality` job         (lint/test/build)            [unchanged]
      → CI `migrations` job       (baseline → throwaway PG,    [unchanged]
                                   drift check)
      → CI `staging-migrations` job  (NEW)
            supabase link --project-ref $STAGING_REF
            supabase db push            → migration now live on trove-staging
      → Vercel Preview deploy builds, reads trove-staging      [was: prod]
  → reviewer clicks the preview URL, exercises the change on staging data
  → merge to main
      → Vercel Production deploy builds, reads prod            [unchanged]
      → dev runs `supabase db push` against prod manually      [unchanged]
```

### The `staging-migrations` job

- Trigger: `on: pull_request: branches: [main]`. Not on `push` to `main` (prod
  is manual).
- Runner: ubuntu-latest, `supabase/setup-cli@v1` (same as the existing
  `migrations` job).
- Steps:
  1. `supabase link --project-ref ${{ secrets.SUPABASE_STAGING_PROJECT_REF }}`
     with `SUPABASE_ACCESS_TOKEN` in env and
     `SUPABASE_DB_PASSWORD` from the staging secret.
  2. `supabase db push --include-all` — applies any migration files in
     `supabase/migrations/` not yet in staging's ledger. Idempotent: a PR that
     touches no migrations is a no-op.
- Failure mode: if the migration fails to apply, the job fails and blocks the
  PR (once added to branch-protection required checks — see Rollout). The
  preview deploy may still run, but the reviewer sees the red check.
- **Forking note:** secrets are not exposed to `pull_request` runs from forks.
  This repo is solo/public; contributors would use branches on the main repo or
  the maintainer re-runs the job. Documented as a known limitation, not solved
  here.

### Vercel env var split

Current (via marketplace integration, `Preview, Production` on all four):

```
NEXT_PUBLIC_SUPABASE_URL          → prod
NEXT_PUBLIC_SUPABASE_ANON_KEY     → prod
SUPABASE_SERVICE_ROLE_KEY         → prod
NEXT_PUBLIC_SITE_URL              → per-env (already correct)
```

Target:

```
Production scope:  NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY / SERVICE_ROLE_KEY  → prod   (marketplace-synced, unchanged values)
Preview scope:     NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY / SERVICE_ROLE_KEY  → trove-staging  (manual overrides)
```

Mechanics to confirm during implementation:

- Whether the Supabase marketplace integration will **re-add** Preview-scoped
  values on its next sync and clobber the override. If it does, the fallback is
  to detach the integration's Preview scope in the Supabase dashboard
  (Integrations → Vercel → configure), or manage all four vars manually.
- `vercel env rm <name> preview` then `vercel env add <name> preview` per var,
  or do it in the Vercel dashboard. Four vars.
- `NEXT_PUBLIC_SITE_URL` for Preview is Vercel's per-deployment URL — leave as
  is.

### Free-tier constraints (accepted)

- **Auto-pause after ~7 days idle.** First CI run or preview deploy after a
  quiet week fails until the project resumes. Mitigation: the
  `staging-migrations` job runs on every PR, which counts as activity; if gaps
  are longer, a scheduled `supabase projects restore` or a trivial weekly
  keep-alive workflow. Start without the keep-alive; add it only if pausing
  actually bites.
- **Two free projects per org.** Prod is under the Vercel-linked org
  (`vercel_icfg_...`); staging can go under the personal org
  (`iprvijpqgcuavtybptsv`, currently has `portfolio` + `fitness-app` +
  `bookapp2026`). Confirm free-project quota on that org before creating.
- 500 MB DB / 1 GB file storage — ample for test data.

## Testing / verification

Manual, since this is infra:

1. **Staging project stands up from the baseline.** After creating
   `trove-staging` and running the first `supabase db push`, verify with
   `supabase db diff --linked` → "No schema changes found", and spot-check
   table count + RLS policy count against prod (the same checks used for the
   2026-08-28 fresh-clone smoke test: 11 tables, 26 public policies,
   `on_auth_user_created` + `trg_card_count` triggers, `avatars` bucket + 3
   storage policies).
2. **CI job applies a migration to staging.** Open a throwaway PR adding a
   no-op migration (`select 1;`). Confirm `staging-migrations` goes green and
   the migration appears in `supabase migration list --linked` for staging.
   Revert the PR.
3. **Preview deploy hits staging, not prod.** On that same PR's preview URL,
   sign up a new account. Confirm the user appears in `trove-staging`'s
   `auth.users` and **not** in prod. Create a deck; confirm same.
4. **Production is untouched.** After merging anything, confirm the production
   deploy still reads prod (existing prod data visible on the live site) and no
   CI job wrote to prod.
5. **Docs match reality.** A dry read-through of the updated README
   "Environments" section by someone following it cold.

## Rollout order

1. Create `trove-staging`, capture URL + anon + service-role key + DB password.
2. First `supabase db push` to staging from a local checkout; run verification
   step 1.
3. Add the three GitHub Actions secrets.
4. Add the `staging-migrations` job to `ci.yml` (behind the PR; it runs on the
   PR itself, so it's self-testing). Verification step 2.
5. Split the Vercel env vars. Verification step 3.
6. Update `README.md`, `CONTRIBUTING.md`, `.env.example`.
7. Once the job has passed on a real PR, add `staging-migrations` to `main`'s
   branch-protection required checks (via `gh api`, alongside the existing
   `quality` + `migrations`).
8. Verification steps 4–5.

## Open questions for review

- **Personal-org free-project quota** — does `iprvijpqgcuavtybptsv` have room
  for a third free project, or does one of `portfolio` / `fitness-app` (both
  `INACTIVE`) need cleanup first? If no room, staging under the Vercel-linked
  org instead.
- **Marketplace integration clobber** — acceptable to detach the Supabase
  integration's Preview scope if it fights the manual override? (Alternative:
  drop the marketplace integration entirely and manage all env vars by hand —
  more control, loses auto-rotation on prod.)
- **`--include-all` vs default `db push`** — default push errors if staging's
  ledger has entries not in the repo. Since staging is created *from* the repo
  baseline, they should never diverge, but `--include-all` is a safety net.
  Keep it or drop it?
