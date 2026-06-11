# AssetVault 自动化测试方案

本文档定义 **AssetVault Pro（桌面端）** 与 **AssetVault Browser Extension（浏览器扩展）** 双仓库的自动化测试策略、分层、用例矩阵、CI 与分阶段落地计划。

**相关文档：**

| 文档 | 关系 |
|------|------|
| [asset-types-and-import.md](../../doc/asset-types-and-import.md) | 入库 / 格式矩阵 → L2 集成夹具设计 |
| [thumbnail-pipeline.md](../../doc/thumbnail-pipeline.md) | 缩略图异步管线 → L1/L2 用例 |
| [web-api-v1-openapi.yaml](../../doc/web-api-v1-openapi.yaml) | Web API 契约真源 |
| [web-api-v1-guide.md](../../doc/web-api-v1-guide.md) | API 用法与 Playground |
| [exr-preview-manual-acceptance.md](../../doc/exr-preview-manual-acceptance.md) | EXR 手工验收（自动化补充，不替代） |
| 扩展 [cross-repo-workflow.md](../../../AssetVault_Browser_Extension/docs/cross-repo-workflow.md) | 契约同步与 `smoke:pro` |
| [testing/README.md](../README.md) | 测试目录入口与运行命令 |

---

## 1. 目标与原则

### 1.1 目标

1. **回归安全网**：格式 catalog、入库、资料库切换、Web API 等高频变更区有自动覆盖。
2. **跨端契约稳定**：Pro OpenAPI ↔ 扩展调用面 ↔ 运行时行为一致。
3. **快速反馈**：PR 门禁 < 10 分钟（不含 E2E）。
4. **可维护**：优先测纯函数与 handler；UI E2E 少而精。

### 1.2 原则

| 原则 | 说明 |
|------|------|
| 测试金字塔 | 约 70% 单元 / 20% 集成 / 10% E2E |
| 无 Electron 优先 | 能不启窗口就不启；能 mock yt-dlp/ffmpeg 就不调真二进制 |
| 表驱动 | registry、policy、MIME 矩阵用 `it.each` + 用例表 |
| 契约双端 | Pro：`routes` ↔ OpenAPI；扩展：`extension-api-surface` ⊆ OpenAPI |
| 夹具可提交 | 小文件进 git；大 EXR/视频放 gitignore，仅本地 integration |
|  flaky 零容忍 | E2E 禁止真实外网；轮询用固定 timeout + 明确断言 |

### 1.3 非目标（本方案 Phase 1–2 不做）

- AiCanvas 全节点 UI 自动化
- 全量视觉回归 / 截图 diff
- Hub 团队平台（见 [AssetVault_Hub_PRD_V1.0.md](./AssetVault_Hub_PRD_V1.0.md)）— 另立方案
- 性能压测与长时间 soak（单列后续）

---

## 2. 现状盘点（基线）

### 2.1 工具链

| 仓库 | 运行器 | 包含范围 | 静态门禁 |
|------|--------|----------|----------|
| **Pro** | Vitest 3 | L1：`testing/unit/**` `testing/gen/**`；L2：`testing/integration/**`（独立 config + Electron runner） | `typecheck` `lint` `i18n:check` `theme:gen` `openapi:check` `build` |
| **扩展** | Node `node:test` | `testing/unit/*.test.ts` | `typecheck` `build`；`pnpm test` 含 `contract:check` |

**Pro 配置要点：**

- `vitest.config.ts`：别名 `@` / `@main` / `@shared`；默认 **不含** integration（`TEST_INTEGRATION=1` 可临时包含）
- `vitest.integration.config.ts`：`fileParallelism: false`；`setupFiles: vitestIntegrationSetup.ts`
- `scripts/run-vitest-integration.mjs`：`ELECTRON_RUN_AS_NODE=1` 下跑 L2，匹配 `resources/better_sqlite3.node`

**npm scripts（Pro）：** `test` · `test:integration` · `test:all` · `test:ci`（无 integration）· `openapi:check`

**尚无：** GitHub Actions workflow；跨仓库一条命令（需本地或 CI matrix 分别 checkout）。

### 2.2 已有测试分布（Pro，约 40 unit + 7 integration）

