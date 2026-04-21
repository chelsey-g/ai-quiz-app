---
tags:
  - supabase
  - database
  - backend
  - firebase
---

# Supabase Overview

**Related:** [[SQL & PostgreSQL]] | [[REST vs GraphQL vs RPC]] | [[React Data Fetching]] | [[Supabase Webhooks]] | [[Cloud & Storage/Cloud & Object Storage]]

---

## What is Supabase?

Supabase is an **open source Firebase alternative** — a collection of open source tools that together form a backend-as-a-service. It uses **SQL (PostgreSQL)** which makes it better for structured, relational data.

> Most people prefer Supabase over Firebase because it uses SQL which is easier for harder data.

---

## What is Firebase?

A **backend-as-a-service made by Google**. Makes it easier so you don't have to build database, auth, file storage, APIs, or hosting from scratch.

Firebase uses **NoSQL document storage**:

```
users
  user123
    name: "Chelsey"
    score: 1200
```

---

## Supabase Open Source Stack

Supabase is a collection of these open source projects:

| Component | What it does |
|---|---|
| **PostgreSQL** | Object-relational database (30+ years, reliable) |
| **Realtime** | Elixir server — listen to Postgres changes via WebSockets |
| **PostgREST** | Turns your PostgreSQL DB directly into a RESTful API |
| **GoTrue** | JWT-based auth API (sign-ups, logins, session management) |
| **Storage** | RESTful API for managing files in S3 |
| **pg_graphql** | PostgreSQL extension exposing a GraphQL API |
| **postgres-meta** | RESTful API for managing Postgres (tables, roles, queries) |
| **Kong** | Cloud-native API gateway |

---

## Supabase API Styles

Supabase supports multiple API patterns:

| Style | Description |
|---|---|
| **REST** | Auto-generated for each table via PostgREST |
| **RPC** | Write a Postgres function → Supabase exposes it as `POST /rest/v1/rpc/my_function` |
| **GraphQL** | Enable `pg_graphql` extension |

> See [[REST vs GraphQL vs RPC]] for full comparison.

---

## Browser vs Server Client

| | Browser Client | Server Client (Service Client) |
|---|---|---|
| **Used in** | Frontend components, client hooks, user-facing pages | API routes, server actions, backend logic |
| **Use for** | User actions, SWR, auth | Admin logic, seeding, API routes |

---

## mapSupabaseError

A utility function that translates Supabase's raw error into something useful for your app.

Used inside **Service classes** for:
- Consistency
- User-friendly messages
- Centralized error handling
- Better debugging

> See: [[React Data Fetching]] for how this fits into the service layer.

---

## Supabase vs Firebase Quick Comparison

| | Supabase | Firebase |
|---|---|---|
| **Database** | PostgreSQL (relational/SQL) | Firestore (NoSQL/document) |
| **Queries** | SQL — powerful joins, views, transactions | Limited querying |
| **Open source** | ✅ Yes | ❌ No (Google proprietary) |
| **Best for** | Structured, relational data | Simple, document-based data |
