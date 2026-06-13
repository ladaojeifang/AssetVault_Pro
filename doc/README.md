# AssetVault Pro — 公开文档索引

本目录为 **GitHub 对外发布** 的开发者与用户文档。维护者专用材料（路线图、手测清单、个人脚本）在仓库根目录的 **`doc-internal/`**（已 gitignore，不推送）；首次克隆后运行 `node scripts/init-doc-internal.mjs`。

根目录 [README.md](../README.md) 为快速开始入口。

---

## 用户帮助

面向最终用户的使用说明（中文）：

| 文档 | 说明 |
|------|------|
| [help/index.md](./help/index.md) | 帮助中心目录 |
| [help/getting-started.md](./help/getting-started.md) | 快速入门 |
| [help/faq.md](./help/faq.md) | 常见问题 |

完整目录见 [help/index.md](./help/index.md)。

---

## 集成与 API

| 文档 | 说明 |
|------|------|
| [web-api-v1-guide.md](./web-api-v1-guide.md) | Web API 使用说明（curl、Playground） |
| [web-api-v1-design.md](./web-api-v1-design.md) | 技术设计 |
| [web-api-v1-openapi.yaml](./web-api-v1-openapi.yaml) | OpenAPI 3.1（中文） |
| [web-api-v1-openapi.en.yaml](./web-api-v1-openapi.en.yaml) | OpenAPI 3.1（英文） |
| [browser-extension.md](./browser-extension.md) | 浏览器扩展（独立仓库） |

运行时（应用已启动，默认端口 41596）：

- Playground：`http://127.0.0.1:41596/api/v1/playground/`
- OpenAPI：`http://127.0.0.1:41596/api/v1/docs/openapi.yaml`

---

## 架构与资产

| 文档 | 说明 |
|------|------|
| [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) | 代码架构总览 |
| [asset-types-and-import.md](./asset-types-and-import.md) | 资产类型、入库、伴随文件 |
| [thumbnail-pipeline.md](./thumbnail-pipeline.md) | 缩略图生成与缓存 |
| [library-import-from-library-spec.md](./library-import-from-library-spec.md) | 整库导入（LIM） |
| [library-import-catalog-to-catalog-spec.md](./library-import-catalog-to-catalog-spec.md) | 索引库→索引库导入 |
| [embedded-library-spec.md](./embedded-library-spec.md) | 内嵌库规格 |
| [exr-preview.md](./exr-preview.md) | OpenEXR 预览 |
| [node_type.md](./node_type.md) | AI 画布节点类型 |
| [AI_GATEWAY_SPEC.md](./AI_GATEWAY_SPEC.md) | AI 网关规格 |

---

## 测试

| 文档 | 说明 |
|------|------|
| [testing/README.md](../testing/README.md) | 测试目录与命令 |
| [testing/doc/strategy.md](../testing/doc/strategy.md) | 分层测试策略 |

---

## 示例脚本

| 文件 | 说明 |
|------|------|
| [examples/assetvault_api_import.py](./examples/assetvault_api_import.py) | Web API 导入入门 |
| [examples/ensure_tag_example.py](./examples/ensure_tag_example.py) | 创建/确保标签 |
| [examples/asset_update_notes_and_import_with_tag.py](./examples/asset_update_notes_and_import_with_tag.py) | 导入并打标签 |
| [examples/test_sourceUrl_api.py](./examples/test_sourceUrl_api.py) | sourceUrl 字段示例 |

---

## 维护约定

- 面向用户的 API 变更：更新 `web-api-v1-guide.md` 与 OpenAPI。
- 新增公开说明放在 `doc/` 并更新本索引。
- 规划、手测、个人脚本：放入 `doc-internal/`（见 [doc-internal.template/README.md](../doc-internal.template/README.md)）。
