---
tags:
  - debugging
  - devtools
  - web-fundamentals
---

# Debugging & DevTools

**Related:** [[JavaScript Fundamentals]] | [[DOM & BOM]] | [[React Performance]] | [[HTTP & Networking]]

---

## Debugging Process

1. **Reproduce the bug** consistently
2. **Read the error message** fully
3. **Isolate the issue** to the smallest piece of code
4. **Use breakpoints** to step through code
5. **Follow the data** from input → output
6. **Check assumptions** (is the code doing what you think?)
7. **Look for edge cases** (null, empty, off-by-one)
8. **Check logs and the network tab**
9. **Use a scientific method** — test one thing at a time
10. **Google the error** — someone else hit it too

---

## DevTools Reference

| Tool | Purpose |
|---|---|
| `console.log` | Quick value checks |
| `console.error` | Highlight real problems |
| `debugger` | Freeze code at exact point |
| **Elements tab** | Fix layout/CSS |
| **Console tab** | See logs & test JS |
| **Sources tab** | Breakpoints + step through code |
| **Network tab** | Debug API calls |
| **Application tab** | Cookies, storage, caches |

---

## Using the Network Tab

The Network tab is your best friend for debugging:
- See every HTTP request your page makes
- Inspect request/response headers and bodies
- Check status codes (`200`, `401`, `500`, etc.)
- See how long requests take

> See [[HTTP & Networking]] for HTTP status codes reference.

---

## React DevTools

- **Components tab** — inspect component tree and props/state
- **Profiler tab** — find unnecessary re-renders

> See [[React Performance]] for how to use profiler results.