| 领域 | 代表文件 | 覆盖程度 |
|------|----------|----------|
| 格式 / 预览 / 主题 / 快捷键 registry | `assetFormatRegistry*.test.ts` `assetPreviewRegistry.test.ts` `fileTypeVisualCatalog.test.ts` `themeRegistry.test.ts` `hotkeyRegistry.test.ts` | 较好 |
| EXR 管线 | `exrExrsDecoder*.test.ts` `exrPreview*.test.ts` `exrMetadata*.test.ts` | 较好 |
| 缩略图跳过 / 队列 | `thumbnailSkip.test.ts` `thumbnailJobs/runner.test.ts` | 中等 |
| Page video 策略 | `pageVideoUrlPolicy.test.ts` `pageVideoImportParse.test.ts` `ytdlpStderr.test.ts` | 中等（无真实 yt-dlp E2E） |
| 搜索 | `assetSearch.test.ts` | 有 |
| 整页拼接 | `fullPageStitchService.test.ts` | 有 |
| 内嵌库导入 | `embeddedAssetImport.test.ts` | 有 |
| **入库主路径** | `importSingleAsset.integration.test.ts` `assetImportFolder.integration.test.ts` | IMP-01～04 **已有** |
| **Web API handlers** | `webApiLibrary.integration.test.ts` `webApiAsset.integration.test.ts` | P0 **已有** |
| **资料库切换** | `librarySwitch.integration.test.ts` | LIB-02 **已有** |
| **OpenAPI 契约** | `openapiRoutes.contract.test.ts` + `scripts/check-openapi-routes.mjs` | **已有** |
| **Renderer / Electron E2E** | — | **缺失** |

### 2.3 已有测试分布（扩展，约 28 文件 / 126 tests）

扩展侧文档入口：[AssetVault_Browser_Extension/testing/README.md](../../../AssetVault_Browser_Extension/testing/README.md)、[testing/doc/strategy.md](../../../AssetVault_Browser_Extension/testing/doc/strategy.md)。

| 领域 | 代表文件 | 覆盖程度 |
|------|----------|----------|
| API 契约 | `api-contract.test.ts` + `contract:check` | 较好 |
| 主栏 / 媒体提取 | `main-column-*.test.ts` `media-inventory.test.ts` | 较好 |
| Board Saver | `board-saver-*.test.ts` | 较好 |
| Page video 客户端 | `page-video-import-*.test.ts` | 中等 |
| 整页会话 | `fullpage-session.test.ts` `fullpage-capture.test.ts` | 中等 |
| **扩展 + 运行中 Pro 联调** | `smoke-pro-api.mjs`（手动/可选） | 仅 app/info |

### 2.4 手工验收（补充，不替代自动化）

- EXR：[exr-preview-manual-acceptance.md](./exr-preview-manual-acceptance.md)
- 新功能发布前：资料库三模式 smoke、扩展 board-saver 在 2～3 个真实站点

---

## 3. 测试分层架构

```text
                    ┌─────────────────────────────────────┐
                    │  L3  E2E / 跨端联调（~10%）          │
                    │  Playwright Electron、smoke:pro+    │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │  L2  服务集成（~20%）                │
                    │  临时库 + import/API handler/会话    │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │  L1  单元 / 纯函数（~70%）           │
                    │  shared registry、policy、提取逻辑   │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │  L0  静态门禁（每次 PR）             │
                    │  typecheck lint i18n build contract  │
                    └─────────────────────────────────────┘
```

### 3.1 层级定义

| 层级 | Pro | 扩展 | 运行环境 |
|------|-----|------|----------|
| **L0** | typecheck, lint, i18n:check, theme:gen, build | typecheck, build, contract:check | CI，无 GUI |
| **L1** | Vitest 纯函数，无 DB/磁盘 | Node test，无 Chrome | CI，< 2 min |
| **L2** | Vitest + tmpdir + SQLite + handler | Mock fetch 序列 | CI，< 5 min |
| **L3** | Playwright `_electron` | 扩展加载 + 可选 Pro API | Nightly / release |

### 3.2 测试文件命名

