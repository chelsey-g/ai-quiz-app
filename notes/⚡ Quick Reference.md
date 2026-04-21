---
tags:
  - reference
  - cheatsheet
  - interview
---

# ⚡ Quick Reference — Interview Cheat Sheet

> One-liner answers for rapid review. Click any `[[link]]` to go deep on any topic.

---

## 🟡 JavaScript

| Question | Answer |
|---|---|
| What is the DOM? | Programming interface representing the page as a JS object — lets you manipulate structure, style, content |
| DOM vs BOM? | DOM = page content. BOM = browser environment (window, location, history) |
| What is a Promise? | An object (IOU) for a value that may be available now, later, or never — resolves or rejects |
| Why is JS single-threaded? | Runs one task at a time; offloads async work to browser Web APIs via the event loop |
| What does `fetch()` do? | Built-in JS method for HTTP requests — returns a Promise |
| `+` with a string? | Type coercion — string wins, becomes concatenation |
| What is hoisting? | JS moves declarations to top of scope before executing. Values are NOT hoisted |
| `var` vs `let` vs `const`? | var = function-scoped, hoisted as undefined. let/const = block-scoped, TDZ until declared |
| Factory pattern? | Centralizes object creation — encapsulation, flexibility, consistency |
| Dependency injection? | Pass dependencies in instead of creating them inside — decouples, easier to test |
| Singleton? | Ensures only one instance of a class exists across the entire app |

→ Deep dive: [[JavaScript/JavaScript Fundamentals]] | [[JavaScript/Async JavaScript]] | [[JavaScript/Design Patterns & OOP]]

---

## ⚛️ React

| Question | Answer |
|---|---|
| Lift state vs prop drilling? | Lift when multiple components share data. Prop drill for 1–2 levels. Library for 3+ |
| Context API downside? | Re-renders every component subscribed to it every time the value changes |
| Redux vs Zustand? | Redux = large apps, more setup. Zustand = small/medium, simple functions |
| React.memo? | Prevents re-render unless props change |
| useCallback? | Saves function reference so it doesn't recreate every render |
| useMemo? | Saves result of a calculation so it doesn't re-run every render |
| Why use SWR? | Handles caching, re-fetching, error states automatically. React doesn't do this natively |
| SWR stands for? | Stale While Revalidate — show cached data immediately, refresh in background |
| shadCN vs MUI? | shadCN = you own the code, no package. MUI = plug-and-play, predefined styles |
| Service class benefit? | Centralizes API logic, improves testability and separation of concerns |

→ Deep dive: [[React/React State Management]] | [[React/React Performance]] | [[React/React Data Fetching]]

---

## 🌐 Web Fundamentals

| Question | Answer |
|---|---|
| HTTP vs HTTPS? | HTTP = communication protocol. HTTPS = HTTP + SSL/TLS encryption |
| What is CORS? | Cross-Origin Resource Sharing — prevents bad sites from secretly hitting other sites' APIs |
| What is DNS? | Translates domain names into IP addresses |
| What is a MIME type? | Standardized label for content formats (e.g. `application/json`, `text/html`) |
| Gzip vs ZIP? | Gzip = compress one file for faster web transfer. ZIP = compress + bundle files |
| Internet vs WWW? | Internet = the network infrastructure. WWW = webpages accessed via HTTP on top of it |
| Who invented the WWW? | Tim Berners-Lee, 1989, at CERN |

→ Deep dive: [[Web Fundamentals/HTTP & Networking]] | [[Web Fundamentals/HTML Basics]]

---

## 🗄️ Databases

