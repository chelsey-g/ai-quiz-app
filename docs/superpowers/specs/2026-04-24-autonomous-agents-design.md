# Autonomous Agent Pipeline — Design Spec

**Date:** 2026-04-24
**Status:** Approved

## Overview

Four Claude Code project agents form a self-contained development pipeline for the Trove app. The user kicks off the Product Manager with loose direction; it decides what to build, notifies the user, then hands off automatically through Architect → Engineer/UI Designer. No further user involvement is needed after the initial kick-off.

```
User kicks off Product Manager with loose direction (e.g. "focus on engagement")
    │
    ▼
Product Manager
  reads project state → picks one feature idea → sends push notification
    │
    ▼
Architect
  brainstorms → writes spec → writes plan → tags assigned-to
    │                    │
    ▼                    ▼
Engineer            UI Designer
executes plan       executes plan
commits code        commits UI code
```

## Agents

### Product Manager
**File:** `.claude/agents/product-manager.md`
**Role:** Feature ideation and pipeline entry point.

Takes loose direction from the user (a theme, focus area, or constraint), reads the current project state (CLAUDE.md, existing specs/plans, recent git commits), and picks the single highest-value feature to build next. Sends a push notification to the user with the idea, then spawns the Architect automatically.

### Architect
**File:** `.claude/agents/architect.md`
**Role:** Product design and planning.

Receives a feature description, reads the codebase for context, runs through the brainstorming → writing-plans workflow, and produces:
- A spec in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- An implementation plan in `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`

After writing the plan, it tags it with YAML frontmatter and immediately spawns the appropriate implementation agent(s).

### Engineer
**File:** `.claude/agents/engineer.md`
**Role:** Backend, API, database, and full-stack implementation.

Receives a plan path, reads the plan, executes each task in order using the executing-plans workflow. Commits code at each checkpoint, runs TypeScript checks, and requests a code review when the full plan is complete.

Owns: API routes, Supabase queries, AI pipeline, auth, data processing, server components.

### UI Designer
**File:** `.claude/agents/ui-designer.md`
**Role:** Frontend and visual implementation.

Same execution loop as Engineer but uses the frontend-design skill. Understands Trove's design language (dark theme, amber primary, Syne headings, Tailwind v4, ShadCN). Starts the dev server and visually verifies before committing.

Owns: React components, pages, layouts, CSS, animations, ShadCN usage, responsive design.

## Handoff Mechanism

The Architect adds a small frontmatter block to every plan it writes:

```yaml
---
assigned-to: engineer | ui-designer | both
status: ready
context: "Brief note for the implementing agent — what to watch out for, key decisions already made"
---
```

When the plan is written and frontmatter is set, the Architect spawns the implementing agent(s) as subagents, passing the plan path and context note as the prompt. If `assigned-to: both`, Engineer and UI Designer are spawned in parallel.

## Status Tracking

Plans move through three statuses:
- `ready` — written by Architect, not yet started
- `in-progress` — implementing agent has picked it up
- `complete` — all tasks done, code committed

The status is updated in the plan frontmatter by the implementing agent. You can check what's in flight at any time by scanning `docs/superpowers/plans/`.

## Schedule Integration

All three agents are registered as named remote routines via the `schedule` skill. This allows them to be triggered from anywhere — not just from within an active Claude Code session — and run in the background.

Example invocations:
- `"Run architect: add a streak counter to the dashboard"` — kicks off the full pipeline
- `"Run engineer on docs/superpowers/plans/2026-04-24-streak-counter.md"` — drops straight into implementation

A push notification is sent when each agent completes.

## Assignment Logic

The Architect uses these rules to decide assignment:

| Work type | Assigned to |
|---|---|
| React components, pages, layouts, Tailwind, ShadCN | `ui-designer` |
| API routes, Supabase, auth, AI pipeline, data | `engineer` |
| Feature that touches both (e.g. new page + API route) | `both` |

## File Layout

```
.claude/
  agents/
    product-manager.md  # Feature ideation + pipeline entry point
    architect.md        # Design + planning agent
    engineer.md         # Backend/logic implementation agent
    ui-designer.md      # Frontend/UI implementation agent

docs/superpowers/
  specs/              # Design specs (written by Architect)
  plans/              # Implementation plans (written by Architect, executed by Engineer/UI Designer)
```
