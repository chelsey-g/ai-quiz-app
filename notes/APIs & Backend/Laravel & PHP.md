---
tags:
  - backend
  - php
  - laravel
  - framework
---

# Laravel & PHP

**Related:** [[Express & Node.js]] | [[REST vs GraphQL vs RPC]] | [[Databases/SQL & PostgreSQL]]

---

## What is PHP?

**PHP** — the server-side scripting language. One of the most widely used languages for the web (WordPress, Facebook's early codebase, etc.).

---

## What is Laravel?

A **backend web framework for PHP** that helps developers build web apps faster and in a more organized way.

> PHP = the language
> Laravel = the toolbox + structure that makes it easy

**Laravel is used to build the server side of websites and apps:**
- APIs
- Authentication systems
- Dashboards
- Ecommerce sites
- SaaS apps
- Full websites

---

## Laravel vs Express (Quick Comparison)

| | Laravel (PHP) | Express (Node.js) |
|---|---|---|
| **Language** | PHP | JavaScript / TypeScript |
| **Style** | "Batteries included" — more built-in features | Minimal — you add what you need |
| **ORM** | Eloquent (built-in, very good) | Prisma, Drizzle, Knex (third-party) |
| **Ecosystem** | Mature, huge community | Huge npm ecosystem |
| **Best for** | Traditional web apps, CMS, full-stack PHP | APIs, microservices, JS full-stack |

---

## Key Laravel Concepts

- **Artisan** — Laravel's command-line tool (like npm scripts but for Laravel)
- **Eloquent ORM** — Laravel's built-in way to interact with the database using PHP objects instead of raw SQL
- **Blade** — Laravel's templating engine for server-rendered HTML
- **Middleware** — Code that runs between the request and response (same concept as Express middleware)
- **Routes** — Define what happens when a URL is hit (same concept as Express routes)

---

## When You'd Choose Laravel

- Team is PHP-experienced
- Building a traditional full-stack app with server-rendered pages
- Need a batteries-included framework with auth, ORM, queue, mail, etc. out of the box
- CMS or ecommerce platform

> See [[Express & Node.js]] for the Node.js equivalent.
