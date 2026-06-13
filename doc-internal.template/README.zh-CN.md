# 本地维护文档（`doc-internal/`）

> **English:** [README.md](./README.md)

仓库根目录下的 **`doc-internal/`** **不会推送到 GitHub**，已在 `.gitignore` 中忽略。

与公开文档的分工：

| 位置 | 受众 | 内容 |
|------|------|------|
| [doc/help/](../doc/help/index.md) | 最终用户 | 安装、使用、设置、FAQ（中文，随公开仓库发布） |
| [doc/](../doc/README.md) | 开发者 / 集成方 | Web API、架构、资产规格、OpenAPI |
| **`doc-internal/`** | 维护者本人 | 路线图、手测清单、修复计划、个人脚本与参考笔记 |

适合放在 `doc-internal/` 的内容：

- 产品路线图与商业规划（PRD、Hub、开发计划）
- 手测 / 冒烟测试清单
- 修复方案与内部验收记录
- 个人 Web API 示例与本地验证脚本
- 第三方产品参考笔记（如 Eagle 导入流程、资源包格式等）

## 首次初始化

在仓库根目录执行：

```bash
node scripts/init-doc-internal.mjs
```

脚本会：

1. 创建 `doc-internal/`，并将清单中的内部文件从公开目录复制过来
2. 从**公开仓库**的 git 索引中移除这些路径（文件仍保留在 `doc-internal/` 下）
3. 在 `doc-internal/` 内初始化**嵌套 git 仓库**，便于单独做本地版本管理

## 日常流程

| 任务 | 操作 |
|------|------|
| 编辑内部文档 | 在 `doc-internal/` 下修改 |
| 仅提交内部文档 | `cd doc-internal && git add . && git commit -m "..."` |
| 推送公开仓库 | `git push origin main`（pre-push 钩子会拦截误含内部路径的提交） |
| 拉取公开仓库后同步 | 若 `init-doc-internal.mjs` 清单有变，重新执行初始化脚本 |

## 目录结构（初始化后）

```text
doc-internal/
├── README.md              # 英文说明（由 doc-internal.template 复制）
├── README.zh-CN.md        # 中文说明（本文件）
├── planning/              # PRD、DEVELOPMENT_PLAN、Hub 规划
├── maintenance/           # 修复计划、i18n 清单、手动验收记录
├── regression/            # 手测 / 冒烟清单（来自 doc-internal.template/regression/）
├── references/            # 第三方参考（如 eagle 文件处理、资源包、eagle 插件探索）
├── examples/              # 个人导入脚本、标签示例等
└── scripts/               # catalog merge 冒烟、远程 import 引用检查等
```

可在各子目录下自由新增文件；新增内容默认只存在于本地嵌套仓库，不会进入公开推送。

## 注意事项

- **不要**从 `.gitignore` 中移除 `doc-internal/`，除非你明确打算公开发布这些内容。
- 公开仓库的文档索引见 [doc/README.md](../doc/README.md)；用户帮助见 [doc/help/index.md](../doc/help/index.md)。
- 推送公开仓库前可手动运行 `node scripts/verify-push-safe.mjs` 做安全检查。
