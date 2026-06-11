# Publishing to GitHub

## One-time setup (maintainer machine)

```bash
# 1. Internal docs (local nested git, not pushed)
node scripts/init-doc-internal.mjs

# 2. Pre-push safety hook
git config core.hooksPath .githooks
```

## What gets pushed

| Included | Excluded (`.gitignore` or removed from index) |
|----------|-----------------------------------------------|
| `src/`, `doc/`, `testing/` | `doc-internal/` |
| `LICENSE`, `CONTRIBUTING.md`, `.github/` | `node_modules/`, `out/`, `release/` |
| `pnpm-lock.yaml` | `.env`, `*.db`, `data/` |
| Public examples under `doc/examples/` | Personal scripts (migrated to `doc-internal/`) |

## Before every push

```bash
pnpm run typecheck
pnpm run test:ci
node scripts/verify-push-safe.mjs
git push origin master:main
```

The pre-push hook runs `verify-push-safe.mjs` automatically when `core.hooksPath` is set.

## Remote

```bash
git remote -v
# origin  https://github.com/ladaojeifang/AssetVault_Pro.git
git push -u origin master:main
```

## Internal documentation workflow

```bash
cd doc-internal
git status
git add .
git commit -m "docs: update internal regression notes"
# Do NOT push doc-internal to GitHub — it stays local
```
