---
tags:
  - video
  - ffmpeg
  - abr
  - streaming
---

# FFmpeg & Adaptive Streaming

**Related:** [[Transcoding & HLS]] | [[Cloud & Storage/Redis & BullMQ]] | [[Cloud & Storage/Cloud & Object Storage]]

---

## What is FFmpeg?

An **open-source command line tool** that:
- Converts video formats
- Compresses video
- Resizes video
- Extracts audio

### Key Flags

| Flag | Purpose |
|---|---|
| `-i` | Input file |
| `-vf "scale=1280:720"` | Resize to 720p |
| `-b:v 2500k` | Video bitrate (quality/size tradeoff) |
| `-c:v libx264` | Video codec |
| `-y` | Overwrite output file |

### FFmpeg Processing Pipeline

```
Input → Filters → Encoder → Output
```

---

## HLS Output with FFmpeg

FFmpeg creates:
- `.m3u8` manifest files (playlist/index)
- `.ts` segment files (video chunks, ~4 seconds each)

The player loads the `.m3u8`, which tells it where all the segments are.

---

## Adaptive Bitrate Streaming (ABR) — Deep Dive

The player **measures bandwidth in real time** and switches quality levels mid-playback.

### ABR Algorithm

1. Start at a medium quality
2. Download segment
3. Measure: did it download fast or slow?
4. If fast → try higher quality next segment
5. If slow → drop to lower quality next segment

**Why it matters:** Users on slow connections still get smooth playback — just at lower quality instead of buffering.

---

## Why ABR Requires a Good Bitrate Ladder

If your lowest rendition is 720p at 3Mbps, and a user only has 1Mbps — they **cannot** stream smoothly.

The player has nowhere to go. It will buffer.

Always include:
- A low enough floor (360p or even 240p)
- Gradual steps between renditions

---

## Summary: Full Video Stack

```
Upload → FFmpeg (transcode) → HLS segments → R2/S3 (object storage)
                                    ↓
                            Postgres (metadata + object key)
                                    ↓
                          Signed URL → Browser streams via ABR
```

> See: [[Transcoding & HLS]] for the full transcoding pipeline.
> See: [[Cloud & Storage/Cloud & Object Storage]] for signed URL patterns.
