---
tags:
  - cloud
  - storage
  - s3
  - r2
  - blob
---

# Cloud & Object Storage

**Related:** [[Video Engineering/Transcoding & HLS]] | [[Cloud & Storage/Redis & BullMQ]] | [[Supabase Overview]] | [[APIs & Backend/Express & Node.js]]

---

## What is Cloud Storage?

A **highly durable, scalable, distributed file system** designed specifically for larger files. Solves problems your app server shouldn't have to think about.

**Problems it solves:**

| Problem | Solution |
|---|---|
| **Durability** | Files replicate across multiple machines and data centers |
| **Scalability** | Automatically scales bandwidth and distribution |
| **Offloading your server** | Your app server shouldn't stream 4K video or handle 10GB uploads |
| **Cost efficiency** | Cheaper than storing on your own server |
| **CDN** | Content delivery network — serves files from nearest location to user |

> "If you host files on a server, the hard drive has a maximum size. Also, if your server is in Virginia and someone from Japan wants your file, it's slower for them. CDN-fronted cloud storage makes copies all around the world, trivially."

---

## Your Express Server Should / Shouldn't

| ✅ Should | ❌ Should NOT |
|---|---|
| Handle auth | Stream 4K video |
| Handle API requests | Handle 10GB uploads |
| Generate signed URLs | Serve large static files |
| Manage metadata | |

---

## Object Storage

Object Storage holds **the file**. Your database holds the **truth about the file**.

### Core Concepts

- A file is called an **object**
- An object has:
  - **Bucket** — container (like a folder at the top level)
  - **Key** — path + filename
  - **Bytes** — the actual file content

```
Bucket: my-video-app
Key:    videos/9f2a7d23.mp4
```

---

## Pattern 1: "DB Stores the Pointer"

Store the **object key** in Postgres (not the URL). URLs can change, keys don't.

> "We store files in object storage and keep only metadata and the object key in Postgres, which lets us scale storage independently from the database."

---

## Pattern 2: "Two-Step Upload"

1. Client asks API: "Where do I upload?"
2. API returns **presigned PUT URL** + key
3. Client uploads **directly** to object storage (bypasses your server)
4. Client tells API: "Uploaded!" → API creates/updates DB row

**Benefits:** Scales cleanly, cheaper, your Express server doesn't become a video pipe.

---

## Signed URLs

**Temporary permission slip** to access a specific file.

> "Anyone holding this exact URL is allowed to do **this one action** on **this one object** for **this much time**."

### The Core Idea (burn this in)

```
Your server signs the URL.
The browser uses the URL.
Storage trusts the signature.
```

> The browser **never** gets credentials. Ever.

---

## GET URLs Flow (Video Watch Page Example)

1. Call Express
2. Express checks permissions
3. Express generates **signed GET URL**
4. URL expires in 60 seconds
5. Browser streams directly from R2

> The video keeps playing even after expiration — expiration only matters when **requesting** the file.

---

## Why NOT to Save Videos in PostgreSQL

- Bloats backups and migrations
- Slows queries / vacuum / replication
- Expensive storage compared to object storage
- Harder to serve efficiently (range requests, CDN, etc.)
- You lose the "serve file directly" advantage of browsers/CDNs

> Postgres *can* store blobs — it just **shouldn't** for this.

---

## R2/S3 Organization

- "Folders" are just **key prefixes** — `videos/file.mp4` and `thumbnails/file.jpg`
- Same bucket is fine for related assets with the same access patterns
- Separate buckets only needed for different policies, regions, or billing

---

## Canvas & Blob

### Canvas

A `<canvas>` is an HTML element that lets you **draw graphics with JavaScript**. Think of it as a blank image you can paint on programmatically.

```js
const canvas = document.getElementById('myCanvas')
const ctx = canvas.getContext('2d') // "context" = your paintbrush
```

You can draw video frames onto a canvas:

```js
ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
// Canvas now contains a still image of that video frame
```

### Blob

A **Blob (Binary Large Object)** is raw binary data in JavaScript — a file in memory before it has a name or is saved anywhere.

| | Blob | File |
|---|---|---|
| What it is | Raw binary data | Blob + name + metadata |
