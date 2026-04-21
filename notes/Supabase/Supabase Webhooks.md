---
tags:
  - supabase
  - webhooks
  - database
---

# Supabase Webhooks

**Related:** [[Supabase Overview]] | [[REST vs GraphQL vs RPC]] | [[APIs & Backend/Express & Node.js]]

---

## What is a Database Webhook?

When something **changes in your database**, it automatically sends a message (HTTP request) somewhere else.

---

## What Triggers a Webhook in Supabase?

Webhooks fire on **database events**:

| Event | Trigger |
|---|---|
| `INSERT` | New row created |
| `UPDATE` | Row changed |
| `DELETE` | Row removed |

You can attach them to any table — `users`, `books`, `goals`, etc.

---

## Agent Pipeline Mental Model

```
Database       → event source
Webhook        → messenger
Your API       → brain
AI             → decision maker
Tools (email)  → actions
```

> That's literally an agent pipeline.

---

## Use Cases

- Send a welcome email when a new user signs up (`INSERT` on `users`)
- Trigger a notification when a goal is completed (`UPDATE` on `goals`)
- Sync data to another service when a record changes
- Kick off an AI workflow when new content is added

---

## How Webhooks Fit in the Stack

```
Database change (INSERT/UPDATE/DELETE)
  ↓
Supabase fires webhook (HTTP POST)
  ↓
Your API endpoint receives it
  ↓
Runs business logic (send email, trigger AI, update cache)
```

> See [[REST vs GraphQL vs RPC]] for how Supabase exposes RPC-style APIs alongside webhooks.