| 模式 | 用途 | CI 默认 |
|------|------|---------|
| `*.test.ts` | 快速单元 / 轻集成 | ✅ 跑 |
| `*.integration.test.ts` | 依赖 native、大文件、ffmpeg | ⚠️ 仅 nightly 或 `TEST_INTEGRATION=1` |
| `*.e2e.test.ts` | Playwright / 真 Electron | ❌ nightly |

**Vitest 配置（已实现）：**

```typescript
// vitest.config.ts — 片段
test: {
  include: [
    'testing/unit/**/*.test.ts',
    'testing/gen/**/*.test.ts',
    ...(runIntegration ? ['testing/integration/**/*.test.ts'] : [])
  ],
  exclude: runIntegration ? [] : ['testing/integration/**']
}
```

---

## 4. 目录与夹具规范（Pro）

### 4.1 建议目录结构

```text
AssetVault_Pro/
  testing/
    README.md
    doc/strategy.md
    unit/                 # 镜像 src/（shared/、main/）
    integration/
    gen/
    fixtures/
      assets/             # 小文件，提交 git
      large/              # 大文件，gitignore
      libraries/
      api/
    helpers/
    e2e/
  src/                    # 业务代码，不含 *.test.ts
```

### 4.2 夹具大小限制

- 单文件 **< 100 KB** 方可提交 `testing/fixtures/assets/`。
- EXR / 大视频 / 4K 样张：放 `testing/fixtures/large/`（**.gitignore**），本地 `*.integration.test.ts` 使用。
- 生成类夹具（theme-fallback.css）用 `theme:gen` + CI `git diff --exit-code` 校验。

### 4.3 临时资料库 helper（L2 核心）

实现见 `testing/helpers/`：

| 文件 | 说明 |
|------|------|
| `withTempLibrary.ts` | `withTempLibrary('archive' \| 'catalog', fn)` 封装创建/关闭 DB 与目录删除 |
| `registerElectronMock.ts` | mock `electron.app.getPath` 等到临时 userData |
| `sampleAssets.ts` | `writeTempSamplePng()` 在库**外**写样例，避免 archive 硬链接 |
| `sqliteAvailable.ts` | `describe.skipIf(!canRunSqliteIntegrationTests())` |
| `vitestIntegrationSetup.ts` | 非 Electron 时 `AV_TEST_SKIP_CUSTOM_SQLITE=1` |

每个 L2 用例应：

1. `mkdtemp` 创建隔离目录（或由 `withTempLibrary` 代劳）  
2. 初始化 archive 或 catalog 库  
3. teardown 关闭 DB、`ThumbnailService` 解绑、删除目录（Windows 下带重试）  
4. **禁止**写用户真实 `~/Documents/AssetVault` 路径  
5. 集成套件使用 `pnpm run test:integration`（Electron Node）  

---

## 5. AssetVault Pro — 分功能测试矩阵

### 5.1 配置中心（catalog / registry）— L1 ★★★

**变更必跑**（与 [asset-types-and-import.md](../../doc/asset-types-and-import.md) 联动）：

| 模块 | 必测点 | 状态 |
|------|--------|------|
| `assetFormatCatalog` / `assetFormatRegistry` | 新扩展名 → fileType、MIME、dialog 过滤器 | 部分已有 |
| `assetPreviewRegistry` | 预览路由顺序、explorer 回退 | 已有 |
| `themeRegistry` + `theme:gen` | CSS 变量完整、FOUC 文件同步 | 已有 |
| `hotkeyRegistry` | chord 解析、ai-canvas 屏蔽 Delete | 已有 |
| `fileTypeVisualCatalog` | 8 类 fileType 明暗色非空 | ✅ |
| `getFileType` / `getFileTypeFromMime` | 扩展名优先 + FALLBACK_MIMES | 部分已有 |

**表驱动：** `assetFormatRegistry.matrix.test.ts` — 每个 catalog 成员至少 1 条分类断言（158 cases）。

### 5.2 资产入库 — L2 ★★★（最高优先级缺口）

