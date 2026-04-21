---
tags:
  - video
  - transcoding
  - hls
  - streaming
---

# Transcoding & HLS

**Related:** [[Cloud & Storage/Redis & BullMQ]] | [[Cloud & Storage/Cloud & Object Storage]] | [[Video Engineering/FFmpeg & Adaptive Streaming]]

---

## What is Transcoding?

**Transcoding** = converting a video from one format into other formats. Making multiple versions of a video.

**Why we transcode:**
- Create smaller versions for users with slower internet
- Lower bitrate = faster loading
- Ensure compatibility across devices and browsers

### A Video File Has:

| Component | Examples |
|---|---|
| **Video codec** | H.264, H.265, AV1 |
| **Audio codec** | AAC, Opus |
| **Container** | MP4, MKV, WebM |

Transcoding changes one or more of those.

---

## HLS — HTTP Live Streaming

**Created by Apple.** A way to stream video in **small chunks** instead of one giant file.

For compatibility, you want **HLS (adaptive streaming)**.

When a video is uploaded, your backend:
1. Accepts the file
2. Sends it to transcoder (FFmpeg or a cloud service)
3. Creates multiple versions (renditions)

### What Gets Created

| Variable | Options |
|---|---|
| **Resolution** | 4K → 1080p → 720p → 480p → 360p |
| **Bitrate** | How much data per second (quality vs file size tradeoff) |
| **Codec** | The compression algorithm (H.264, H.265, VP9) |
| **Container** | The file format (.mp4, .webm, .mov) |

---

## The Bitrate Ladder

| Resolution | Bitrate |
|---|---|
| 240p | 300–500 kbps |
| 360p | 700–1,000 kbps (mobile / weak signal) |
| 480p | 1,200–1,800 kbps (slower connections) |
| 720p | 2,500–4,000 kbps (normal WiFi) |
| 1080p | 4,500–8,000 kbps (fast internet) |

### Recommended Starting Renditions

Don't overdo it. Start with 3–4:
- **360p** — slow internet hero
- **480p** — nice mid
- **720p**
- *(optional)* **1080p**

> ⚠️ If you skip 360p, slow users will buffer forever and hate you personally.

---

## Segment Duration

Use **4 seconds**. It's the sweet spot for HLS streaming.

---

## Adaptive Bitrate Streaming (ABR)

The player **bouncing between renditions** so all users get a smooth experience.

**How ABR works:**
1. Start at a normal quality level
2. Download a segment
3. Estimate bandwidth based on download time
4. Switch level up/down for next segment

> ABR only works well if you include **low enough renditions** for truly slow connections.

---

## Full Pipeline

```
User uploads video
  ↓
Express API receives file
  ↓
Adds transcoding job to BullMQ (Redis queue)
  ↓
Worker runs FFmpeg
  ↓
Creates HLS renditions (360p, 480p, 720p, 1080p)
  ↓
Uploads .m3u8 manifest + .ts segments to R2/S3
  ↓
Updates Postgres: stores object key + metadata
  ↓
Frontend player loads .m3u8 and streams via ABR
```

> See: [[Cloud & Storage/Redis & BullMQ]] | [[Video Engineering/FFmpeg & Adaptive Streaming]] | [[Cloud & Storage/Cloud & Object Storage]]
