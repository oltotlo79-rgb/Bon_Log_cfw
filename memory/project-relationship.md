---
name: project-relationship
description: Bon_Log_cfw is a fly.io-migration copy of the bonnsa-sns app; how to sync them
metadata:
  type: project
---

`C:\Users\oltot\Documents\git-projects\Bon_Log_cfw` is a copy of the production app `C:\Users\oltot\Documents\git-projects\bonnsa-sns` (deployed on Vercel), created to migrate to fly.io. The two are **independent git repos** (different remotes/history): target → github.com/oltotlo79-rgb/Bon_Log_cfw, source → github.com/oltotlo79-rgb/bonnsa-sns.

**Never edit the source `bonnsa-sns`** — it is read-only for sync purposes.

As of 2026-06-03 there are **no fly.io-specific files yet** (an earlier Cloudflare Workers migration was reverted). So syncing = mirroring source's committed tree into target.

**Sync procedure** (perfect content match, preserving target's local tooling config):
1. Back up target's `.mcp.json` and `.claude/settings.local.json` (machine-specific; do NOT overwrite — they hold the /doctor fixes).
2. `git -C <source> archive HEAD | tar -x -C <target>` to overwrite all tracked files.
3. Restore the 2 backed-up config files.
4. `rm` orphaned target-only files (source refactors/renames leave stale files), then `git add -A`.
5. `npm install` (package-lock is usually unchanged), `npx prisma generate` (schema differs), verify with `npx tsc --noEmit` + `npm run lint`.
6. Verify parity at the git level (immune to Windows CRLF noise): add source as a temp remote, fetch, `git diff --stat <remote>/master` should show only the 2 excluded config files.

Note: `diff -rq` between the two working trees reports ~1000 false diffs due to CRLF vs LF — always verify with git, not raw diff.
