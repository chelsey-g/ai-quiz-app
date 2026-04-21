---
tags:
  - http
  - networking
  - web-fundamentals
  - dns
  - cors
---

# HTTP & Networking

**Related:** [[HTML Basics]] | [[DOM & BOM]] | [[REST vs GraphQL vs RPC]] | [[Async JavaScript]]

---

## What is HTTP / HTTPS?

**HTTP (HyperText Transfer Protocol)** — the communication system of the web. How your browser and web server talk to each other.

Flow: **Browser sends a request → Server replies with a response**

**HTTPS** = HTTP encrypted with **SSL/TLS** (protects from hackers/interceptions)

- **SSL** (Secure Sockets Layer) / **TLS** (Transport Layer Security) — a security protocol that provides an encrypted connection between browser and server

---

## HTTP Methods (Verbs)

Tell the server **what kind of action** you want to perform:

| Method | Action |
|---|---|
| `GET` | Retrieve data |
| `POST` | Send new data |
| `PUT` | Replace existing data |
| `PATCH` | Update part of data |
| `DELETE` | Remove data |

**CRUD mapping:** Create (POST), Read (GET), Update (PUT/PATCH), Delete (DELETE)

> HTTP is a **stateless** protocol — each request is independent.

---

## HTTP Status Codes

| Code | Meaning |
|---|---|
| `100` | Continue |
| `200` | OK |
| `201` | Created |
| `301` | Moved Permanently |
| `302` | Found |
| `400` | Client Error |
| `5xx` | Server Errors |

---

## HTTP Headers

Key-value pairs that travel with every request and response. Like sticky notes telling the browser/server how to handle the message.

**Common Response Headers:**

| Header | Purpose |
|---|---|
| `Content-Type` | Tells browser what type of data it's receiving |
| `Cache-Control` | How the browser should cache the response |
| `Set-Cookie` | Tells browser to store a cookie |
| `Access-Control-Allow-Origin` | Handles CORS (cross-site requests) |
| `Content-Length` | How big the response body is |

---

## Accept Header & MIME Types

The **Accept header** tells the server what formats the client accepts as a response.

**MIME (Multipurpose Internet Mail Extensions)** — standardized labels for content formats. "Here's what kind of content this is."

Examples: `application/json`, `text/html`, `image/png`

---

## CORS — Cross-Origin Resource Sharing

Prevents bad sites from secretly making requests to other sites. A **safety lock** to protect users.

Uses headers like `Access-Control-Allow-Origin`.

> See: [[REST vs GraphQL vs RPC]] for how APIs handle CORS.

---

## DNS — Domain Name System

Converts a website's **domain name** into the **IP address** your computer needs to reach it.

> "Translates domain names into computer-friendly IP addresses."

---

## The Internet vs The World Wide Web

| | Internet | World Wide Web (WWW) |
|---|---|---|
| **Invented** | 1960s (ARPANET) | 1989 by Tim Berners-Lee at CERN |
| **What it is** | The global network of connected computers, routers, and protocols | A system of interlinked webpages accessed via HTTP |

> The **internet is the highway**. The **Web is a car driving on it.**

---

## Gzip vs ZIP

| | Gzip | ZIP |
|---|---|---|
| **Purpose** | Compress one file for faster transmission | Compress + bundle multiple files into one package |
| **Used by** | Next.js, Vercel (compress assets) | Your computer file archives |

> "compress this one single file for faster transmission" vs "compress + bundle these files into one package"
