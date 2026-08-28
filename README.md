# Quizly

An AI-powered study platform. Enter a topic or import your own notes to generate
flashcards and quizzes, study them with SM-2 spaced repetition, and share decks
publicly for others to fork. Includes quiz modes with AI grading and wrong-answer
explanations, coding-kata practice with in-browser execution, user-vs-user
challenges, streaks, and study stats.

> Status: solo project, being prepared for open source. Expect rough edges.

## Features

- **Card generation** — from a topic, pasted notes, or an imported `.md` file (Vercel AI Gateway + `generateObject`)
- **Flashcard study** — SM-2 spaced repetition scheduling
- **Quiz mode** — multiple-choice and typed answers, AI grading, AI wrong-answer explanations; quick multi-deck quizzes
- **Community** — public decks and collections with forking; public user profiles
- **Coding kata** — CodeMirror editor, tests run in a Vercel Sandbox
- **Challenges** — send quizzes to other users, in-app notifications
- **Stats & streaks** — accuracy weighted by card count, study streaks

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), Tailwind v4, shadcn/ui |
| Database | Supabase (Postgres + Auth), RLS on all tables |
| AI | Vercel AI SDK v6 via AI Gateway (`@ai-sdk/gateway`) |
| Code execution | Vercel Sandbox (kata test runs) |
| Hosting | Vercel |

## Prerequisites

- **Node.js 24+** and npm 11+
- **Supabase CLI** — `npm i -g supabase` (or run via `npx supabase`)
- A **Supabase project** (free tier is fine) — or run the local stack (needs Docker)
- A **Vercel account** for the AI Gateway API key; also for kata code execution (Vercel Sandbox)

## Setup

```bash
# 1. Clone and install
git clone https://github.com/chelsey-g/ai-quiz-app.git
cd ai-quiz-app
npm install

# 2. Configure environment
cp .env.example .env.local
#   then fill in the values — see comments in .env.example for where each comes from

# 3. Set up the database (see "Database" below)

# 4. Run
npm run dev            # http://localhost:3001
```

## Database

Schema lives in `supabase/migrations/` and is the single source of truth. Two ways
to stand it up:

**Against your own hosted Supabase project:**

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push        # applies all migrations
```

**Local stack (requires Docker):**

```bash
npx supabase start          # spins up Postgres + Auth + Studio, applies migrations
npx supabase stop
```

After **changing** the schema, regenerate the typed client:

```bash
npx supabase gen types typescript --linked > src/lib/database.types.ts   # hosted
# or: npx supabase gen types typescript --local > src/lib/database.types.ts
```

Never edit the database by hand — every change goes through a new migration file.
See [CONTRIBUTING.md](./CONTRIBUTING.md#database-changes).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server on port 3001 |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the unit tests (Vitest) |
| `npm run test:watch` | Vitest in watch mode |

## Project layout

`src/app/` mirrors the route map (dashboard, import, notes, decks, quiz, kata,
community, challenges, stats, settings, `api/` route handlers). `src/lib/` holds
the AI pipeline (`ai/`), spaced-repetition and streak logic, services, and the
Supabase client helpers (`supabase/client.ts` browser, `supabase/server.ts`
user-scoped, `supabase/admin.ts` service-role/server-only). See
[AGENTS.md](./AGENTS.md) and `CLAUDE.md` for deeper notes.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). This project follows forward-only
migrations, PRs into `main` with passing CI, and the code style already in the repo.

## License

[MIT](./LICENSE) © 2026 Chelsey Gowac
