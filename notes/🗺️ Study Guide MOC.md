# 🗺️ Study Guide — Map of Content

> 🔥 **Quick review?** Start with [[⚡ Quick Reference]] — one-liner answers for every topic.

> **How to use this map:**
> - Click any `[[link]]` to jump to that note
> - Open **Graph View** (`Cmd + G`) to see the interactive visual map of all linked notes
> - Every note links back to related topics — follow the threads!

---

## 🟡 JavaScript

The foundation of everything web.

- [[JavaScript/JavaScript Fundamentals|JavaScript Fundamentals]] — Type coercion, hoisting, scope, var/let/const, secrets
- [[JavaScript/DOM & BOM|DOM & BOM]] — Document & Browser Object Models, events, browser vs Node detection
- [[JavaScript/Async JavaScript|Async JavaScript]] — Promises, the event loop, fetch(), async/await
- [[JavaScript/Design Patterns & OOP|Design Patterns & OOP]] — Factory pattern, dependency injection, singletons, public/private/protected

---

## ⚛️ React

Building UIs the right way.

- [[React/React State Management|React State Management]] — Prop drilling, Context API, Redux, Zustand, keys, shadCN vs MUI
- [[React/React Performance|React Performance]] — Re-renders, React.memo, useCallback, useMemo
- [[React/React Data Fetching|React Data Fetching]] — SWR, react-query, service classes, Supabase clients, mapSupabaseError

---

## 🌐 Web Fundamentals

How the web actually works.

- [[Web Fundamentals/HTML Basics|HTML Basics]] — divs, block elements, deprecated tags, img tag history
- [[Web Fundamentals/HTTP & Networking|HTTP & Networking]] — HTTP/HTTPS, methods, status codes, headers, CORS, DNS, Gzip
- [[Web Fundamentals/Debugging & DevTools|Debugging & DevTools]] — Debugging process, DevTools tabs, React DevTools

---

## 🗄️ Databases

Storing and querying data.

- [[Databases/SQL & PostgreSQL|SQL & PostgreSQL]] — Database basics, SQL, PostgreSQL architecture, CRUD, JOINs, Views
- [[Databases/Indexing & Performance|Indexing & Performance]] — Index types, when to index, transactions, constraints, JSONB

---

## 🔌 APIs & Backend

Building the server side.

- [[APIs & Backend/REST vs GraphQL vs RPC|REST vs GraphQL vs RPC]] — Comparing API strategies, when to use each, tRPC
- [[APIs & Backend/Express & Node.js|Express & Node.js]] — Express architecture, Node.js frameworks, serverless functions
- [[APIs & Backend/Laravel & PHP|Laravel & PHP]] — PHP, Laravel framework, comparison with Express

---

## 🟢 Supabase

Backend-as-a-service with PostgreSQL.

- [[Supabase/Supabase Overview|Supabase Overview]] — Open source stack, REST/RPC/GraphQL, Firebase comparison, browser vs server client
- [[Supabase/Supabase Webhooks|Supabase Webhooks]] — Database events, webhook flow, agent pipeline model

---

## ☁️ Cloud & Storage

Handling files, caching, and queues.

- [[Cloud & Storage/Cloud & Object Storage|Cloud & Object Storage]] — Cloud storage benefits, object storage patterns, signed URLs, Canvas & Blob
- [[Cloud & Storage/Redis & BullMQ|Redis & BullMQ]] — Redis use cases, job queues, BullMQ, Redis cluster

---

## 🎬 Video Engineering

Streaming video at scale.

- [[Video Engineering/Transcoding & HLS|Transcoding & HLS]] — What transcoding is, HLS, bitrate ladder, segment duration, ABR
- [[Video Engineering/FFmpeg & Adaptive Streaming|FFmpeg & Adaptive Streaming]] — FFmpeg flags, HLS output, ABR algorithm, full video stack

---

## 🚀 DevOps & Testing

Shipping with confidence.

- [[DevOps & Testing/Testing|Testing]] — Vitest, Jest, React Testing Library, Cypress, mocking, testing pyramid
- [[DevOps & Testing/GitHub Actions & CI-CD|GitHub Actions & CI/CD]] — CI/CD concepts, workflows, merging strategies, worktrees
- [[DevOps & Testing/Development Workflow|Development Workflow]] — Local → Staging → Production, core workflow principles, post mortems

---

## 🤖 AI & IDE

Working with AI tools effectively.

- [[AI & IDE/AI Workflow & IDE|AI Workflow & IDE]] — IDEs, Claude Code, how to prompt AI, workflow principles

---

## 🕸️ Concept Connection Map

Here's how all the major topics connect:

```
JavaScript Fundamentals
  ├── DOM & BOM ─────────────────── HTML Basics
  ├── Async JavaScript ───────────── REST vs GraphQL vs RPC
  └── Design Patterns & OOP ──────── React Data Fetching

React
  ├── React State Management ─────── JavaScript Fundamentals
  ├── React Performance ──────────── Debugging & DevTools
  └── React Data Fetching ────────── Supabase Overview

Databases
  ├── SQL & PostgreSQL ───────────── Supabase Overview
  ├── Indexing & Performance ──────── Redis & BullMQ
  └── Supabase Overview ──────────── REST vs GraphQL vs RPC

Cloud & Storage
  ├── Cloud & Object Storage ──────── Transcoding & HLS
  └── Redis & BullMQ ─────────────── BullMQ → Transcoding

Video Engineering
  ├── Transcoding & HLS ──────────── Redis & BullMQ
  └── FFmpeg & Adaptive Streaming ─── Cloud & Object Storage

DevOps & Testing
  ├── Testing ────────────────────── Design Patterns & OOP
  ├── CI/CD ───────────────────────── Development Workflow
  └── Development Workflow ────────── AI Workflow & IDE
```

---

*Open **Graph View** (`Cmd + G`) in Obsidian to see this as a live interactive network map.*
