# Agent guide — AssetVault Pro

协助开发或答疑前，请先阅读 **[doc/README.md](doc/README.md)**（公开文档索引）。

维护者专用文档在 **`doc-internal/`**（gitignore，不推送 GitHub）。克隆后运行 `node scripts/init-doc-internal.mjs`。

## 必读文档（按任务）

| 任务 | 文档 |
|------|------|
| 架构总览 | [doc/PROJECT_OVERVIEW.md](doc/PROJECT_OVERVIEW.md) |
| 本地 HTTP API | [doc/web-api-v1-guide.md](doc/web-api-v1-guide.md)、[doc/web-api-v1-design.md](doc/web-api-v1-design.md) |
| 资产类型与缩略图 | [doc/asset-types-and-import.md](doc/asset-types-and-import.md)、[doc/thumbnail-pipeline.md](doc/thumbnail-pipeline.md) |
| 资料库合并 | [doc/library-import-from-library-spec.md](doc/library-import-from-library-spec.md) |
| OpenEXR 预览 | [doc/exr-preview.md](doc/exr-preview.md) |
| 浏览器扩展 | [doc/browser-extension.md](doc/browser-extension.md) |
| AI 画布 / 网关 | [doc/node_type.md](doc/node_type.md)、[doc/AI_GATEWAY_SPEC.md](doc/AI_GATEWAY_SPEC.md) |
| 产品规划 / 手测（本地） | `doc-internal/planning/`、`doc-internal/regression/` |

## 代码布局

- `src/main/` — Electron 主进程（DB、better-sqlite3、Web API、IPC）
- `src/renderer/` — React UI
- `src/shared/` — 主/渲染进程共享类型与常量
- `doc/` — 公开发布的 Markdown
- `doc-internal/` — 本地维护者文档（嵌套 git，不推送）
- `testing/` — 自动化测试

## Web API v1

- 实现：`src/main/api/`
- 默认：`http://127.0.0.1:41596/api/v1/`
- OpenAPI：`doc/web-api-v1-openapi.yaml`

## 推送 GitHub 前

```bash
git config core.hooksPath .githooks   # 一次性
node scripts/verify-push-safe.mjs   # 手动检查
```

勿提交：`doc-internal/`、`.env`、`*.db`、`out/`、`release/`。
