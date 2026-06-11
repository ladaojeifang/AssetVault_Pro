# AssetVault Pro

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/YOUR_ORG/AssetVault_Pro/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_ORG/AssetVault_Pro/actions/workflows/ci.yml)

Professional Digital Asset Management (DAM) System — desktop application (**Community Edition**, MIT).

> **Status:** V0.5 Alpha — APIs and on-disk formats may change between releases.

## Overview

AssetVault Pro is a modern, high-performance desktop application for managing digital assets (images, videos, audio, fonts, documents). Built with **Electron + React + TypeScript** for cross-platform compatibility.

### Phase 1 (V0.5 Alpha) Features

- **Asset Engine**: Import, preview, organize files with drag-and-drop
- **Smart Search**: Indexed text search (`assets_search` + LIKE) with multi-dimensional filters
- **Tag System**: Custom tags with colors for flexible organization
- **Folder Management**: Hierarchical folder structure with 5-level nesting
- **Thumbnail Generation**: Fast image/video thumbnail extraction
- **Virtual Scrolling**: Smooth rendering of 100K+ assets
- **Dark Theme**: Professional dark UI optimized for creative workflows
- **Web API (v1)**: Local HTTP API for automation while the app is running — see [doc/web-api-v1-guide.md](doc/web-api-v1-guide.md)

## Open source & commercial

This repository is the **open-source Community Edition**, released under the [MIT License](LICENSE).

| Edition | Scope |
|---------|--------|
| **Community (this repo)** | Local desktop DAM, import/preview/search, Web API v1, browser extension integration |
| **Commercial (planned)** | Team hub, advanced collaboration, enterprise integrations, hosted services — **not included here**; terms and availability will be announced separately if offered |

Roadmap items in [doc/DEVELOPMENT_PLAN.md](doc/DEVELOPMENT_PLAN.md) and related PRDs are **planning documents**, not commitments. Forks may redistribute under MIT; see [TRADEMARK.md](TRADEMARK.md) for naming and logo rules.

**Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md) · **Security:** [SECURITY.md](SECURITY.md)

## Related projects

