---
tags:
  - redis
  - queues
  - caching
  - bullmq
---

# Redis & BullMQ

**Related:** [[Cloud & Object Storage]] | [[Video Engineering/Transcoding & HLS]] | [[APIs & Backend/Express & Node.js]] | [[Indexing & Performance]]

---

## What is Redis?

Redis is an **in-memory database** that is extremely fast. Think of it as a "supercharged dictionary" that:

- Lives **outside your app**
- Survives server restarts
- Can be **shared between multiple servers**

### Use Cases

| Use Case | Description |
|---|---|
| **Caching** | Store frequently used data |
| **Session storage** | User login sessions |
| **Job queues** | Store tasks to be processed |
| **Real-time features** | Pub/sub messaging |

```
App → Redis → PostgreSQL
```

> Redis sits between your app and your database to make reads faster.

---

## What is a Job Queue?

A **to-do list for your server**.

```
Transcode video 6 → Here's video 6 (meanwhile 7, 8, ...)
Done with 6 → Transcodes next
```

Job queues can:
- Retry jobs automatically
- Run multiple jobs in parallel
- Prioritize certain jobs
- Schedule for later
- Monitor progress

---

## BullMQ

**BullMQ** is the most popular **job queue system for Node.js + Redis**.

| Concept | Description |
|---|---|
| **Queue** | Where jobs are stored |
| **Producer** | Code that adds jobs to the queue |
| **Worker** | Code that processes jobs from the queue |
| **Job** | A single task with data |

### Why Redis for BullMQ?

BullMQ stores everything in Redis because Redis is:
- Extremely fast
- Persistent
- Shared between servers
- Great for queues

Redis handles: job storage, job state, retries, priorities, delays.

---

## Redis Cluster

A **Redis cluster** is a group of Redis servers that **share the data**.

### When BullMQ Runs on a Redis Cluster

- Workers connect to the cluster
- Jobs are stored across multiple nodes
- Workload scales horizontally

**Benefits:**
- More memory
- Higher throughput
- Better fault tolerance

---

## Video Processing Pipeline (Example)

```
User uploads video
  ↓
Express API receives upload
  ↓
Adds job to BullMQ queue (Redis)
  ↓
Worker picks up job
  ↓
Runs FFmpeg transcoding
  ↓
Uploads output files to R2/S3
  ↓
Updates Postgres with metadata + object keys
```

> See: [[Video Engineering/Transcoding & HLS]] for transcoding details.
> See: [[Cloud & Object Storage]] for R2/S3 storage details.
