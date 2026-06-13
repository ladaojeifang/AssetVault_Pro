# AssetVault Pro 帮助文档

欢迎使用 **AssetVault Pro** — 本地数字资产管理工具。

帮助你管理图片、视频、音频、字体、3D 模型、设计稿、文档与代码等资产。当前可导入 **150+** 种扩展名（以 `assetFormatCatalog.ts` 为准）。数据存储在本地，默认无需联网。

> **版本**：v0.5.0-alpha（`package.json`），部分功能仍在迭代。

---

## 文档目录

### 入门

| 文档 | 说明 |
|------|------|
| [快速入门](getting-started.md) | 安装、创建资料库、首次导入 |

### 核心功能

| 文档 | 说明 |
|------|------|
| [资产管理](asset-management.md) | 导入、浏览、搜索、筛选 |
| [资产详情面板](asset-details.md) | 信息、标签、备注、引用修复 |
| [资料库管理](library-management.md) | archive / catalog / embedded 与迁移 |
| [文件夹与标签系统](folders-tags.md) | 组织与筛选 |

### 预览与查看

| 文档 | 说明 |
|------|------|
| [预览功能](preview-features.md) | 3D、字体、SVG、EXR、Markdown 全页预览 |

### 高级功能

| 文档 | 说明 |
|------|------|
| [AI 画布](ai-canvas.md) | 节点式创作工作台（当前为 Mock 生成） |
| [Web API 与浏览器扩展](web-api.md) | HTTP API、扩展、URL/视频导入 |

### 设置与参考

| 文档 | 说明 |
|------|------|
| [设置系统](settings.md) | 五标签页设置项说明 |
| [快捷键速查](shortcuts.md) | 完整快捷键列表 |
| [常见问题](faq.md) | FAQ |

---

## 五分钟上手

1. 安装并启动 AssetVault Pro
2. 侧栏资料库切换器 → **新建资料库**，选择 **archive**，选定空文件夹
3. 拖入文件，或 `Ctrl+I` / `Ctrl+Shift+O` 导入
4. 侧栏创建文件夹、详情面板添加标签；拖放到侧栏文件夹时按住 **Alt**
5. 单选资产按 `Space` 看详情；**双击**进入全页预览（若格式支持）

设置：标题栏齿轮或 `Ctrl+,`。Web API 默认已开启（`http://127.0.0.1:41596/api/v1`）。

详细步骤见 [快速入门](getting-started.md)。