| ID | 场景 | 断言要点 | 优先级 |
|----|------|----------|--------|
| IMP-01 | archive 单文件 jpg | `items/{id}/` 存在、DB `file_type=image`、hasThumbnail | P0 |
| IMP-02 | catalog 引用 png | `storageMode=referenced`、resolved 指向源路径 | P0 |
| IMP-03 | 不支持扩展名 | 跳过、无 DB 行 | P0 |
| IMP-04 | 同路径重复导入 | skipped duplicate | P1 |
| IMP-05 | SHA-256 重复 + ask | 弹窗 mock / policy 分支 | P1 |
| IMP-06 | 文件夹递归 | 仅白名单扩展名入库 | P1 |
| IMP-07 | OBJ + 同目录 MTL | 伴随复制（archive） | P1 |
| IMP-08 | SVG 超 raster 上限 | 缩略图跳过策略 | P1 |
| IMP-09 | data URL 导入 | MIME + 落盘 | P2 |
| IMP-10 | URL 导入（mock fetch） | remote-imports 路径 | P2 |

**实现锚点：** `importSingleAsset.ts` `assetImportService.ts` `embeddedAssetImport.ts`

### 5.3 资料库与切换 — L2 ★★★

| ID | 场景 | 断言要点 | 优先级 |
|----|------|----------|--------|
| LIB-01 | 创建 archive / catalog / embedded | library.json 结构 | P0 |
| LIB-02 | switch A → B | 资产列表切换、无抛错 | P0 |
| LIB-03 | switching 期间 get-thumbnail | 返回 null，不抛 Database not initialized | P0 |
| LIB-04 | FileWatcher switching | 忽略 chokidar 事件 | P1 |
| LIB-05 | 从其它库导入 LIM | 计数与 tag 合并 | P2 |

**实现锚点：** `librarySwitch.ts` `db/index.ts` `isDatabaseReady()`

### 5.4 缩略图管线 — L1/L2 ★★

| ID | 场景 | 层级 | 状态 |
|----|------|------|------|
| TH-01 | 图片 @napi-rs 直解 | L2 | 待建 |
| TH-02 | ffmpeg 栅格 tiff/heic | L2 integration | 待建 |
| TH-03 | SVG raster 跳过 | L1 | 已有 skip |
| TH-04 | 3D glb 异步 job | L2 mock bridge | 部分 runner |
| TH-05 | 字体 / 文本预览 | L2 | 部分 |
| TH-06 | EXR 缩略图 | L1/integration | 已有 |
| TH-07 | embedded DCC extract | L2 | 部分 |

详见 [thumbnail-pipeline.md](../../doc/thumbnail-pipeline.md)。

### 5.5 预览与 UI 路由 — L1 + 少量 L3

| ID | 场景 | 层级 |
|----|------|------|
| PRV-01 | `resolveAssetOpenAction` 全类型 | L1 ✅ |
| PRV-02 | double-click → 全页预览 / explorer | L3 |
| PRV-03 | SVG / EXR / MD / 3D / font 各 1 | L3 |
| PRV-04 | 主题明/暗 `--av-bg-primary` 变化 | L3 |

**实现锚点：** `assetPreviewRegistry.ts` `openAssetPreview.ts`

### 5.6 文件夹 / 标签 / 搜索 — L2

| ID | 场景 | 优先级 |
|----|------|--------|
| FLD-01 | 创建 / 重命名 / 删除文件夹 | P1 |
| FLD-02 | 资产拖入文件夹 | P2 |
| TAG-01 | CRUD + assign/remove | P1 |
| SRH-01 | 关键词 + fileType 筛选 | P1（部分已有 assetSearch） |

### 5.7 Web API v1 — L2 ★★★

**测试方式：** 不监听真实端口；构造 `ApiRequestContext`，直接调用 `matchRoute` → handler。

**静态契约（L0 已实现）：**

```text
scripts/check-openapi-routes.mjs
  ← listApiDynamicRoutes() / listAllApiRouteOperations()
  ↔ doc/web-api-v1-openapi.yaml paths
```

命令：`pnpm run openapi:check`（已纳入 `test:all` 与 `test:ci`）。

#### 5.7.1 路由清单（实现真源：`src/main/api/routes/index.ts`）

