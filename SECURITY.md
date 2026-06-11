# Security policy

## Supported versions

| Version   | Supported |
|-----------|-----------|
| 0.5.x     | Best effort (alpha) |
| &lt; 0.5   | No |

Security fixes are applied to the latest release on `main`. Pre-release (alpha) versions may receive fixes without a separate advisory.

## Reporting a vulnerability

**Please do not file public GitHub issues for security vulnerabilities.**

Report privately by opening a [GitHub Security Advisory](https://github.com/ladaojeifang/AssetVault_Pro/security/advisories/new) (preferred) or emailing the maintainers.

Include:

- Description and impact
- Steps to reproduce
- Affected version / commit
- Suggested fix (if any)

We aim to acknowledge reports within 7 days.

## Scope

In scope:

- AssetVault Pro desktop application (Electron main + renderer)
- Local Web API v1 (`src/main/api/`)
- IPC handlers exposed to the renderer

Out of scope:

- Third-party websites scraped by the browser extension
- User-supplied API keys for external AI providers
- Misconfiguration by the user (see below)

## Web API hardening (user responsibility)

The local HTTP API is intended for automation on a trusted machine.

- Default bind is loopback (`127.0.0.1`). **Enabling remote access** (`0.0.0.0`) requires a Bearer token but still exposes import and library operations to the network — use only on trusted LANs or VPNs.
- Rotate the API token if it may have leaked.
- Do not expose the API port to the public internet without additional controls (reverse proxy, firewall, mTLS).

See [doc/web-api-v1-guide.md](doc/web-api-v1-guide.md).

## Data handling

AssetVault stores library data locally (SQLite and files on disk). The open-source edition does not upload your assets to project-operated servers by default.
