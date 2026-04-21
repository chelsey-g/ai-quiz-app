---
tags:
  - ai
  - ide
  - claude
  - workflow
---

# AI Workflow & IDE

**Related:** [[DevOps & Testing/Development Workflow]] | [[DevOps & Testing/GitHub Actions & CI-CD]]

---

## What is an IDE?

**IDE (Integrated Development Environment)** — think of it like a workbench.

- Write code, run it, debug, manage folders/files/dependencies
- Common examples: **VSCode**, Xcode, Android Studio
- Features: autocomplete, syntax highlighting, error squiggles, debugging tools

**AI in modern IDEs:**
- **AI in IDEs** — write better code faster
- **AI agents** — perform tasks, manage workflows, free up time
- **AI general models** — research, creativity, decision support

---

## Claude Code

**ClaudeCode** — build, debug, and ship right from your terminal.

### Claude Code Model Tiers

| Model | Used For |
|---|---|
| Haiku | Fast, cheap — simple searches |
| Sonnet | Standard coding tasks |
| Opus | Complex multi-file changes |

**Context gathering:** Scans repo structure, identifies key files.

---

## How to Talk to AI for Better Output

### Be Specific

| ❌ Bad | ✅ Good |
|---|---|
| "Build an auth system" | "Email/password auth using existing User model, Redis sessions, middleware for /api/protected" |

### Say What NOT to Do

- Models (especially Claude) love to overengineer
- If you want simple: say so — "minimal files, no abstractions, keep it lean"

### Always Review Output

- AI will introduce technical debt if you let it
- **You are still the adult in the room**

---

## Context Changes Everything

Explain **why**:
- "Runs on every request" → prioritize performance
- "Prototype we'll throw away" → speed > perfection

> AI can't infer constraints you don't state.

---

## How to Get Better Results

| Principle | Application |
|---|---|
| **Specific > vague** | Detailed prompts produce better outputs |
| **Constraints > open-ended** | Tell it limitations upfront |
| **Examples > descriptions** | Show it what you want |
| **Break complex tasks into steps** | Agree on architecture before coding |
| **State assumptions explicitly** | Don't expect mind-reading |

---

## LLM Coding Workflow

1. Write a spec doc first
2. Break into small tasks
3. Feed one task at a time
4. Review, test, iterate
5. Commit often
6. Review carefully before merging
