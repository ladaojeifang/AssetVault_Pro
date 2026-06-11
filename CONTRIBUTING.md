# Contributing to AssetVault Pro

Thank you for your interest in contributing. This repository is the **open-source Community Edition** of AssetVault Pro (desktop DAM). We welcome bug reports, documentation improvements, and code contributions.

## Before you start

- Read [README.md](README.md) for setup (`pnpm install`, `pnpm dev`).
- Browse [doc/README.md](doc/README.md) for architecture and API docs.
- Check existing [issues](https://github.com/YOUR_ORG/AssetVault_Pro/issues) to avoid duplicate work.

## Development workflow

1. Fork the repository and create a branch from `main`.
2. Install dependencies: `pnpm install` (requires Node.js ≥ 18 and pnpm ≥ 9).
3. Make your changes. Keep PRs focused and reasonably small.
4. Run checks locally before opening a PR:

   ```bash
   pnpm run typecheck
   pnpm run test
   pnpm run lint
   ```

5. Open a pull request with a clear description and test notes.

## Code style

- Match existing TypeScript/React patterns in the surrounding files.
- Prefer extending shared registries (`src/shared/*`) over one-off format or preview logic.
- User-facing copy: add keys to both `src/renderer/src/i18n/locales/en-US/` and `zh-CN/` when applicable.
- API or Web API behavior changes must update `doc/web-api-v1-guide.md` and `doc/web-api-v1-openapi.yaml`.

## Commit messages

Use clear, imperative subjects (e.g. `fix: handle missing catalog paths on import`). Reference issue numbers when relevant (`#123`).

## Developer Certificate of Origin (DCO)

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE) and that you have the right to submit them.

For each commit, include a sign-off line:

```text
Signed-off-by: Your Name <your.email@example.com>
```

You can add it automatically with `git commit -s`.

## What we are looking for

- Bug fixes with reproduction steps or tests
- Tests for `src/shared/` registries and pure utilities
- Documentation fixes and translations
- Web API contract improvements (with OpenAPI sync)

## Out of scope (for now)

- Large refactors without prior discussion
- Features reserved for a future commercial edition (team hub, enterprise SSO, etc.) — open an issue first if unsure

## Security

Do not open public issues for vulnerabilities. See [SECURITY.md](SECURITY.md).

## Questions

Use GitHub Discussions or issues for questions. You may write in English or 中文.
