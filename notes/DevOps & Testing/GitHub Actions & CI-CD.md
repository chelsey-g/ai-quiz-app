---
tags:
  - cicd
  - github-actions
  - devops
---

# GitHub Actions & CI/CD

**Related:** [[DevOps & Testing/Testing]] | [[DevOps & Testing/Development Workflow]] | [[APIs & Backend/Express & Node.js]]

---

## What is GitHub Actions?

A **CI/CD platform** that allows you to automate your build, test, and deployment pipeline.

You can create workflows that:
- Build and test every pull request
- Deploy merged PRs to production
- Run on any GitHub event (push, PR, schedule, etc.)

---

## CI — Continuous Integration

A software practice that requires **frequently committing code** to a shared repository.

**Benefits:**
- Detects errors sooner
- Reduces the amount of code you need to debug
- Easier to merge changes from different team members
- Developers spend more time writing code, less time debugging merge conflicts

**How it works with GitHub Actions:**
- GitHub runs your CI tests on every PR
- Shows results directly in the pull request
- All CI tests pass → ready for review or merge
- A test fails → one of your changes may have caused it

---

## CD — Continuous Deployment

The practice of using automation to **publish and deploy software updates**.

As part of the typical CD process:
1. Code is automatically built
2. Tests run
3. If all passes → automatically deployed to production

---

## Merging & Development Strategies

**Branches** let you develop features without affecting main/production.

Common patterns:
- **Feature branches** — one branch per feature
- **MVP vs full-scale** — start simple, iterate
- **Main branch protection** — require PR reviews + passing CI before merge

---

## Useful Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows)
- [GitHub Actions Tutorial (YouTube)](https://www.youtube.com/watch?v=AknbizcLq4w)

---

## What is a Worktree?

A worktree is **multiple working folders tied to the same repo**. Lets you check out multiple branches simultaneously — useful for working on a hotfix while still on a feature branch.

> See: [[APIs & Backend/Express & Node.js]] for more on Node + deployment context.
