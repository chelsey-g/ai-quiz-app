---
tags:
  - database
  - postgresql
  - performance
  - indexing
---

# Indexing & Performance

**Related:** [[SQL & PostgreSQL]] | [[Supabase Overview]] | [[Cloud & Storage/Redis & BullMQ]]

---

## What is Indexing?

An **index** is a separate data structure that stores a **sorted copy of specific columns** from your table, along with pointers to the full rows.

You can **read data faster** at the cost of **slightly slower writes**.

> Create indexes on columns you search or sort **frequently**.

---

## When PostgreSQL Uses an Index

- Query **filters** on an indexed column: `WHERE rating = 5`
- Query **sorts** by an indexed column: `ORDER BY created_at DESC`
- Query **joins** on an indexed column: `JOIN ON books.id = reviews.book_id`
- Query uses a function that matches an expression index

---

## Index Types

| Type | Description |
|---|---|
| **B-Tree (Balanced Tree)** | Default. Self-balancing tree structure. Good for equality + range queries |
| **GIN (Generalized Inverted Index)** | Good for full-text search, arrays, JSONB |
| **Hash Index** | Fast equality lookups only |

---

## Best Practices

- **Always create an index** on columns used in `WHERE` clauses
- Index **foreign keys** (used in JOINs)
- Index **frequently filtered columns** (email, user_id, etc.)
- Don't over-index — each index slows down `INSERT`/`UPDATE`/`DELETE`

---

## Transactions

Ensure **all operations succeed together** — or none of them do.

```sql
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT;
-- If anything fails, ROLLBACK keeps data consistent
```

---

## Constraints

Keep your data **clean and consistent**:

- `PRIMARY KEY` — unique, not null
- `FOREIGN KEY` — references another table
- `NOT NULL` — field can't be empty
- `UNIQUE` — no duplicates
- `CHECK` — custom validation rule

---

## Aggregations

Used for analytics:

```sql
SELECT COUNT(*), AVG(price), SUM(sales), MAX(rating), MIN(created_at)
FROM products;
```

---

## JSONB — Postgres Superpower

Store **flexible data** inside structured tables.

```sql
SELECT data->>'name' FROM users WHERE data->>'role' = 'admin';
```

Great for semi-structured data that doesn't fit neatly into columns.

> See [[Supabase Overview]] — Supabase uses Postgres JSONB under the hood.
