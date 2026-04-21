---
tags:
  - backend
  - nodejs
  - express
  - serverless
---

# Express & Node.js

**Related:** [[REST vs GraphQL vs RPC]] | [[SQL & PostgreSQL]] | [[Supabase Overview]] | [[DevOps & Testing/GitHub Actions & CI-CD]] | [[JavaScript Fundamentals]]

---

## What is Express.js?

Express is a **minimal, flexible web framework for Node.js**. Great if you're learning backend fundamentals and your app is small to medium.

> Node by itself *can* run servers using the built-in `http` module, but doing everything manually is painful. Express simplifies this.

**Express is basically three things:**

1. **Server** — a Node process listening for incoming requests
2. **Routes (API endpoints)** — defines what happens when someone hits a URL
3. **Middleware** — code that runs between the request and the response (auth, logging, validation, error handling)

---

## Express Architecture

```
Frontend
  ↓
HTTP request
  ↓
Express (routes + middleware + logic)
  ↓
PostgreSQL (or Supabase)
  ↓
JSON response
  ↓
Frontend
```

**Mental model:**

```
Customer (Frontend)
  ↓
Waiter (Express)
  ↓
Kitchen (PostgreSQL)
  ↓
Waiter returns food
  ↓
Customer receives result
```

---

## Node.js Backend Frameworks Comparison

| Framework | Best For | Notes |
|---|---|---|
| **Express** | Learning backend, small-medium apps | Simple, flexible, huge ecosystem |
| **Fastify** | Performance-focused APIs | 2x faster than Express, modern plugin architecture |
| **NestJS** | Larger apps, team projects | Strong structure, uses Express or Fastify under the hood |
| **Koa** | Minimal Express alternative | Created by the Express team |

**Decision guide:**
- Learning backend fundamentals → **Express**
- Modern lightweight API → **Fastify**
- Strong structure for bigger app/team → **NestJS**

---

## Serverless Functions

A **backend function that runs when someone makes a request** — without you managing a server.

| Traditional Backend | Serverless |
|---|---|
| Server stays running | Function wakes up when called |
| You pay for uptime | You pay for execution time |
| You manage the server | Provider manages everything |

> "It's 'serverless' for you — but obviously servers exist somewhere. You just don't manage them."

---

## Shells & Variables (CLI Basics)

**Shell** — a CLI that lets you interact with the OS. Takes commands, interprets them, tells the OS what to do.

Examples: `bash`, `zsh`, `sh`

**Variables** — in shells, variables store data you can reuse.

```bash
MY_VAR="hello"
echo $MY_VAR
```

---

## What is a Worktree?

A **worktree** is multiple working folders tied to the same git repo. Lets you check out multiple branches simultaneously without switching.

> See: [[DevOps & Testing/GitHub Actions & CI-CD]]
