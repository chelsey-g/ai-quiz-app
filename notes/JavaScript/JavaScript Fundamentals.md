---
tags:
  - javascript
  - fundamentals
  - scope
  - hoisting
---

# JavaScript Fundamentals

**Related:** [[DOM & BOM]] | [[Async JavaScript]] | [[Design Patterns & OOP]] | [[React State Management]]

---

## Who Invented JavaScript and Why?

**Brendan Eich** invented JavaScript in **1995** while working at Netscape. (First version built in just 10 days!)

The goal was to make websites interactive by running small programs directly inside the browser — instead of just static HTML.

---

## JS Type Coercion

The `+` operator performs **string concatenation** if **either operand is a string**.

```js
console.log("5" + 2) // "52" — number 2 converts to "2"
```

| Operator | Behavior |
|---|---|
| `+` | String wins → concatenation |
| `-`, `*`, `/` | Convert to numbers |

---

## Hoisting

When JS runs your code, it **moves all variable and function declarations to the top of scope** before executing anything.

> ⚠️ Only the **declaration** is hoisted, not the **value**.

---

## Scope

**Scope** = where a variable can be seen or used in your code.

| Scope | Description |
|---|---|
| **Global Scope** | Variable accessible anywhere in the program |
| **Block Scope** | Variable only accessible inside the `{}` it's defined in |

---

## var, let, const

| Keyword | Scope | Hoisting | Re-assignable |
|---|---|---|---|
| `var` | Function-scoped | Initialized as `undefined` | ✅ Yes |
| `let` | Block-scoped | Dead until declared (TDZ) | ✅ Yes |
| `const` | Block-scoped | Dead until declared (TDZ) | ❌ No |

> 💡 `var` is function-scoped and initializes as `undefined`. `let` and `const` are block-scoped and can't be used before declaration.

> If you try to use `let` or `const` before declaration, you get an error (Temporal Dead Zone).

**Use `let`** for variables that change. **Use `const`** by default.

---

## Secrets — How to Keep Them Private

**Secrets** are sensitive values your app needs that should **never** be exposed publicly:
- API Keys
- Database passwords
- Auth tokens
- Encryption keys

**How to keep them private:**
- Environment variables (`.env` files)
- `.gitignore` your `.env`
- Secret managers: AWS Secrets Manager, Vercel env vars, Supabase Config

> See: [[Supabase Overview]] | [[APIs & Backend/Express & Node.js]]
