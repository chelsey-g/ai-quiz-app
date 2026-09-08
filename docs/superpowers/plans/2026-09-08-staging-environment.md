# Staging Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a persistent non-production Supabase project (`trove-staging`) that all Vercel Preview deployments use, with PR migrations applied to it automatically, so preview deploys stop reading and writing production data.

**Architecture:** A second free-tier Supabase project under the Vercel-linked org, seeded from the existing migration baseline. A new `staging-migrations` CI job runs `supabase db push --linked` against it on every PR to `main`. The four Supabase env vars in Vercel are re-scoped: the marketplace-synced values become Production-only, and Preview-only overrides point at staging. Production deploy flow and manual prod `db push` are unchanged.

**Tech Stack:** Supabase CLI 2.106.0, GitHub Actions (`supabase/setup-cli@v1`), Vercel CLI, `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-09-08-staging-environment-design.md`

## Global Constraints

- Staging Supabase project: free-tier, **org `vercel_icfg_KJMNNSsyrjSebOT2us2jHITA`** ("chelseyg's projects"), new-project cost **$0/month** (confirmed via `get_cost`).
- Postgres **major version 17** — must match prod (`supabase/config.toml` `major_version = 17`).
- Region **us-east-2** — match prod (`wlghyvhrzdhfnkykhcoj` is us-east-2).
- Schema source of truth: `supabase/migrations/20260421120000_baseline_schema.sql` (single consolidated baseline; `_archive/` is not applied).
- Prod project ref: `wlghyvhrzdhfnkykhcoj`. **Never** target it from CI or from any staging step.
- Existing CI job names (branch-protection required checks on `main`): `quality`, `migrations`. New job adds `staging-migrations`.
- Prod migrations stay **manual** (`supabase db push` run by the maintainer). No CI job targets prod.
- Vercel project: `ai-quiz-app`, org "chelseyg's projects". Env vars in play: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (all three re-scoped), `NEXT_PUBLIC_SITE_URL` (already per-env, leave alone).
- `--include-all` flag on `db push` is intentional — keep it.

---

### Task 1: Create `trove-staging` and seed it from the baseline

**Files:**
- None in the repo. This task produces credentials consumed by Tasks 2–4.

**Interfaces:**
- Consumes: nothing.
- Produces (record these somewhere the later tasks can read — a scratch note, not committed):
  - `STAGING_PROJECT_REF` — 20-char project ref string
  - `STAGING_DB_URL` — `https://<ref>.supabase.co`
  - `STAGING_ANON_KEY` — the `anon` / publishable key
  - `STAGING_SERVICE_ROLE_KEY` — the `service_role` / secret key
  - `STAGING_DB_PASSWORD` — the database password chosen at creation

- [ ] **Step 1: Confirm the cost**

Use the Supabase MCP: `get_cost` with `type: "project"`, `organization_id: "vercel_icfg_KJMNNSsyrjSebOT2us2jHITA"`.
Expected: `{"type":"project","recurrence":"monthly","amount":0}`. Then `confirm_cost` with those exact fields to get the `confirm_cost_id`.

- [ ] **Step 2: Create the project**

Use the Supabase MCP `create_project`:
- `name`: `trove-staging`
- `organization_id`: `vercel_icfg_KJMNNSsyrjSebOT2us2jHITA`
- `region`: `us-east-2`
- `confirm_cost_id`: from Step 1
- `db_pass`: generate a strong password; **record it** as `STAGING_DB_PASSWORD`.

Expected: a project object with `id` (the ref) and `status` `COMING_UP` or similar. Poll `get_project` until `status` is `ACTIVE_HEALTHY` (usually 1–2 min).

- [ ] **Step 3: Record the connection details**

- `get_project_url` → `STAGING_DB_URL`
- `get_publishable_keys` (or `get_anon_key`) → `STAGING_ANON_KEY`
- Service-role key: from the Supabase dashboard (Project Settings → API) or `get_publishable_keys` output if it includes it → `STAGING_SERVICE_ROLE_KEY`. **Maintainer step if not exposed via MCP.**
- Confirm `get_project` shows `database.version` starting `17.` — matches prod's Postgres 17.

