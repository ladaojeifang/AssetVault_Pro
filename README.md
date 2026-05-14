# AssetVault Pro

Professional Digital Asset Management (DAM) System - Desktop Application

## Overview

AssetVault Pro is a modern, high-performance desktop application for managing digital assets (images, videos, audio, fonts, documents). Built with **Electron + React + TypeScript** for cross-platform compatibility.

### Phase 1 (V0.5 Alpha) Features

- **Asset Engine**: Import, preview, organize files with drag-and-drop
- **Smart Search**: Full-text search (FTS5) with multi-dimensional filters
- **Tag System**: Custom tags with colors for flexible organization
- **Folder Management**: Hierarchical folder structure with 5-level nesting
- **Thumbnail Generation**: Fast image/video thumbnail extraction
- **Virtual Scrolling**: Smooth rendering of 100K+ assets
- **Dark Theme**: Professional dark UI optimized for creative workflows

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 28+ |
| Frontend | React 18 + TypeScript 5 |
| State | Zustand + Context API |
| UI Library | TailwindCSS + Arco Design |
| Database | SQLite (better-sqlite3) + FTS5 |
| ORM | Drizzle ORM |
| Image Processing | Sharp |
| File Watching | chokidar |
| Build Tool | electron-vite |

## Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **pnpm** >= 9.x (recommended)
- Windows 10/11 (primary target), macOS/Linux supported

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd AssetVault_Pro

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Build for Production

```bash
# Build and package for Windows
pnpm package

# Or build only (no installer)
pnpm build
```

## Project Structure

```
src/
├── main/              # Electron main process
│   ├── index.ts       # App entry point
│   ├── db/            # SQLite database schema & connection
│   │   ├── schema.ts  # Drizzle ORM table definitions
│   │   └── index.ts   # DB init & migration
│   ├── ipc/           # IPC communication handlers
│   │   ├── index.ts   # Handler registry
│   │   └── handlers/  # Domain-specific handlers
│   └── utils/         # Main process utilities
├── preload/           # Preload scripts (contextBridge)
│   └── index.ts       # Safe IPC bridge
├── renderer/          # React frontend
│   ├── index.html     # HTML template
│   └── src/
│       ├── main.tsx   # React entry point
│       ├── App.tsx    # Root component
│       ├── styles/    # Global CSS / Tailwind
│       ├── stores/    # State management
│       └── components/ # UI components
│           ├── Layout/    # Main layout, titlebar, statusbar
│           ├── Sidebar/   # Folder tree, tag list, type filter
│           ├── Toolbar/   # Search, import, view toggle, sort
│           ├── Assets/    # Grid/list view, virtual scroll
│           └── Detail/    # Asset detail panel
└── shared/            # Shared types & utilities
    └── types.ts       # TypeScript type definitions
```

## Development Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development with HMR |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview built app |
| `pnpm lint` | Run ESLint |
| `pnpm lint:fix` | Fix ESLint issues |
| `pnpm typecheck` | Type check with TypeScript |
| `pnpm db:generate` | Generate DB migrations |
| `pnpm package` | Package as distributable app |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+K | Focus search |
| Ctrl+I | Import files |
| Ctrl+A | Select all |
| Delete | Delete selected |
| Escape | Clear selection / Close panel |

## License

MIT
