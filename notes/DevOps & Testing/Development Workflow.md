---
tags:
  - workflow
  - devops
  - best-practices
---

# Development Workflow

**Related:** [[GitHub Actions & CI-CD]] | [[AI & IDE/AI Workflow & IDE]] | [[Testing]]

---

## The Proper Workflow: Local → Staging → Production

The problem with developing directly in production: every change immediately affects **real users, real data, and operations**. A small mistake can cause downtime, data loss, or security vulnerabilities.

### The Three Environments

| Environment | Purpose |
|---|---|
| **Local** | Where you experiment, break things and fix them. Uses separate database with fake/test data. No one is affected by your mistakes. |
| **Staging** *(optional, recommended)* | Near-exact copy of production. Used for final testing. Catches issues that only appear in prod-like conditions. |
| **Production** | The live system real users interact with. Only receives tested, reviewed, approved code. Changes deployed through automated processes. |

---

## Core Workflow Principles (AI-Assisted Development)

### 1. Plan Before You Code
Don't start with "write this app!" Instead, create a **spec doc** with:
- Requirements
- Architecture decisions
- Data models
- Test strategy

### 2. Break Tasks into Smaller Chunks
- Scope is so important
- Feed small, manageable tasks
- Code in iterations: one step → test → next step
- Keeps AI from "hallucinating huge code dumps"

### 3. Provide Good Context
- Include relevant files and docs
- Explicitly tell it what **NOT** to touch or avoid

### 4. Choose the Right Model
- Try multiple models when needed

### 5. Stay in the Loop
- **Read** the output
- **Run** it
- **Test** it

### 6. Git Habits Are Very Important
- Commit often with meaningful messages
- Use commits as checkpoints
- Helps you review and restore confidently

---

## "Post Mortem"

A structured breakdown of what went wrong, why it happened, and how to prevent it.

---

## Shells & Variables

**Shell** — a CLI that lets you interact with the OS. (bash, zsh, sh)

**Variables** — in shells, variables store data you can reuse.

```bash
MY_VAR="hello"
echo $MY_VAR
```
