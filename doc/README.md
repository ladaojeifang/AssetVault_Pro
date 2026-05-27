# AssetVault Pro — 项目文档索引

本目录集中存放项目说明、规格与集成文档，便于查阅与后续 AI/开发者协助。

根目录仅保留 [README.md](../README.md)（仓库入口与快速开始）。

---

## 产品与规划

| 文档 | 说明 |
|------|------|
| [AssetVault_Pro_PRD_V1.0.md](./AssetVault_Pro_PRD_V1.0.md) | 产品需求文档 V1.0 |
| [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) | 开发计划 |

---

## 功能与资源

| 文档 | 说明 |
|------|------|
| [资源包.md](./资源包.md) | 资料库资源包结构说明 |
| [eagle文件处理.md](./eagle文件处理.md) | Eagle 文件处理参考 |
| [node_type.md](./node_type.md) | AI 画布节点类型（对齐 modeconfig） |
| [AI_GATEWAY_SPEC.md](./AI_GATEWAY_SPEC.md) | AI 网关 API、inputs 校验与 IPC 规划 |

---

## Web API v1（本地 HTTP 自动化）

| 文档 | 说明 |
|------|------|
| [web-api-v1-guide.md](./web-api-v1-guide.md) | **使用说明**（接口清单、curl 示例、Playground） |
| [web-api-v1-design.md](./web-api-v1-design.md) | 技术设计稿与实现阶段 |
| [web-api-v1-openapi.yaml](./web-api-v1-openapi.yaml) | OpenAPI 3.1 规范（可导入 Postman） |

运行时访问（应用已启动、默认端口 41596）：

- Playground：`http://127.0.0.1:41596/api/v1/playground/`
- OpenAPI：`http://127.0.0.1:41596/api/v1/docs/openapi.yaml`

应用内：**设置 → Advanced → 开发者 · Web API**。

---

## 文档维护约定

- 新增说明类 Markdown 请放在 `doc/` 下，并在本索引中补一行链接。
- 面向用户的 API 用法优先更新 `web-api-v1-guide.md`；协议变更同步 `web-api-v1-openapi.yaml` 与设计稿。
- 代码中引用文档路径请使用 `doc/...`，勿再使用已废弃的 `docs/` 目录。