| 分组 | 方法 | 路径 | 最小集成用例 |
|------|------|------|--------------|
| App | GET | `/api/v1/app/info` | features 含 session 标志 |
| Library | GET | `/api/v1/library/info` | P0 |
| Library | GET | `/api/v1/library/state` | P0 |
| Library | POST | `/api/v1/library/switch` | 非法 id → 4xx | P0 |
| Library | POST | `/api/v1/library/importFromLibrary` | P2 |
| Asset | GET/POST | `/api/v1/asset/get` | P0 |
| Asset | GET | `/api/v1/asset/info` | P0 |
| Asset | POST | `/api/v1/asset/import` | IMP-01 等价 | P0 |
| Asset | POST | `/api/v1/asset/importFromURL` | mock | P1 |
| Asset | POST | `/api/v1/asset/importFromDataUrl` | P1 |
| Asset | POST | `/api/v1/asset/importBatch` | P1 |
| Asset | POST | `/api/v1/asset/importFolder` | P1 |
| Asset | POST | `/api/v1/asset/importFromURLBatch` | P2 |
| Asset | POST | `/api/v1/asset/fetchRemoteBody` | mock | P2 |
| Asset | DELETE | `/api/v1/asset/delete` | P0 |
| Asset | PATCH | `/api/v1/asset/update` | P1 |
| Asset | POST | `/api/v1/asset/rename` | P1 |
| Asset | POST | `/api/v1/asset/relink` | P1 |
| Asset | POST | `/api/v1/asset/localize` | catalog | P1 |
| FullPage | POST | `.../fullPageSession/start` | P1 |
| FullPage | POST | `.../append` | P1 |
| FullPage | POST | `.../finish` | P1 |
| FullPage | GET/DELETE | `.../fullPageSession/{id}` | P1 |
| ArticleBundle | POST | `.../articleBundleSession/start` | P1 |
| ArticleBundle | POST | `.../append` / `finish` | P1 |
| ArticleBundle | GET/DELETE | `.../articleBundleSession/{id}` | P1 |
| PageVideo | POST | `.../pageVideoImport` | mock ytdlp | P1 |
| PageVideo | POST | `.../pageVideoImport/batch` | P1 |
| PageVideo | GET | `.../pageVideoImport/batch/{id}` | P1 |
| PageVideo | GET/DELETE | `.../pageVideoImport/jobs/{id}` | P1 |
| Folder | GET/POST/PATCH/DELETE | `/api/v1/folder/*` | 各 1 | P1 |
| Tag | GET/POST/PATCH/DELETE | `/api/v1/tag/*` | 各 1 | P1 |

**错误格式：** 所有 handler 返回 JSend `status: success|error` — 集成测试断言 `code` 字段（见 `src/main/api/errors.ts`）。

### 5.8 IPC（Renderer ↔ Main）— L2 抽样

IPC 面大（`preload/index.ts` → `ipcMain.handle`）。**不全测**；按风险抽样：

| 优先级 | Channel 区 | 测法 |
|--------|------------|------|
| P0 | `assets:import` `assets:delete` `library:switch` | L2 经 service 已覆盖则可跳过重复 |
| P1 | `assets:get-thumbnail` switching 行为 | mock DB ready |
| P2 | `folders:*` `tags:*` | 与 Web API 重叠处测 API 即可 |

### 5.9 i18n / 主题 / 快捷键 — L0 + L1

| 检查 | 命令 / 测试 |
|------|-------------|
| 中英文 key 对称 | `pnpm run i18n:check` |
| 快捷键 catalog ↔ 设置页 | `hotkeyRegistry` + 设置页渲染 snapshot（可选） |
| theme-fallback 同步 | `pnpm run theme:gen && git diff --exit-code` |

### 5.10 Page Video Import（yt-dlp）— L1 + mock L2

| 层级 | 内容 | 状态 |
|------|------|------|
| L1 | parse、stderr 分类、URL policy、format policy | 已有 |
| L2 | `pageVideoImportService` mock `ytdlpRunner` | 待建 |
| L3 | 真实下载 | **禁止进 CI**；仅本地 manual |

脚本参考：`scripts/page-video-import-smoke.ps1`（手工冒烟）。

### 5.11 AiCanvas — 低优先级

