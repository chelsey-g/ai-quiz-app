---
tags:
  - react
  - data-fetching
  - swr
  - supabase
---

# React Data Fetching

**Related:** [[Async JavaScript]] | [[React Performance]] | [[REST vs GraphQL vs RPC]] | [[Supabase Overview]] | [[Design Patterns & OOP]]

---

## Why Use SWR or react-query?

React **doesn't handle data fetching or data management** natively. You can use `fetch()` directly, but then you have to manually manage:
- Loading states
- Error states
- Caching
- Re-fetching
- Deduplication

Libraries like **SWR** and **react-query** let you treat server data like React state, with less boilerplate.

---

## SWR — Stale While Revalidate

Created by **Vercel**. A data fetching hook that makes it easy to fetch data, keep it fresh, handle caching, revalidation, and error states **automatically**.

**What "stale while revalidate" means:**

| Stage | What happens |
|---|---|
| **Stale** | Show the cached data immediately (no flicker/slow UI) |
| **Revalidate** | Fetch fresh data in the background, then update |

> The user always sees something right away, but SWR ensures it's up to date.

```js
import useSWR from 'swr'

const { data, error, isLoading } = useSWR('/api/goals', fetcher)
```

---

## Service Classes vs Calling fetch Directly in Components

**Problem with fetch in components:** Scatters network logic everywhere, harder to test, no separation of concerns.

**Service class approach:** Keeps all API logic in one place. Components stay focused on UI.

**Benefits:**
- **Composability** — reuse across components
- **Testability** — easy to mock
- **Centralized error handling**
- **Separation of concerns** — UI logic vs network logic

> See [[Design Patterns & OOP]] for separation of concerns & dependency injection.

---

## Supabase Browser vs Server Client

| | Browser Client | Server Client (Service Client) |
|---|---|---|
| **Used in** | Frontend components, client hooks, user-facing pages | API routes, server actions, backend logic |
| **Use for** | User actions, SWR, auth | Admin logic, seeding, API routes |

> See [[Supabase Overview]] for full Supabase breakdown.

---

## mapSupabaseError

A **utility function** that translates Supabase's raw error objects into something useful for your app.

```js
function mapSupabaseError(error) {
  if (error.code === '23505') return 'That email is already in use.'
  return 'Something went wrong. Please try again.'
}
```

**Why use it:**
- Consistency across the app
- User-friendly error messages
- Centralized error handling
- Better debugging
- Improves maintainability

> Used inside **Service classes**. See [[Design Patterns & OOP]].
