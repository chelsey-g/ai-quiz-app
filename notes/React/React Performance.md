---
tags:
  - react
  - performance
  - optimization
---

# React Performance

**Related:** [[React State Management]] | [[React Data Fetching]] | [[Debugging & DevTools]]

---

## How to Prevent Unnecessary Re-renders

- Keep state **local** when possible
- Use `React.memo`, `useCallback()`, `useMemo()` so props aren't constantly changing

### React.memo

Wraps a component and prevents re-rendering unless its **props change**.

> "Don't redraw me unless something new happens."

```jsx
const MyComponent = React.memo(({ value }) => {
  return <div>{value}</div>
})
```

### useCallback

Saves a **function reference** so it doesn't get recreated every render.

```js
const handleClick = useCallback(() => {
  doSomething(id)
}, [id])
```

### useMemo

Saves the **result of a calculation** so it doesn't run every render.

```js
const expensiveValue = useMemo(() => {
  return computeExpensiveThing(input)
}, [input])
```

---

## How to Measure Performance

- **React DevTools Profiler** — see which components re-render and why
- **DevTools Performance tab** — analyze paint/script timing
- Keep state local
- Avoid loading large data sets unnecessarily
- Avoid unnecessary re-renders (use memo/callback/useMemo)

---

## Summary: When to Use Each

| Tool | Use When |
|---|---|
| `React.memo` | Component re-renders with same props |
| `useCallback` | Passing callback functions as props |
| `useMemo` | Expensive calculations in render |
| Local state | Data only needed in one component |
| Context / Zustand | Data needed across many components |

> See also: [[React State Management]] for when to lift state vs use a library.
