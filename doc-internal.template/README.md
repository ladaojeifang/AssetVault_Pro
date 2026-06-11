# Local-only documentation (`doc-internal/`)

The directory **`doc-internal/`** at the repository root is **not pushed to GitHub**. It is listed in `.gitignore`.

Use it for:

- Product roadmaps and commercial planning (PRD, Hub, development plan)
- Manual regression / smoke-test checklists
- Fix plans and internal acceptance notes
- Personal Web API examples and local smoke scripts
- Reference notes (e.g. third-party extension research)

## First-time setup

From the repository root:

```bash
node scripts/init-doc-internal.mjs
```

This will:

1. Create `doc-internal/` and copy listed internal files out of the public tree
2. Remove those paths from the **public** git index (they stay on disk under `doc-internal/`)
3. Initialize a **nested git repository** inside `doc-internal/` for local version control

## Daily workflow

| Task | Command |
|------|---------|
| Edit internal docs | Work under `doc-internal/` |
| Commit internal docs only | `cd doc-internal && git add . && git commit -m "..."` |
| Push public repo | `git push origin main` (pre-push hook blocks internal paths) |
| Re-sync after pulling public repo | Re-run `node scripts/init-doc-internal.mjs` if manifest changed |

## Layout (after init)

```text
doc-internal/
├── README.md
├── planning/          # PRD, DEVELOPMENT_PLAN, Hub
├── maintenance/       # fix plans, i18n inventory, manual acceptance
├── regression/        # hand-test checklists (from README)
├── references/        # eagle extension notes, etc.
├── examples/          # gulu2 import, personal tag scripts
└── scripts/           # catalog merge smoke, check_remote_imports_refs
```

Do **not** remove `doc-internal/` from `.gitignore` unless you intend to publish that content.
