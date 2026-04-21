---
tags:
  - html
  - web-fundamentals
---

# HTML Basics

**Related:** [[DOM & BOM]] | [[HTTP & Networking]] | [[Debugging & DevTools]]

---

## What is a div?

A **container** in HTML. Used to group elements together so you can style them with CSS or target them with JavaScript.

---

## Block-Level Elements

An HTML element that takes up the **full width of the parent container** and always starts on a **new line**.

Examples: `<div>`, `<p>`, `<h1>–<h6>`, `<section>`, `<article>`, `<ul>`, `<li>`

---

## Deprecated HTML Elements

| Element | Why Deprecated |
|---|---|
| `<font>` | Use CSS for styling instead |
| `<center>` | Use CSS `text-align: center` |
| `<big>` / `<small>` | Use CSS `font-size` |

> These were deprecated because we now use **CSS for styling**. Mixing semantics with display/markup is bad practice.

---

## Who Invented the `<img>` Tag?

**Marc Andreessen** in **1993** while working on the **Mosaic browser**.

He later co-founded Netscape and is now a major figure in tech (investor, Andreessen Horowitz).

---

## Key HTML Concepts to Know

- **Semantic HTML** — using the right element for the right purpose (`<nav>`, `<main>`, `<article>` vs `<div>` everywhere)
- **Accessibility** — using `alt` attributes on images, proper heading hierarchy
- **The DOM** reflects your HTML structure — see [[DOM & BOM]]
