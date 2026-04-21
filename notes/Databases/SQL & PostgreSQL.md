---
tags:
  - database
  - sql
  - postgresql
  - crud
---

# SQL & PostgreSQL

**Related:** [[Indexing & Performance]] | [[Supabase Overview]] | [[REST vs GraphQL vs RPC]] | [[APIs & Backend/Express & Node.js]]

---

## What is a Database?

A database is nothing more than **a set of related information**.

---

## What is SQL?

**SQL (Structured Query Language)** — how you communicate with databases.

Start with simple `SELECT` queries and add `WHERE` clauses as you go.

---

## What is SQLite?

A **database engine** (software that lets users interact with a relational database). Stores the entire database in a **single file**.

| ✅ Pros | ❌ Cons |
|---|---|
| Great accessibility, portable | Poor for concurrent writes (only one user can write at a time) |

---

## PostgreSQL

PostgreSQL is a **relational database** — stores data in tables with rows and columns, like a spreadsheet with strict rules.

> Runs as a **server process**, usually on **port 5432**.

### How PostgreSQL Works (Step by Step)

1. Runs as a background server process
2. App (Express API) sends a SQL query over a network connection
3. PostgreSQL **parses the query** — checks syntax, table existence, permissions
4. **Query planner** decides the fastest execution plan (full table scan? index? join first?)
5. **Reads data from disk** — tables stored as binary files
6. **Executes the query** — filters, joins, sorts, aggregates
7. **Returns results** — sent to your backend as data, then converted to JSON for frontend

---

## Core Concepts

| Concept | Description |
|---|---|
| **Database** | Container for tables |
| **Table** | Stores data in rows & columns |
| **Row** | One record |
| **Column** | A field with a type |
| **Primary Key** | Uniquely identifies a row |
| **Foreign Key** | Links tables together |

---

## PostgreSQL Data Types

| Type | Purpose |
|---|---|
| `TEXT` | Strings |
| `INTEGER` | Whole numbers |
| `BOOLEAN` | True / false |
| `TIMESTAMP` | Date + time |
| `DATE` | Date only |
| `UUID` | Unique IDs |
| `JSONB` | Structured JSON (Postgres flex 💪) |

---

## CRUD Operations

| Operation | SQL |
|---|---|
| **Create** | `INSERT INTO` |
| **Read** | `SELECT` |
| **Update** | `UPDATE ... SET` |
| **Delete** | `DELETE FROM` |

---

## Common SQL Clauses (Most Common)

```sql
SELECT city, COUNT(*) as customer_count, AVG(age) as avg_age
FROM customers
WHERE age > 18
GROUP BY city
HAVING COUNT(*) > 2
ORDER BY customer_count DESC
LIMIT 5;
```

| Clause | Purpose |
|---|---|
| `WHERE` | Filters individual rows (before grouping) |
| `HAVING` | Filters groups (after `GROUP BY`) |
| `ORDER BY` | Always near the end |
| `LIMIT` | Always last |
| `DISTINCT` | Returns unique values only |

> ⚠️ Always create an **index** anytime you use `WHERE` — see [[Indexing & Performance]]

---

## JOIN Types

| Join | Meaning |
|---|---|
| `INNER JOIN` | Only matching rows |
| `LEFT JOIN` | All left rows + matches |
| `RIGHT JOIN` | All right rows |
| `FULL JOIN` | Everything |

---

## SQL Views

A **view** is a saved query that behaves like a table. Instead of writing a big query every time, you store it.

**Why useful:**
- Simplify complex queries
- Hide columns
- Create computed columns

---

## Temporal Data

Data that is **tied to time** — the time when something happened, changed, or was valid is an important part of the data.

> Data + time context.

---

## What is Express.js? (Quick)

Express is the bridge between the frontend and the database.

```
Frontend → HTTP Request → Express (routes + logic) → PostgreSQL → JSON Response
```

> See full notes: [[APIs & Backend/Express & Node.js]]