| 范围 | 建议 |
|------|------|
| `modeConfigCatalog` 纯函数 | L1 可选 |
| Babylon 渲染 | 不自动化；manual |
| AI Gateway | 未来 mock HTTP |

---

## 6. Browser Extension — 测试矩阵

### 6.1 L0 门禁

```bash
pnpm run typecheck
pnpm test          # 含 contract:check
pnpm run build
```

### 6.2 L1 单元（保持并扩展）

| 领域 | 文件模式 | 说明 |
|------|----------|------|
| 契约 | `api-contract.test.ts` | extension-api-surface ⊆ OpenAPI |
| 主栏提取 | `main-column-*.test.ts` | 规则引擎、lazy image |
| Board Saver | `board-saver-*.test.ts` | 扫描、过滤、导入状态机 |
| Video URL | `video-page-url-*.test.ts` | 规则与 resolve |
| Page video API 客户端 | `page-video-import-*.test.ts` | 错误码、cookie 策略 |
| 整页 | `fullpage-*.test.ts` | 会话状态、长页 capture |

### 6.3 L2 Mock HTTP

| ID | 场景 | 方法 |
|----|------|------|
| EXT-01 | articleBundle start→append→finish 请求体 | mock `fetch` 序列 |
| EXT-02 | pageVideoImport create→poll job | mock |
| EXT-03 | importFromURL 错误映射 | 断言 notify 文案 key |
| EXT-04 | contract:sync 后 generated types 可选对照 | P2 |

### 6.4 L3 扩展 E2E（可选 Phase 3）

工具：**Playwright** + `--load-extension` 或 **@playwright/test** chromium launch args。

| ID | 场景 |
|----|------|
| E2E-E01 | 打开 `test/pages/sample-gallery.html` → board-saver 扫描到 N 项 |
| E2E-E02 | popup 连接 Pro（需 mock 或 test server） |

### 6.5 与 Pro 联调

| 命令 | 作用 |
|------|------|
| `pnpm run contract:sync` | 拉 Pro OpenAPI |
| `pnpm run contract:check` | 调用面 ⊆ OpenAPI |
| `pnpm run smoke:pro` | 运行中 Pro `GET /app/info` |

**待建：** `scripts/cross-repo-api-smoke.mjs` — 扩展仓库调用 Pro 5～10 个关键端点（需 `ASSETVAULT_API_BASE`）。

---

## 7. 跨仓库契约流

```text
  Pro 改 API
      │
      ├─► 更新 web-api-v1-openapi.yaml + guide
      ├─► 跑 scripts/check-openapi-routes.mjs（待建）
      │
      ▼
  扩展 pnpm run contract:sync
      │
      ├─► 改 src/shared/* 调用
      ├─► 更新 extension-api-surface.json（非 probe 端点）
      └─► pnpm run contract:check
              │
              ▼
  本地 / nightly：Pro 启动 + smoke:pro + cross-repo-api-smoke
```

**Probe 端点**（如 capability probe）在 `extension-api-surface.json` 标 `probe: true`，跳过 OpenAPI 存在性检查 — 见 [cross-repo-workflow.md](../../AssetVault_Browser_Extension/docs/cross-repo-workflow.md)。

---

## 8. CI/CD 设计

### 8.1 工作流总览

| Workflow | 仓库 | 触发 | 内容 |
|----------|------|------|------|
| `pro-fast.yml` | Pro | push / PR | L0 + L1（exclude integration） |
| `extension-fast.yml` | Extension | push / PR | L0 + L1 |
| `cross-smoke.yml` | Extension + Pro | nightly / workflow_dispatch | 启动 Pro + smoke |
| `pro-e2e.yml` | Pro | nightly / release | Playwright 黄金路径 |

### 8.2 Pro fast job（示例）

```yaml
# .github/workflows/pro-fast.yml（待添加）
name: Pro Fast
on: [push, pull_request]
jobs:
  test:
    runs-on: windows-latest   # Electron 原生模块与路径行为
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm run typecheck
      - run: pnpm run lint
      - run: pnpm run i18n:check
      - run: pnpm run theme:gen
      - run: git diff --exit-code src/renderer/src/styles/theme-fallback.css
      - run: pnpm exec vitest run --exclude '**/*.integration.test.ts'
      - run: pnpm run build
      # - run: node scripts/check-openapi-routes.mjs  # 待建
```