| Project | Description |
|---------|-------------|
| [AssetVault Browser Extension](https://github.com/YOUR_ORG/AssetVault_Browser_Extension) | Chrome/Edge MV3 extension — saves web media via the local Web API |

## Documentation

All project documentation lives under **[doc/](doc/README.md)** (PRD, development plan, Web API guide, AI gateway spec, etc.).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron 28+ |
| Frontend | React 18 + TypeScript 5 |
| State | Zustand + Context API |
| UI Library | TailwindCSS + Arco Design |
| Database | SQLite via better-sqlite3 (WAL) + `assets_search` LIKE index |
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
git clone https://github.com/YOUR_ORG/AssetVault_Pro.git
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

## 手动回归说明

发版或大改（导入、路径、列表、`AppContext`）后，建议按下面步骤手测。用于确认核心能力未回归，**不是**自动化测试，需本地运行 `pnpm dev` 或打包后的应用。

### 索引库全流程

覆盖：**索引库（catalog）** 与 **完整库（archive）** 的路径、导入、缺失检测、本地化与升级。

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 侧栏资料库区域点 **+**，选择 **索引库**，创建并切换到新库 | 库列表显示「索引」类标识；`manifest.json` 中 `libraryMode` 为 `catalog` |
| 2 | **Import** 或拖入若干本地文件（含子文件夹更佳） | 导入完成；库目录下 **无** 完整拷贝的 `items/` 大文件体（仅索引元数据） |
| 3 | 网格/列表中查看刚导入资产 | 显示 **引用** 角标；双击可预览（源文件仍在原路径） |
| 4 | 将某一源文件 **移动或删除** 后刷新列表 | 该资产显示 **缺失**；详情面板有缺失提示 |
| 5 | 在详情或设置中对缺失/引用资产执行 **本地化**（若 UI 提供） | 文件复制入库内；角标变为本地；预览仍正常 |
| 6 | 打开 **库设置**，执行 **升级为完整库**（若提供） | 引用资产逐步拷贝入库；模式变为完整库；旧索引路径仍可读 |
| 7 | 新建 **完整库**，重复导入同一批文件 | 文件进入库内 `items/`；无「引用」角标（除非刻意用绝对路径） |
| 8 | 在两个库之间 **切换** | 列表、文件夹树、筛选条件重置；不出现上一库的资产残留 |

**常见异常（需排查）：** 预览报路径不存在、导入后仍显示完整库行为、切换库后仍按旧模式导入、升级半途后 DB 与磁盘不一致。

---

### 列表筛选 + 虚拟滚动

覆盖：列表视图、表头筛选、空状态、列宽与窗口拉伸、分块加载。

| 步骤 | 操作 | 预期结果 |
|------|------|----------|
| 1 | 工具栏切换到 **列表视图**（横条图标） | 出现固定表头行（名称、大小、类型等）；下方为行列表 |
| 2 | 确认资产数量较多（或缩小筛选范围） | 仅可见区域渲染行；滚动流畅，无明显卡顿 |
| 3 | 在表头 **类型** 选某一类（如 Images） | 列表仅显示该类型；底部状态栏数量与结果一致 |
| 4 | 在 **大小** 列设 MB 范围或预设 | 结果符合体积条件 |
| 5 | 在 **主色** 点色块、**导入日期** 选预设 | 结果随之收窄 |
| 6 | 组合 **侧栏 Types**（如 Other）+ 顶栏 **搜索** | 条件叠加；总数与列表一致 |
| 7 | 设一组 **无结果** 条件（如 ≥99999 MB） | 表头仍可见；中间显示「没有匹配的资产」；有 **清除全部筛选** |
| 8 | 点击 **清除全部筛选** | 搜索、侧栏类型、表头筛选一并清除；列表恢复 |
| 9 | **拖宽/拖窄** 列边界（名称、大小等） | 列宽变化；数据行与表头对齐 |
| 10 | **双击** 列边界手柄 | 该列恢复默认宽度 |
| 11 | **拉大窗口或全屏** | 名称列等变宽填满（非右侧大块空白）；表头与行仍对齐 |
| 12 | **缩小窗口** 直至列总宽超出可视区 | 出现横向滚动；表头与内容横向同步 |
| 13 | 快速滚动到底 | 触发加载更多（若有）；无重复行、无大面积空白 |
| 14 | **Shift+单击**、**Ctrl/⌘+单击** 多选 | 选中状态正确；底部状态栏显示选中数 |

**常见异常（需排查）：** 筛选后整页黑屏且无提示、表头与行错位、快速切文件夹后列表闪旧数据、全屏后仅左侧有列右侧全空。

---

### 相关代码（便于对照）

| 能力 | 主要位置 |
|------|----------|
| 索引库 / 完整库 | `src/main/services/libraryManifest.ts`、`importSingleAsset.ts`、`assetPathResolver.ts`、`localizeAsset.ts`、`libraryUpgrade.ts` |
| 列表与筛选 | `src/renderer/src/stores/AppContext.tsx`、`AssetGrid.tsx`、`ListViewColumnHeader.tsx` |
| 列宽与拉伸 | `src/renderer/src/hooks/useListColumnWidths.ts`、`useListTableLayout.ts`、`utils/listViewColumns.ts` |
| 查询与筛选 | `src/main/services/assetQueryFilters.ts`、`src/main/ipc/handlers/assets.ts` |

## 架构风险（维护参考）

半年后或大版本发布前可对照本表排障。按 **数据受损风险** 排序，已与当前代码核对（2026-03）。

| 优先级 | 模块 | 典型症状 | 主要位置 |
|--------|------|----------|----------|
| P0 | DB 与 Drizzle 定义漂移 | 旧库打开报错、写入丢列；降级旧版 exe 后库损坏 | `src/main/db/sqliteSchema.ts`、`schema.ts`、`db/index.ts` |
| P0 | 库模式会话状态 | 切库失败后导入走 catalog/archive 错乱 | `libraryManifest.ts` 的 `sessionLibraryMode`；切库 `librarySwitch.ts` |
| P1 | 索引库路径与缺失 | 预览失败、误标缺失/引用 | `assetPathResolver.ts`、`importSingleAsset.ts` |
| P1 | IPC 入参未校验 | `filePaths` 非数组时主进程抛错；异常路径难查 | `src/main/ipc/handlers/*.ts` |
| P1 | 渲染层列表/筛选竞态 | 快速切文件夹或筛选后列表闪旧数据、总数不对 | `AppContext.tsx`（`listGenerationRef`、防抖搜索） |
| P2 | 动态 `import()` | 重构路径后功能静默失败 | `libraryUpgrade.ts`、`assets.ts`（localize/relink） |
| P2 | JSON/`as` 断言 | manifest 手改后行为诡异 | `readLibraryManifestFile` 等 |
| P2 | 路径拼接风格混用 | 含空格/特殊字符路径在 Windows 上偶发找不到文件 | `importSingleAsset.ts`、`libraryBundle.ts`、`pathUtils.ts` |

### P0：数据库

- 每次打开库都会执行 `createInitialSchemaOnSqlite()`：新增列仍用 `ALTER TABLE` + `try/catch`，但现在也会调用 `runLibrarySchemaMigrations()`；通过 `_av_schema_meta` 记录 `schema_version`，按版本递增分支执行迁移（当前版本常量为 2）。
- 风险依旧在于跨多版/旧版程序打开导致结构不兼容，但现在至少有“版本锚点”，可以避免只靠盲目堆叠 `ALTER`。
- 引擎为 **better-sqlite3**（文件 WAL）；切库/退出前 `wal_checkpoint`（见 `db/index.ts`）。资料库目录可能出现 `library.sqlite-wal` / `-shm`，属正常。

### P0：`sessionLibraryMode`

- 全主进程共用一个 `sessionLibraryMode`（非按库 `Map`）；切库成功时会 `loadLibraryModeFromManifest(root)`。
- 切库失败回滚会恢复 `libraryRoot` 与 DB，并且回滚分支会重新调用 `loadLibraryModeFromManifest(previousRoot)`，使 `sessionLibraryMode` 与 manifest 保持一致。
- 当前为**单窗口单库**设计；若未来多窗口各开不同库，此全局变量会成为硬伤。

### P1：IPC 与前端状态

- 示例：`assets:import` 假定 `filePaths` 为数组并逐项 `existsSync`，传入 `undefined` 会在 `filePaths.length` 处崩溃。
- 搜索实际为 `assets_search` + `LIKE`（`assetSearch.ts`），与 README 早期「FTS5」描述可能不一致；导入/重命名后若未维护搜索表会出现「搜不到」。

---

## 冒烟清单：切库 + 索引库导入（手测）

目标：覆盖 **切库成功/失败回滚**、`sessionLibraryMode` 一致性，以及 **索引库（catalog）导入不拷贝源文件** 的核心路径。建议在 Windows 上按清单走一遍（约 3–5 分钟）。

### 预置

- 准备两个资料库目录：
  - A：现有库（可为 archive 或 catalog）
  - B：新建空目录（用于创建 catalog）
- 准备一批测试文件：
  - 2 张图片、1 个视频、1 个字体（ttf/otf/ttc）、1 个 3D（如 glb/obj，视支持情况）
  - 放在一个包含子目录的文件夹中（用于“导入文件夹”）

### 切库与回滚

- **切换到 B（创建索引库）**：
  - 侧栏资料库区域点 **+** → 选择 **索引库** → 选中空目录 B → 应成功切换
  - 预期：UI 库标识为“索引”；`library:get-state` 返回 `libraryMode: catalog`
- **切回 A**：
  - 选择 A 目录 → 应成功切回
  - 预期：`libraryMode` 与 A 的 `manifest.json` 一致（archive / catalog）
- **模拟失败回滚**（任选一种可控方式）：
  - 指向一个**不存在**的目录执行切库（或选择一个没有权限/损坏的路径）
  - 预期：切库返回 `{ ok: false }`；应用仍保持在原库；再次打开“导入/本地化”等不会走错模式（`sessionLibraryMode` 未漂移）

### catalog 导入（索引库导入不拷贝源文件）

- **在 catalog 模式库（B）执行导入单文件**：
  - 右键/按钮导入测试文件（图片/视频/字体等）
  - 预期：
    - 列表出现资产；可生成缩略图（视频/3D 视实现）
    - `resolvedFilePath` 指向**原始源文件**（而不是 `items/<id>/content`）
    - 资产侧边栏显示“源文件缺失”逻辑正常（断开源文件后应提示缺失）
- **导入文件夹（含子目录）**：
  - 用“导入文件夹”导入预置目录
  - 预期：进度正常；导入后列表数量正确；不会导致主进程报错（IPC guards 生效）
- **本地化到完整库（archive）**：
  - 在 B 中对若干条资产执行“本地化到资料库”
  - 预期：本地化后可在 archive 模式库中看到实际拷贝/硬链接的内容（视设置）；源文件缺失状态更新正常

### 关键修复进展（对应上述三点）

1. 已加入 `_av_schema_meta` + `runLibrarySchemaMigrations` 进行 forward-only 版本锚点（当前常量为 2）。
2. 已在切库成功路径与失败回滚路径调用 `loadLibraryModeFromManifest(...)`，保证 `sessionLibraryMode` 与 manifest 一致。
3. 已新增 `src/main/ipc/ipcGuards.ts` 并在 `assets/folders/tags/fs/fonts/library` 等 IPC handler 上加输入校验；可继续向其他入口扩展并补更多回归项。

自动化测试见 [testing/README.md](testing/README.md)（单元 + 集成 + OpenAPI 契约；`pnpm test` / `pnpm run test:all`）。UI 与全链路 E2E 仍以本节手测为主。

## License

[MIT](LICENSE) — Copyright (c) AssetVault Team. Third-party binaries (e.g. ffmpeg, yt-dlp) are subject to their own licenses; see packaging scripts and `resources/bin/`.
