# AssetVault Pro

> **English:** [README.md](./README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/ladaojeifang/AssetVault_Pro/actions/workflows/ci.yml/badge.svg)](https://github.com/ladaojeifang/AssetVault_Pro/actions/workflows/ci.yml)

专业数字资产管理系统（DAM）—— 桌面端应用（**社区版**，MIT 许可）。

> **状态：** V0.5 Alpha — API 与磁盘格式可能在版本间变更。

## 概览

AssetVault Pro 是一款现代、高性能的桌面数字资产管理应用，支持图片、视频、音频、字体、文档等资产。基于 **Electron + React + TypeScript** 构建，具备跨平台能力。

### 第一阶段（V0.5 Alpha）功能

- **资产引擎**：拖拽导入、预览与整理
- **智能搜索**：索引文本搜索（`assets_search` + LIKE）与多维筛选
- **标签系统**：自定义颜色标签，灵活组织资产
- **文件夹管理**：层级文件夹，最多 5 层嵌套
- **缩略图生成**：快速提取图片/视频缩略图
- **虚拟滚动**：流畅渲染 10 万+ 资产
- **深色主题**：面向创作流程的专业深色界面
- **Web API (v1)**：应用运行时提供本地 HTTP API，便于自动化 — 见 [doc/web-api-v1-guide.md](doc/web-api-v1-guide.md)

## 开源与商业版

本仓库为 **开源社区版**，遵循 [MIT License](LICENSE)。

| 版本 | 范围 |
|------|------|
| **社区版（本仓库）** | 本地桌面 DAM、导入/预览/搜索、Web API v1、浏览器扩展集成 |
| **商业版（规划中）** | 团队 Hub、高级协作、企业集成、托管服务 — **不包含在本仓库**；若提供将另行公布条款与上线安排 |

产品路线图与商业规划存放在 **`doc-internal/`**（仅本地，不推送 GitHub）。Fork 可在 MIT 下再分发；命名与 Logo 规则见 [TRADEMARK.md](TRADEMARK.md)。

**贡献指南：** [CONTRIBUTING.md](CONTRIBUTING.md) · **安全：** [SECURITY.md](SECURITY.md)

## 相关项目

| 项目 | 说明 |
|------|------|
| [AssetVault Browser Extension](https://github.com/ladaojeifang/AssetVault_Browser_Extension) | Chrome/Edge MV3 扩展 — 通过本地 Web API 保存网页媒体 |

## 文档

| 受众 | 入口 |
|------|------|
| **用户** | **[帮助中心](doc/help/index.md)** — 安装、导入、文件夹与标签、预览、Web API、设置、快捷键、FAQ |
| **开发者** | **[doc/](doc/README.md)** — Web API、架构、资产规格、OpenAPI |
| **维护者** | **`doc-internal/`** — 路线图与手测清单（仅本地；克隆后运行 `node scripts/init-doc-internal.mjs`） |

初次使用？从 [快速入门](doc/help/getting-started.md) 开始。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面壳 | Electron 28+ |
| 前端 | React 18 + TypeScript 5 |
| 状态 | Zustand + Context API |
| UI 库 | TailwindCSS + Arco Design |
| 数据库 | SQLite（better-sqlite3，WAL）+ `assets_search` LIKE 索引 |
| ORM | Drizzle ORM |
| 图像处理 | Sharp |
| 文件监听 | chokidar |
| 构建工具 | electron-vite |

## 快速开始

### 环境要求

- **Node.js** >= 18.x
- **pnpm** >= 9.x（推荐）
- Windows 10/11（主要目标平台），支持 macOS / Linux

### 安装

```bash
# 克隆仓库
git clone https://github.com/ladaojeifang/AssetVault_Pro.git
cd AssetVault_Pro

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### 生产构建

```bash
# 构建并打包 Windows 安装包
pnpm package

# 仅构建（不生成安装程序）
pnpm build
```

## 项目结构

```
src/
├── main/              # Electron 主进程
│   ├── index.ts       # 应用入口
│   ├── db/            # SQLite 数据库 schema 与连接
│   │   ├── schema.ts  # Drizzle ORM 表定义
│   │   └── index.ts   # 数据库初始化与迁移
│   ├── ipc/           # IPC 通信处理器
│   │   ├── index.ts   # 处理器注册
│   │   └── handlers/  # 按领域划分的处理器
│   └── utils/         # 主进程工具
├── preload/           # Preload 脚本（contextBridge）
│   └── index.ts       # 安全 IPC 桥接
├── renderer/          # React 前端
│   ├── index.html     # HTML 模板
│   └── src/
│       ├── main.tsx   # React 入口
│       ├── App.tsx    # 根组件
│       ├── styles/    # 全局 CSS / Tailwind
│       ├── stores/    # 状态管理
│       └── components/ # UI 组件
│           ├── Layout/    # 主布局、标题栏、状态栏
│           ├── Sidebar/   # 文件夹树、标签列表、类型筛选
│           ├── Toolbar/   # 搜索、导入、视图切换、排序
│           ├── Assets/    # 网格/列表视图、虚拟滚动
│           └── Detail/    # 资产详情面板
└── shared/            # 共享类型与工具
    └── types.ts       # TypeScript 类型定义
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动开发模式（HMR） |
| `pnpm build` | 生产构建 |
| `pnpm preview` | 预览构建结果 |
| `pnpm lint` | 运行 ESLint |
| `pnpm lint:fix` | 自动修复 ESLint 问题 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm db:generate` | 生成数据库迁移 |
| `pnpm package` | 打包为可分发应用 |

## 快捷键

| 快捷键 | 操作 |
|--------|------|
| Ctrl+K | 聚焦搜索 |
| Ctrl+I | 导入文件 |
| Ctrl+A | 全选 |
| Delete | 删除选中项 |
| Escape | 取消选择 / 关闭面板 |

## 测试

```bash
pnpm run typecheck
pnpm run test          # 单元测试 + gen（CI）
pnpm run test:all      # 含集成测试（本地）
```

详见 [testing/README.md](testing/README.md)。手动 UI 回归清单在 **`doc-internal/regression/`**（仅本地）。

## 许可证

[MIT](LICENSE) — Copyright (c) AssetVault Team。第三方二进制（如 ffmpeg、yt-dlp）遵循各自许可证；见打包脚本与 `resources/bin/`。