### 8.3 Extension fast job（示例）

```yaml
name: Extension Fast
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm run typecheck
      - run: pnpm test
      - run: pnpm run build
```

### 8.4 npm scripts（Pro，已实现）

| 脚本 | 命令 |
|------|------|
| `test` | `vitest run`（unit + gen，不含 integration） |
| `test:unit` | `vitest run testing/unit testing/gen` |
| `test:integration` | `node scripts/run-vitest-integration.mjs`（**Electron Node**） |
| `test:integration:node` | `vitest run --config vitest.integration.config.ts`（SQLite 可能 skip） |
| `test:all` | `test` + `theme:gen` + `openapi:check` + `test:integration` |
| `test:ci` | `theme:gen` + `test` + `openapi:check`（**不含** integration，适合 PR） |
| `test:watch` | `vitest` |
| `theme:gen` | `vitest run testing/gen/themeFallback.gen.test.ts` |
| `test:e2e` | `playwright test`（待建） |
| `openapi:check` | `node scripts/check-openapi-routes.mjs` |

---

## 9. E2E 黄金路径（Pro，≤ 10 条）

工具：**Playwright** `@playwright/test` + `_electron.launch({ args: ['.'] })` 或 electron-vite 构建产物。

| # | 步骤 | 断言 |
|---|------|------|
| E2E-01 | 启动应用 | 无 Renderer Error；主网格区域存在 |
| E2E-02 | 导入 `sample.jpg` | 网格出现 1 项；缩略图非空 |
| E2E-03 | 双击 jpg | 详情或预览打开 |
| E2E-04 | 导入 `sample.md` 并双击 | Markdown 全页预览 |
| E2E-05 | 新建文件夹 | 侧栏树节点出现 |
| E2E-06 | 搜索文件名 | 列表过滤 |
| E2E-07 | 切换浅色主题 | `data-theme=light` |
| E2E-08 | 资料库 A → B 切换 | 无控制台 Database 错误 |
| E2E-09 | 设置 → 快捷键 | 中文/英文 label 可见 |
| E2E-10 | 启用 Web API | curl app/info 200 |

**前置：** `testing/fixtures/libraries/empty-archive` 或 beforeAll 创建临时库。

---

## 10. 分阶段落地计划

### Phase 0 — 文档与基线

- [x] `testing/doc/strategy.md`（原 `doc/testing-strategy.md` 已迁入 `testing/`）
- [x] `testing/README.md` + `doc/README.md` 索引链接
- [x] 扩展 `testing/README.md` + `testing/doc/strategy.md`

### Phase 1 — 门禁 + 入库

| 任务 | 产出 | 状态 |
|------|------|------|
| 添加 `pro-fast.yml` / `extension-fast.yml` | CI 绿 | 待建 |
| `testing/fixtures/assets/*` | 小文件夹具 | 部分 |
| `testing/helpers/withTempLibrary.ts` 等 | L2 基建 | ✅ |
| `importSingleAsset.integration.test.ts` | IMP-01～04 | ✅ |
| `fileTypeVisualCatalog` 单测 | 1 文件 | ✅ |
| `assetFormatRegistry.matrix.test.ts` | 表驱动矩阵 | ✅ |

### Phase 2 — Web API + 资料库

| 任务 | 产出 | 状态 |
|------|------|------|
| `scripts/check-openapi-routes.mjs` | L0 契约 | ✅ |
| `webApi*.integration.test.ts` | Asset + Library P0 | ✅ |
| `librarySwitch.integration.test.ts` | LIB-02～03 | ✅ |
| Electron integration runner | SQLite 不 skip | ✅ |
| 扩展 `cross-repo-api-smoke.mjs` | 多端点 smoke | 待建 |

### Phase 3 — 会话 + 缩略图（约 1 周）

| 任务 | 产出 |
|------|------|
| fullPage / articleBundle 各 1 条流 | API integration |
| pageVideoImport mock runner | PVI-01 |
| TH-01 图片缩略图 L2 | 1 用例 |