| Question | Answer |
|---|---|
| What is SQL? | Structured Query Language — how you communicate with relational databases |
| WHERE vs HAVING? | WHERE filters rows before grouping. HAVING filters groups after GROUP BY |
| What is indexing? | Separate data structure storing sorted column copies + row pointers — speeds up reads |
| When to index? | Columns used in WHERE, ORDER BY, or JOIN — and always index foreign keys |
| Primary key vs foreign key? | Primary key = unique row ID. Foreign key = links to another table's primary key |
| What is a View? | Saved query that behaves like a table — simplifies complex queries |
| JSONB? | PostgreSQL's way to store flexible JSON data inside structured tables |

→ Deep dive: [[Databases/SQL & PostgreSQL]] | [[Databases/Indexing & Performance]]

---

## 🔌 APIs

| Question | Answer |
|---|---|
| REST vs GraphQL? | REST = multiple endpoints, server defines data. GraphQL = one endpoint, client picks fields |
| When to use tRPC? | Full-stack TypeScript app where you control both frontend and backend |
| What is RPC? | Calling a server function as if it were local — action-based, not resource-based |
| REST vs RPC? | REST = nouns/resources. RPC = verbs/actions |

→ Deep dive: [[APIs & Backend/REST vs GraphQL vs RPC]]

---

## 🟢 Supabase

| Question | Answer |
|---|---|
| What is Supabase? | Open-source Firebase alternative built on PostgreSQL |
| Supabase vs Firebase? | Supabase = SQL/relational. Firebase = NoSQL/document |
| What is PostgREST? | Turns PostgreSQL directly into a RESTful API |
| What is GoTrue? | JWT-based auth API in the Supabase stack |
| Browser vs server client? | Browser = frontend components. Server = API routes, admin logic |
| What is a webhook? | HTTP request auto-sent when a DB row is inserted/updated/deleted |
| mapSupabaseError? | Utility that translates raw Supabase errors into user-friendly app messages |

→ Deep dive: [[Supabase/Supabase Overview]] | [[Supabase/Supabase Webhooks]]

---

## ☁️ Cloud & Storage

| Question | Answer |
|---|---|
| Why cloud storage? | Durability, scalability, CDN, cost efficiency — offloads file serving from your app server |
| Object vs database storage? | Object storage holds the file. Database holds the metadata and the object key |
| What is a signed URL? | Temporary permission slip — anyone with this URL can do this one action on this one object |
| What is Redis? | In-memory database — extremely fast. Used for caching, sessions, queues, pub/sub |
| What is BullMQ? | Node.js job queue system built on Redis for managing background tasks |

→ Deep dive: [[Cloud & Storage/Cloud & Object Storage]] | [[Cloud & Storage/Redis & BullMQ]]

---

## 🎬 Video

| Question | Answer |
|---|---|
| What is transcoding? | Converting video from one format into multiple other formats/resolutions |
| What is HLS? | HTTP Live Streaming — streams video in small chunks instead of one giant file |
| What is ABR? | Adaptive Bitrate Streaming — player switches quality based on available bandwidth |
| What is FFmpeg? | Open-source CLI tool for converting, compressing, resizing video |
| Minimum renditions? | Include 360p — skip it and slow users will buffer |

→ Deep dive: [[Video Engineering/Transcoding & HLS]] | [[Video Engineering/FFmpeg & Adaptive Streaming]]

---

## 🚀 DevOps & Testing

| Question | Answer |
|---|---|
| CI vs CD? | CI = auto-test on every commit. CD = auto-deploy after tests pass |
| Vitest vs Jest? | Same job. Vitest = modern (Vite-based). Jest = older codebases |
| RTL purpose? | Test React component behavior from the user's perspective — not implementation details |
| Cypress? | E2E browser testing — full workflow tests in a real browser |
| Why mock in tests? | Isolate your code — test your logic, not external services |
| Three environments? | Local (dev/test), Staging (prod-like testing), Production (live users) |

→ Deep dive: [[DevOps & Testing/Testing]] | [[DevOps & Testing/GitHub Actions & CI-CD]]

---

*For the full interactive map → open [[🗺️ Study Guide MOC]] or press `Cmd + G` for Graph View*
