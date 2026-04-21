---
tags:
  - api
  - rest
  - graphql
  - rpc
  - trpc
---

# REST vs GraphQL vs RPC

**Related:** [[HTTP & Networking]] | [[Supabase Overview]] | [[APIs & Backend/Express & Node.js]] | [[Async JavaScript]]

---

## REST — Representational State Transfer

- Uses **multiple endpoints** — server defines what data you get
- **Resource-based** — URLs represent nouns, not actions
- Uses HTTP Verbs (`GET`, `POST`, `PUT`, `DELETE`)
- **Cacheable**, simple and stable
- Best for: **small APIs, public APIs**

```
GET    /goals
POST   /goals
GET    /goals/123
DELETE /goals/123
```

---

## GraphQL

- Uses a **single endpoint** — client specifies exactly what data it needs
- Solves the **overfetching problem** (getting more data than you need)
- Query-based — client asks for exactly what fields it needs
- **Only makes POST requests** to one endpoint
- Best for: **complex frontends, nested/flexible data**

---

## tRPC

**tRPC** is a TypeScript framework that lets your frontend call backend functions **directly** with automatic type safety — removing the need for manually defined REST or GraphQL APIs.

- End-to-end type safety
- Minimal boilerplate
- Best for: **full-stack TypeScript apps where you control both frontend and backend**

---

## RPC — Remote Procedure Call

**Calling a function on the server as if it were a local function.** Action-based, not resource-based.

In **Supabase**, you write a Postgres function and Supabase exposes it as an API endpoint:

```
POST /rest/v1/rpc/my_custom_function
```

### Use RPC When:
- You need **complex logic** better done in SQL/PLpgSQL
- You want to avoid multiple round trips
- You want **better performance** (logic runs on DB server)
- You want granular control over logic
- You want "action-based" endpoints

**Examples:**
- "Mark all expired goals as complete"
- "Calculate streaks for this user"
- Multi-table joins with custom behavior
- Custom validations
- Aggregations and analytics

---

## Quick Decision Guide

| Use | When |
|---|---|
| **REST** | Simple, widely supported APIs (especially public ones) |
| **GraphQL** | Clients need flexible queries for complex/nested data |
| **tRPC** | Full-stack TypeScript app, you control both ends |
| **RPC** | Complex SQL logic, performance-critical operations |

---

## Summary

```
REST:     great for simple CRUD
RPC:      great for custom logic
GraphQL:  great for apps with flexible UI data needs
```

> See: [[Supabase Overview]] for how Supabase implements REST, RPC, and optional GraphQL.
