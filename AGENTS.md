# Agent guide — AssetVault Pro

协助开发或答疑前，请先阅读 **[doc/README.md](doc/README.md)**（全项目文档索引）。

## 必读文档（按任务）

| 任务 | 文档 |
|------|------|
| 产品范围与功能 | [doc/AssetVault_Pro_PRD_V1.0.md](doc/AssetVault_Pro_PRD_V1.0.md) |
| 里程碑与待办 | [doc/DEVELOPMENT_PLAN.md](doc/DEVELOPMENT_PLAN.md) |
| 本地 HTTP API | [doc/web-api-v1-guide.md](doc/web-api-v1-guide.md)、[doc/web-api-v1-design.md](doc/web-api-v1-design.md) |
| AI 画布 / 网关 | [doc/node_type.md](doc/node_type.md)、[doc/AI_GATEWAY_SPEC.md](doc/AI_GATEWAY_SPEC.md) |

## 代码布局

- `src/main/` — Electron 主进程（DB、better-sqlite3、Web API、IPC）
- `src/renderer/` — React UI
- `src/shared/` — 主/渲染进程共享类型与常量
- `doc/` — **所有** Markdown 规格与说明（勿使用已删除的 `docs/` 目录）

## Web API v1

- 实现：`src/main/api/`（Node `http`，JSend JSON）
- 默认：`http://127.0.0.1:41596/api/v1/`
- OpenAPI 源文件：`doc/web-api-v1-openapi.yaml`（运行时 URL 为 `/api/v1/docs/openapi.yaml`）

## 约定

- 用户可见文档路径写 `doc/...`
- 修改 API 行为时同步更新 guide、openapi 与设计稿
- 仅在被要求时创建 git commit；不提交密钥或本地数据库
