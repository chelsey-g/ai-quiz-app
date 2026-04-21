---
tags:
  - react
  - state
  - zustand
  - redux
  - context
---

# React State Management

**Related:** [[React Performance]] | [[React Data Fetching]] | [[JavaScript Fundamentals]] | [[Design Patterns & OOP]]

---

## When to Lift State Up vs Prop Drilling

- **Lift state up** — when multiple components need to share the same data
- **Prop drilling is fine** — if you're just passing down 1–2 levels
- **Use a state library** — 3+ levels → consider Context API, Zustand, or Redux

---

## Prop Drilling

Passing data down through multiple nested components, even if some components don't directly use the data.

> **Problem:** Verbose, hard to maintain, unnecessary re-renders.

---

## Context API

React's **built-in way** to share data across many components without prop drilling.

**Key pieces:** `createContext`, `useContext`, `Provider`

**Common uses:**
- Theme management
- Authentication state

**⚠️ Disadvantage:** Re-renders **every single time** the context value changes — not very performant for frequently updated data.

> Rule of thumb: 3+ levels → use a state library. Less than that → Context is fine.

---

## Global State Libraries

Keep data in one place, update without prop drilling, avoid unnecessary re-renders, debug more easily.

| Library | Best For | Style |
|---|---|---|
| **Redux** | Larger scale apps | Actions + reducers + stores (more setup & structure) |
| **Zustand** | Small/medium apps | Direct functions, simple to use |

**Redux** uses actions → reducers → store. More boilerplate but more structure.

**Zustand** is minimal: just functions and state. Much simpler.

---

## Keys in Lists

Keys give React a **stable identity** for each list element — making updates faster and preventing bugs when lists change.

```jsx
{items.map(item => (
  <li key={item.id}>{item.name}</li>
))}
```

> ⚠️ Never use index as a key if the list can reorder.

---

## shadCN vs MaterialUI

| | shadCN (Radix + Tailwind) | MaterialUI (MUI) |
|---|---|---|
| **Style** | Unstyled components you own | Fully styled, predefined themes |
| **Installation** | Components copied into your project | Installed as a package |
| **Customization** | Total control | Theme-based |
| **Best for** | Custom design systems | "Plug and play" with built-in look |

> MUI = "plug and play components with a built in look."
> shadCN = "a design starter kit — you own the code."