- [ ] **Step 4: Apply the baseline schema**

From a local checkout on `main` (or this plan's branch — the baseline file is identical):

```bash
cd /Users/chelseygowac/ai-quiz-app
unset NODE_OPTIONS
supabase link --project-ref <STAGING_PROJECT_REF> --password '<STAGING_DB_PASSWORD>'
supabase db push --linked --include-all --password '<STAGING_DB_PASSWORD>'
```

Expected: the single migration `20260421120000_baseline_schema.sql` is listed as applied; no errors. `supabase migration list --linked` shows one row, Local and Remote both timestamped.

- [ ] **Step 5: Verify staging schema matches prod**

```bash
supabase db diff --linked
```

Expected: `No schema changes found` (or empty output).

Then spot-check parity with the 2026-08-28 fresh-clone smoke-test numbers, via MCP `execute_sql` against the staging ref:

```sql
select count(*) from information_schema.tables where table_schema = 'public';                 -- expect 11
select count(*) from pg_policies where schemaname = 'public';                                 -- expect 26
select tgname from pg_trigger where tgname in ('on_auth_user_created','trg_card_count');      -- expect both
select id from storage.buckets where id = 'avatars';                                          -- expect 1 row
select count(*) from pg_policies where schemaname = 'storage';                                -- expect 3
```

Expected: all counts match the comments. If any differ, stop — the baseline did not apply cleanly.

- [ ] **Step 6: Re-link the local checkout to prod**

Leaving the local CLI linked to staging is a foot-gun (a later manual `db push` would hit staging, not prod).

```bash
supabase link --project-ref wlghyvhrzdhfnkykhcoj
```

Expected: `Finished supabase link.` `supabase projects list` shows the linked marker (●) on `ai-quiz-app` / `wlghyvhrzdhfnkykhcoj`.

- [ ] **Step 7: No commit**

This task changes no repo files. Nothing to commit.

---

### Task 2: Generate a Supabase access token and set GitHub Actions secrets

**Files:**
- None in the repo.

**Interfaces:**
- Consumes: `STAGING_PROJECT_REF`, `STAGING_DB_PASSWORD` from Task 1.
- Produces: three repo secrets — `SUPABASE_ACCESS_TOKEN`, `SUPABASE_STAGING_PROJECT_REF`, `SUPABASE_STAGING_DB_PASSWORD` — consumed by Task 3's workflow.

- [ ] **Step 1: Generate a Supabase personal access token**

**Maintainer step.** In the Supabase dashboard → Account → [Access Tokens](https://supabase.com/dashboard/account/tokens) → Generate new token. Name it `trove-ci-staging`. Copy the value (shown once).

Rationale: Supabase personal access tokens are account-scoped, not project-scoped — there is no project-only token. Mitigations: this token is only ever used by the `staging-migrations` job, which only ever runs `db push --linked` against the staging ref; it is never passed the prod ref.

- [ ] **Step 2: Set the three secrets**

```bash
cd /Users/chelseygowac/ai-quiz-app
gh secret set SUPABASE_ACCESS_TOKEN --body '<token from Step 1>'
gh secret set SUPABASE_STAGING_PROJECT_REF --body '<STAGING_PROJECT_REF>'
gh secret set SUPABASE_STAGING_DB_PASSWORD --body '<STAGING_DB_PASSWORD>'
```

- [ ] **Step 3: Verify**

```bash
gh secret list
```

Expected: all three names appear with a recent `Updated` timestamp. (Values are not shown — that's correct.)

- [ ] **Step 4: No commit**

Secrets live in GitHub, not the repo.

---

### Task 3: Add the `staging-migrations` CI job

**Files:**
- Modify: `.github/workflows/ci.yml` (add a third job after `migrations`, ends at line 72)
- Test: the job tests itself — it runs on the PR that adds it.

**Interfaces:**
- Consumes: secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_STAGING_PROJECT_REF`, `SUPABASE_STAGING_DB_PASSWORD` from Task 2.
- Produces: a CI check named `staging-migrations`, added to `main` branch protection in Task 6.

- [ ] **Step 1: Add the job**

Append to `.github/workflows/ci.yml`, after the `migrations` job (keep two-space indent, blank line before it):

```yaml
  staging-migrations:
    name: staging-migrations
    # Applies any migrations in this PR to the persistent staging Supabase
    # project, so the Preview deploy exercises the change against staging —
    # never production. Prod migrations are still applied manually.
    runs-on: ubuntu-latest
    # Fork PRs cannot read secrets; skip cleanly there rather than fail red.
    if: github.event.pull_request.head.repo.full_name == github.repository
    steps:
      - uses: actions/checkout@v4

      - uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Push migrations to staging
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        run: |
          supabase link --project-ref "${{ secrets.SUPABASE_STAGING_PROJECT_REF }}" \
            --password "${{ secrets.SUPABASE_STAGING_DB_PASSWORD }}"
          supabase db push --linked --include-all \
            --password "${{ secrets.SUPABASE_STAGING_DB_PASSWORD }}"
```

- [ ] **Step 2: Lint the workflow locally**

```bash
cd /Users/chelseygowac/ai-quiz-app
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')"
```

Expected: `YAML OK`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add staging-migrations job — push PR migrations to trove-staging

Runs on PRs to main only (not push). Applies migration files to the
persistent staging Supabase project so Preview deploys test against
staging, not prod. Skips on fork PRs (no secret access). Prod migrations
remain a manual supabase db push."
```

- [ ] **Step 4: Push the branch and open the PR (if not already open)**

```bash
git push -u origin chore/staging-environment
gh pr create --base main --title "Staging environment: trove-staging + Preview wiring" \
  --body "Implements docs/superpowers/specs/2026-09-08-staging-environment-design.md. See docs/superpowers/plans/2026-09-08-staging-environment.md."
```

- [ ] **Step 5: Verify the job runs green on this PR**

```bash
gh pr checks --watch
```

Expected: `staging-migrations` → `pass`. (It will run `db push` against staging; since staging already has the baseline from Task 1 and this PR adds no new migration files, the push is a no-op and exits 0.)

If it fails: read `gh run view --log-failed`. Common causes — wrong secret value, staging project paused (run `supabase projects` or MCP `get_project`; `restore` if paused).

---

### Task 4: Re-scope the Vercel Supabase env vars

**Files:**
- None in the repo. Vercel-side configuration only.

**Interfaces:**
- Consumes: `STAGING_DB_URL`, `STAGING_ANON_KEY`, `STAGING_SERVICE_ROLE_KEY` from Task 1.
- Produces: Preview deploys that read staging; Production deploys unchanged.

- [ ] **Step 1: Snapshot current env state**

```bash
cd /Users/chelseygowac/ai-quiz-app
vercel env ls
```

Record which of `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are currently scoped `Preview, Production`. Expected: all three are.

- [ ] **Step 2: Remove the Preview scope from the three prod-valued vars**

```bash
vercel env rm NEXT_PUBLIC_SUPABASE_URL preview --yes
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY preview --yes
vercel env rm SUPABASE_SERVICE_ROLE_KEY preview --yes
```

Note: `vercel env rm <name> <target>` removes only that target's binding when the var exists in multiple environments. Verify with `vercel env ls` that each still shows `Production`.

- [ ] **Step 3: Add Preview-scoped staging values**

```bash
printf '%s' '<STAGING_DB_URL>'          | vercel env add NEXT_PUBLIC_SUPABASE_URL preview
printf '%s' '<STAGING_ANON_KEY>'        | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview
printf '%s' '<STAGING_SERVICE_ROLE_KEY>'| vercel env add SUPABASE_SERVICE_ROLE_KEY preview
```

- [ ] **Step 4: Verify the split**

```bash
vercel env ls
```

Expected: each of the three vars now appears as two rows — one `Production`, one `Preview` — or one row listing both environments with distinct values. Pull each to confirm the value:

```bash
vercel env pull /tmp/staging-check.env --environment=preview
grep -E 'SUPABASE_URL|ANON_KEY|SERVICE_ROLE' /tmp/staging-check.env
rm /tmp/staging-check.env
```

Expected: the Preview values are the `trove-staging` URL/keys, NOT `wlghyvhrzdhfnkykhcoj`.

- [ ] **Step 5: Watch for marketplace-integration clobber**

Wait for / trigger the next Preview deploy (Task 5's redeploy covers this). Then re-run `vercel env ls`. If the Supabase↔Vercel integration has re-added Preview-scoped **prod** values:

- Supabase dashboard → the `ai-quiz-app` project → Integrations → Vercel → configure → disable the **Preview** environment sync (leave Production on).
- Re-apply Step 3.

Document the outcome in the PR description.

- [ ] **Step 6: No commit**

---

### Task 5: Redeploy Preview and verify isolation

**Files:**
- None.

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: proof that Preview uses staging and Production still uses prod.

- [ ] **Step 1: Trigger a fresh Preview deploy**

Push an empty commit to the PR branch (env-var changes don't take effect on already-built deploys):

```bash
git commit --allow-empty -m "chore: redeploy preview against staging DB"
git push
```

- [ ] **Step 2: Verify Preview writes to staging, not prod**

On the PR's Vercel Preview URL: sign up a brand-new test account (e.g. `staging-check@example.com`).

Then via MCP `execute_sql`:

```sql
-- against STAGING ref: expect the new user
select email from auth.users order by created_at desc limit 3;
-- against PROD ref (wlghyvhrzdhfnkykhcoj): expect the test email absent
select count(*) from auth.users where email = 'staging-check@example.com';
```

Expected: staging has the user; prod returns `0`.

- [ ] **Step 3: Verify Production is untouched**

Load the live production site. Confirm existing decks/data still render (Production env vars unchanged). Confirm no CI run in this work targeted `wlghyvhrzdhfnkykhcoj` (`gh run list` → inspect logs of `staging-migrations` runs → they reference the staging ref only).

- [ ] **Step 4: Clean up the test account**

Via MCP `execute_sql` against staging, or the staging dashboard Auth panel:

```sql
delete from auth.users where email = 'staging-check@example.com';
```

- [ ] **Step 5: No commit**

---

### Task 6: Document the environments and add the required check

**Files:**
- Modify: `README.md` — rewrite the "Database" section intro + add an "Environments" section
- Modify: `CONTRIBUTING.md` — "Database changes" section, note the staging auto-apply
- Modify: `.env.example` — comment clarifying prod vs staging for the Supabase vars
- None: branch-protection update is a `gh api` call

**Interfaces:**
- Consumes: the working setup from Tasks 1–5.
- Produces: the finished, documented feature.

- [ ] **Step 1: Add an "Environments" section to `README.md`**

Insert after the existing "Database" section (which ends just before "## Scripts"):

```markdown
## Environments

| Environment | Runs on | Database |
|---|---|---|
| Local dev | `npm run dev` | your own Supabase project, or the local stack (`npx supabase start`) |
| Preview | every PR to `main` (Vercel) | `trove-staging` — a persistent non-prod Supabase project, no real user data |
| Production | `main` after merge (Vercel) | the production Supabase project |

**Migrations.** On every PR, CI's `staging-migrations` job runs
`supabase db push` against `trove-staging`, so the Preview deploy exercises
your schema change before review. Production migrations are applied
**manually** by a maintainer running `supabase db push` after merge — CI
never writes the production schema.

There is no data sync from production. `trove-staging` starts empty; sign up
test accounts and generate test decks against it.
```

- [ ] **Step 2: Update the `README.md` "Database" section intro**

Find the line under `## Database` that begins "Schema lives in `supabase/migrations/`" and append one sentence:

```markdown
See [Environments](#environments) for how the schema reaches staging (automatic, per-PR) versus production (manual).
```

- [ ] **Step 3: Update `CONTRIBUTING.md`**

In the "Database changes" section, after the "Apply locally / to your own project with `npx supabase db push`" bullet, add:

```markdown
- When your PR opens, CI applies the migration to the shared **staging**
  database automatically (`staging-migrations` job) and the Vercel Preview
  deploy runs against it. If that job is red, your migration failed to apply
  — fix it before requesting review.
```

- [ ] **Step 4: Update `.env.example`**

Above the `NEXT_PUBLIC_SUPABASE_URL=` line, add a comment:

```
# These point at your own dev project (or the local stack) for local work.
# In deployed environments: Preview uses the trove-staging project,
# Production uses the production project. See README "Environments".
```

- [ ] **Step 5: Commit the docs**

```bash
git add README.md CONTRIBUTING.md .env.example
git commit -m "docs: describe the local/preview/production environments

Preview deploys now run against a dedicated staging Supabase project with
migrations auto-applied per PR; production migrations stay manual."
```

- [ ] **Step 6: Merge the PR**

**Maintainer step.** Once `quality`, `migrations`, and `staging-migrations` are green:

```bash
gh pr merge --squash --delete-branch
```

- [ ] **Step 7: Add `staging-migrations` to `main` branch protection**

After the job has passed on the merged PR, re-PUT the protection config (a partial body replaces, so send the full set — the existing config plus the new check):

```bash
gh api --method PUT repos/chelsey-g/ai-quiz-app/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  --input - <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["quality", "migrations", "staging-migrations"] },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
```

- [ ] **Step 8: Verify**

```bash
gh api repos/chelsey-g/ai-quiz-app/branches/main/protection \
  -q '.required_status_checks.checks[].context'
```

Expected: `quality`, `migrations`, `staging-migrations`.

---

## Self-Review

**1. Spec coverage**

| Spec element | Task |
|---|---|
| Create `trove-staging` (free, Vercel-linked org, PG17, us-east-2) | Task 1 §1–3 |
| Seed staging from baseline + verify parity | Task 1 §4–5 |
| GH Actions secrets (access token, ref, db password) | Task 2 |
| `staging-migrations` CI job, PR-only, fork-safe, `--include-all` | Task 3 |
| Vercel env split (prod → Production-only, staging → Preview-only) | Task 4 |
| Marketplace-clobber contingency | Task 4 §5 |
| Verify Preview→staging, Production→prod, prod untouched | Task 5 |
| README "Environments", CONTRIBUTING, `.env.example` | Task 6 §1–5 |
| Add `staging-migrations` to branch protection | Task 6 §7 |
| Re-link local CLI to prod (foot-gun guard) | Task 1 §6 |
| Prod migrations stay manual | enforced by omission; stated in Global Constraints + Task 3 comment + README |

No gaps.

**2. Placeholder scan**

`<STAGING_PROJECT_REF>` etc. are runtime values produced by Task 1 and explicitly listed in its Interfaces block — not placeholders in the plan-failure sense (the plan says exactly where each comes from). No TBD/TODO/"handle errors"/"similar to Task N".

**3. Type consistency**

Secret names identical across Task 2 (set), Task 3 (consume): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_STAGING_PROJECT_REF`, `SUPABASE_STAGING_DB_PASSWORD`. Job name `staging-migrations` identical in Task 3 (define), Task 6 §7 (branch protection). Credential var names (`STAGING_DB_URL`, `STAGING_ANON_KEY`, `STAGING_SERVICE_ROLE_KEY`) identical in Task 1 (produce) and Task 4 (consume).
