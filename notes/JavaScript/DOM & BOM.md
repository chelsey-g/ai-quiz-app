---
tags:
  - javascript
  - dom
  - browser
  - events
---

# DOM & BOM

**Related:** [[JavaScript Fundamentals]] | [[HTML Basics]] | [[HTTP & Networking]] | [[Async JavaScript]]

---

## DOM — Document Object Model (page content)

The [[DOM]] is always exactly identical to the HTML and displayed as a JS Object. It is a programming interface that can represent the page so that programs can change the structure, style, and content.

This representation as an object allows [[JavaScript Fundamentals|JavaScript]] to interact with and manipulate the content of a webpage. However, while the DOM reflects the HTML structure, it can be modified dynamically through JavaScript — creating differences between the original HTML document and the current DOM state.

> **The DOM provides you with an API to interact with the page via `document.`**

HTML elements are arranged in a **tree-like structure** (head, body, etc. as nodes).

### DOM Methods

| Method | Description |
|---|---|
| `querySelector` | Select a specific HTML element |
| `getElementById` | Find an element by its id |
| `createElement` | Make a new HTML element |
| `append()` | These methods don't work unless you append them |
| `addEventListener` | Listen for events on an element |

### DOM Properties & Sub-objects

- **Properties** — e.g. `style.color`
- **"sub" objects** — when you select an HTML element, you get an object on the DOM with its own methods and properties

---

## BOM — Browser Object Model (browser controls)

If DOM is the page, the **BOM** is the browser environment around it. It allows JS to interact with the browser *outside* the webpage.

**Common BOM objects:**

| Object | Example |
|---|---|
| `window` | `window.alert()` |
| `navigator` | browser info |
| `screen` | display info |
| `location` | `location.reload()` |
| `history` | `history.back()` |

---

## document.createElement vs document.querySelector

- `createElement` — **creates** a new element in the DOM
- `querySelector` — **selects** an existing element

---

## Events in JavaScript

Events are things that happen in the browser that your code can **react to**.

Flow:
1. Browser detects something (click, keypress, etc.)
2. Creates an **event object** with details (element, keys, etc.)
3. Sends the event through the DOM
4. If you've attached an **event listener**, your function runs

```js
element.addEventListener('click', (event) => {
  console.log('clicked!', event.target)
})
```

> See also: [[Async JavaScript]] for how events tie into the event loop.

---

## Browser vs Node.js Detection

```js
typeof window !== 'undefined' // true in browser only
typeof process !== 'undefined' // true in Node.js only
```

Use this in **Next.js** to ensure code touching `localStorage` or `document` only runs client-side (avoids "window is not defined" SSR errors).

**See:** [[APIs & Backend/Express & Node.js]] | [[Async JavaScript]]
