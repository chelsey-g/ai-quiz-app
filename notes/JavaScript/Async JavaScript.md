---
tags:
  - javascript
  - async
  - promises
  - fetch
---

# Async JavaScript

**Related:** [[JavaScript Fundamentals]] | [[DOM & BOM]] | [[REST vs GraphQL vs RPC]] | [[APIs & Backend/Express & Node.js]]

---

## JavaScript is Single-Threaded

JavaScript runs **one task at a time**. To handle async work without freezing, JS offloads tasks like `fetch` or `setTimeout` to the **browser Web API** so they run in the background.

Once they're done, the **event loop** moves their callbacks or promise resolutions to the main queue so JS can continue running smoothly.

| | |
|---|---|
| ✅ Benefit | No complex thread management |
| ❌ Downside | Long-running tasks can block the code |

---

## Promises

A **Promise** is an object (placeholder) that may have an available value later — now, later, or never. It will either **resolve** or **reject**. (Think: a JavaScript IOU)

- `resolve()` — called when the promise completes successfully; passes a value to `.then()`
- `reject()` — called on failure; caught with `.catch()`

```js
const myPromise = new Promise((resolve, reject) => {
  // async work here
  resolve('done!')
})

myPromise.then(result => console.log(result))
```

---

## How Promises Work with the Event Loop

```
JS Code
  ↓
Offloads async task → Browser Web API (runs in background)
  ↓
Async task completes → Callback/promise added to queue
  ↓
Event Loop picks it up → Runs in JS main thread
```

---

## fetch()

`fetch()` is a built-in JS method that lets you make **network (HTTP) requests**. It returns a **Promise** — so it won't block your code while waiting for a response.

```js
const response = await fetch('https://api.example.com/data')
const data = await response.json()
```

> See also: [[REST vs GraphQL vs RPC]] for how fetch fits with REST APIs.
> See also: [[React Data Fetching]] for using fetch in React with SWR or react-query.

---

## async / await

`async/await` is syntactic sugar over Promises — it makes async code read like synchronous code.

```js
async function getData() {
  try {
    const res = await fetch('/api/data')
    const json = await res.json()
    return json
  } catch (err) {
    console.error(err)
  }
}
```
