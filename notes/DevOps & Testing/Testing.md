---
tags:
  - testing
  - vitest
  - jest
  - rtl
  - cypress
---

# Testing

**Related:** [[DevOps & Testing/GitHub Actions & CI-CD]] | [[React Data Fetching]] | [[Design Patterns & OOP]] | [[Debugging & DevTools]]

---

## Why Testing Matters

Testing keeps you from **accidentally breaking stuff** when you:
- Refactor
- Add new features
- Make a tiny tweak

It gives your project **stability** and avoids bugs in production. It also helps you think more clearly about how your code is supposed to work.

---

## Testing Tools Overview

| Tool | Type | Use For |
|---|---|---|
| **Vitest** | Unit + Integration | Services, utilities, React components |
| **Jest** | Unit + Integration | Older codebases, tutorials, Create React App |
| **React Testing Library (RTL)** | Component behavior | Testing UI from the user's perspective |
| **Cypress** | E2E (End-to-End) | Full workflow testing in a real browser |

---

## Vitest

Handles **unit + integration tests**. Great for services, utilities, and React components.

Modern alternative to Jest — built for Vite-based projects.

---

## Jest

Older testing library that does the same job as Vitest. You'll mainly see it in:
- Older codebases
- Tutorials
- Create React App projects

---

## React Testing Library (RTL)

A React component testing tool.

> It does **NOT** run tests itself. It's for **interacting with React components the way a user would**.

- Tests **behavior**, not internal state
- Avoids testing implementation details
- Uses queries like a user would: `getByRole`, `getByText`, `getByLabelText`

```js
render(<Button />)
const btn = screen.getByRole("button", { name: /save/i })
await user.click(btn)
expect(mockSave).toHaveBeenCalled()
```

*(Example of RTL and Vitest working together)*

---

## Cypress

**E2E (End-to-End) browser testing tool** for full-workflow testing.

Tests your entire app as a real user would — from the browser, clicking through pages, filling forms, checking results.

---

## Mocking

In testing, we **mock**:
- API calls
- Service methods
- Database operations
- Expensive functions
- Network requests

> Mocking lets you **isolate things** so you're testing your code, not someone else's.

---

## Testing Pyramid

```
          /\
         /  \    E2E (Cypress) — fewest, slowest, most realistic
        /----\
       /      \  Integration — some, medium speed
      /--------\
     /          \ Unit (Vitest/Jest) — most, fastest, most isolated
    /____________\
```

Write mostly unit tests, some integration tests, few E2E tests.