### Phase 4 — E2E + Nightly（约 1 周）

| 任务 | 产出 |
|------|------|
| Playwright 配置 | `e2e/` 目录 |
| E2E-01～05 | nightly workflow |
| `pro-e2e.yml` | release 前手动可触发 |

---

## 11. 质量指标与完成定义

### 11.1 Phase 1 完成定义

- PR 必过 `pro-fast` + `extension-fast`
- IMP-01～03 集成测试稳定（Windows CI 10 次无 flaky）
- OpenAPI routes 检查脚本存在（可与 Phase 2 合并）

### 11.2 Phase 2 完成定义

- Web API P0 路由集成覆盖率 100%（每条至少 happy path 或 expected error）
- `librarySwitch` 竞态有回归测试

### 11.3 长期指标（建议）

| 指标 | 目标 |
|------|------|
| `src/shared` 语句覆盖 | > 80% |
| `src/main/services/import*` 分支覆盖 | > 60% |
| CI median 时长 | < 8 min |
| Nightly E2E 通过率 | > 95% |

使用 Vitest `--coverage`（`@vitest/coverage-v8`）在 Phase 2 后启用，不阻塞 Phase 1。

---

## 12. 风险与对策

| 风险 | 对策 |
|------|------|
| better-sqlite3 / native 模块 CI 编译失败 | windows-latest + `pnpm run rebuild:native` |
| ffmpeg / yt-dlp 不可用 | integration 标记 + mock；CI 不装 |
| Electron E2E flaky | 少测；固定 viewport；禁用动画 |
| 双仓库 OpenAPI 漂移 | contract:sync 进扩展 CI；Pro openapi:check |
| 夹具二进制过大 | 小夹具 + gitignore large |

---

## 13. 维护约定

1. **新增 `assetFormatCatalog` 扩展名** → 更新 `assetFormatRegistry.test.ts` 矩阵。  
2. **新增 Web API 路由** → 同步 OpenAPI + handler 集成 + 扩展 surface。  
3. **新增全页预览类型** → `assetPreviewCatalog` + `assetPreviewRegistry.test.ts`。  
4. **新增快捷键** → `hotkeyCatalog.ts` + `settings.json` shortcuts.items + i18n:check。  
5. **Bug 修复** → 先写 failing test，再修（库切换类问题已示范）。  

---

## 14. 附录 A — 现有测试文件索引（Pro）

<details>
<summary>点击展开（便于检索缺口）</summary>

**unit/shared：** appLocale, assetFormatRegistry, assetFormatRegistry.matrix, assetPreviewRegistry, asyncThumbnailAsset, exrAovDisplay, exrChannelBudget, exrDefaultLayer, exrLayerGrouping, exrPreviewErrors, ffmpegRasterImageFormats, fileTypeVisualCatalog, hotkeyRegistry, pageVideoFormatPolicy, pageVideoUrlPolicy, themeRegistry, thumbnailPipelineConfig  

**unit/main：** assetSearch, canvasRenderQueue, embeddedAssetImport, exrExrsDecoder, exrPreviewCache, exrPreviewRender, exrThumbnailRender, fullPageStitchService, hiddenOffscreenThumbHost, libraryDisplayName, libraryRecent, openapiRoutes.contract, pageVideoImportParse, pageVideoImport/ytdlpBinary, pageVideoImport/ytdlpStderr, textPreviewThumbnail/*, thumbnailGraphicsGate, thumbnailJobs/runner, thumbnailRead, thumbnailSkip, exrMetadata  

**integration：** importSingleAsset, assetImportFolder, librarySwitch, webApiLibrary, webApiAsset, exrExrsDecoder, exrMetadata  

**gen：** themeFallback.gen  

</details>

## 15. 附录 B — 现有测试文件索引（扩展）

<details>
<summary>点击展开</summary>

api-contract, board-saver-*, concurrency, data-url-import, fullpage-*, image-*, main-column-*, media-inventory, page-video-import-*, video-page-url-*, wechat-page-data  

</details>

---

*文档版本：2026-06-05 · L2 集成（328+19 tests）、openapi:check、Electron integration runner 已落地*
