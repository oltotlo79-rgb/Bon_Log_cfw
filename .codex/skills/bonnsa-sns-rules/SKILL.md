---
name: bonnsa-sns-rules
description: Load BONNSA SNS project rules from CLAUDE.md and .claude/rules only when needed. Use for coding, reviewing, testing, or architecture work in this Next.js/Prisma project, especially when touching Server Actions, App Router components, API routes, proxy/auth, Prisma, tests, Docker, pesticide data, or comments.
---

# BONNSA SNS Rules

Use this skill as Codex's lightweight bridge to the Claude-maintained project rules.

`CLAUDE.md` and `.claude/rules/*.md` are the canonical sources. Do not duplicate those rule bodies into `AGENTS.md` or this skill. Load only the files relevant to the current task.

## Workflow

1. Read root `CLAUDE.md` when the project baseline is not already in context.
2. Identify the files, feature area, and risk profile of the task.
3. Read only the matching `.claude/rules/*.md` files from the table below.
4. Apply those rules as project constraints while keeping the existing Claude-readable format intact.
5. If rule content itself must change, edit the canonical file in `.claude/rules/` or `CLAUDE.md`.

On Windows, read Japanese markdown with UTF-8 explicitly when using PowerShell:

```powershell
Get-Content -Raw -Encoding UTF8 CLAUDE.md
Get-Content -Raw -Encoding UTF8 .claude\rules\server-actions.md
```

## Rule Index

| Task area | Read |
| --- | --- |
| Layering, actions vs services, dependency direction | `.claude/rules/architecture.md` |
| Server Actions, `ActionResult`, auth/validation/rate-limit order | `.claude/rules/server-actions.md` |
| Pages, layouts, Server/Client Components, metadata | `.claude/rules/nextjs-components.md` |
| Data fetching, caching, revalidation | `.claude/rules/nextjs-data-fetching.md` |
| Route Handlers, webhooks, cron, upload APIs | `.claude/rules/nextjs-api-routes.md` |
| `proxy.ts`, auth redirects, security headers, origin checks | `.claude/rules/nextjs-proxy.md` |
| Performance, images, dynamic imports, bundle concerns | `.claude/rules/nextjs-performance.md` |
| Error handling, not-found/loading/error boundaries | `.claude/rules/nextjs-error-handling.md` |
| Prisma schema, migrations, queries, transactions | `.claude/rules/prisma-database.md` |
| NextAuth, sessions, OAuth, admin auth | `.claude/rules/auth-nextauth.md` |
| Pesticide data verification and MAFF validation | `.claude/rules/pesticide-validation.md` |
| Unit/E2E tests, mocks, coverage expectations | `.claude/rules/testing.md` |
| Docker development setup | `.claude/rules/setup-docker.md` |
| Comment policy and WHY/WHAT judgment | `.claude/rules/comments.md` |

## Loading Guidance

- For code edits, read the rule for the touched layer before editing.
- For cross-cutting changes, read each relevant rule, but avoid bulk-loading all rules by default.
- For reviews, read the rules tied to changed files and the test rule when test coverage is part of the risk.
- Preserve `.claude/rules` filenames, frontmatter, and Markdown structure so Claude can continue reading them.
