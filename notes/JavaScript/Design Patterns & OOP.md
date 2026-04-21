---
tags:
  - javascript
  - design-patterns
  - oop
  - architecture
---

# Design Patterns & OOP

**Related:** [[JavaScript Fundamentals]] | [[React State Management]] | [[APIs & Backend/Express & Node.js]] | [[Supabase Overview]]

---

## OOP — Object-Oriented Programming

OOP organizes code into **objects** — little bundles that contain:
- **Properties** (data)
- **Methods** (behavior / functions)

---

## Public / Private / Protected

Classes hide complexity and protect logic — this is called **encapsulation**.

| Access Modifier | Who Can Access |
|---|---|
| `public` | Anyone (inside, outside, subclasses) |
| `private` | Only the class itself |
| `protected` | Only the class AND its subclasses |

```js
class BankAccount {
  public owner;          // anyone can read this
  private balance = 0;   // only class can change this
  protected pin = 1234;  // child classes can use it

  constructor(owner) {
    this.owner = owner
  }

  deposit(amount) {
    this.balance += amount
  }
}

class SavingsAccount extends BankAccount {
  checkPin() {
    console.log(this.pin) // ✅ works (protected)
  }
}

const acct = new BankAccount("Chelsey")
console.log(acct.owner)   // ✅ ok
console.log(acct.balance) // ❌ error (private)
console.log(acct.pin)     // ❌ error (protected)
```

---

## Factory Pattern

The **factory pattern** centralizes and simplifies object creation — letting you make new instances without worrying about the details of how they're built.

**Why it's useful:**
- **Encapsulation** — hides complex object creation logic
- **Flexibility** — can return different object types based on conditions
- **Maintainability** — if creation logic changes, you only update it in one place
- **Consistency** — ensures objects are created in a uniform way

---

## Dependency Injection

A **design pattern** used to **pass dependencies in** instead of creating them inside a class/function.

**Benefits:**
- Decoupling — each piece evolves independently
- Simplifies testing (can inject mocks)
- More reusable

> **Tight coupling** = when one class/function is too dependent on another's internal behavior. Hard to maintain. Avoid this.

---

## Singleton

A pattern where you ensure **only one instance of a class exists** across the entire app — and can be reused everywhere.

```js
class Config {
  private static instance: Config

  static getInstance() {
    if (!Config.instance) {
      Config.instance = new Config()
    }
    return Config.instance
  }
}
```

---

## Separation of Concerns

Dividing your code so each part has **one clear job**, instead of one big chunk doing everything.

**Why it matters:**
- Easier to understand
- Easier to test
- Easier to maintain

> See [[React Data Fetching]] — service classes vs calling fetch in components directly.
