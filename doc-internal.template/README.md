# Local-only documentation (`doc-internal/`)

> **中文说明：** [README.zh-CN.md](./README.zh-CN.md)

The directory **`doc-internal/`** at the repository root is **not pushed to GitHub**. It is listed in `.gitignore`.

How this relates to public docs:

| Location | Audience | Content |
|----------|----------|---------|
| [doc/help/](../doc/help/index.md) | End users | Install, usage, settings, FAQ (Chinese; shipped with the public repo) |
| [doc/](../doc/README.md) | Developers / integrators | Web API, architecture, asset specs, OpenAPI |
| **`doc-internal/`** | Maintainers | Roadmaps, hand-test checklists, fix plans, personal scripts, reference notes |

Use `doc-internal/` for:

- Product roadmaps and commercial planning (PRD, Hub, development plan)
- Manual regression / smoke-test checklists
- Fix plans and internal acceptance notes
- Personal Web API examples and local smoke scripts
- Third-party reference notes (e.g. Eagle import flow, resource pack format)

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
├── README.md              # This guide (copied from doc-internal.template)
├── README.zh-CN.md        # Chinese version of this guide
├── planning/              # PRD, DEVELOPMENT_PLAN, Hub
├── maintenance/           # fix plans, i18n inventory, manual acceptance
├── regression/            # hand-test checklists (from doc-internal.template/regression/)
├── references/            # third-party notes (Eagle import, resource packs, etc.)
├── examples/              # gulu2 import, personal tag scripts
└── scripts/               # catalog merge smoke, check_remote_imports_refs
```

You may add files freely under each subdirectory; by default they live only in the nested local repo and are not pushed to the public remote.

## Notes

- Do **not** remove `doc-internal/` from `.gitignore` unless you intend to publish that content.
- Public doc index: [doc/README.md](../doc/README.md) · User help: [doc/help/index.md](../doc/help/index.md)
- Before pushing the public repo, you can run `node scripts/verify-push-safe.mjs` manually.
