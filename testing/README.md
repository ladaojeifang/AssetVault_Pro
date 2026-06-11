# AssetVault Pro — 测试目录

本目录集中存放**测试文档、用例、夹具与辅助代码**，与 `src/` 业务代码分离。`src/` 下不再放置 `*.test.ts`。

```text
testing/
  README.md              ← 本文件（入口）
  doc/
    strategy.md          ← 双仓库自动化测试方案（分层、矩阵、CI）
  fixtures/
    assets/              可提交的小样例（< 100 KB）
    large/               大 EXR/视频（gitignore，仅本地）
  helpers/               测试专用 helper（mock、临时库）
  unit/                  L1 单元测试（镜像 src/ 结构）
  integration/           L2 集成测试（SQLite、handler、native）
  gen/                   代码生成校验（theme-fallback.css）
  e2e/                   Playwright E2E（占位，待建）
```

**相关文档：** [doc/strategy.md](./doc/strategy.md) · [doc/README.md](../doc/README.md) · 扩展侧 [cross-repo-workflow.md](../../AssetVault_Browser_Extension/docs/cross-repo-workflow.md)

---

## 快速运行

在仓库根目录执行：

| 命令 | 说明 | 典型耗时 |
|------|------|----------|
| `pnpm test` | L1：`testing/unit/**` + `testing/gen/**`（**不含** integration） | ~2s |
| `pnpm run test:unit` | 同 `pnpm test` | ~2s |
| `pnpm run test:watch` | Vitest watch | — |
| `pnpm run test:integration` | L2：仅 `testing/integration/**`，**Electron Node** 下跑（SQLite 可用） | ~12s |
| `pnpm run test:integration:node` | 同上，但用本机 Node；SQLite 用例可能 **skip** | 视环境 |
| `pnpm run test:ci` | PR 门禁：`theme:gen` + `test` + `openapi:check` | ~5s |
| `pnpm run test:all` | `test` + `theme:gen` + `openapi:check` + `test:integration` | ~25s |
| `pnpm run theme:gen` | 从 theme catalog 生成 `theme-fallback.css` | <1s |
| `pnpm run openapi:check` | 运行时路由 ↔ `doc/web-api-v1-openapi.yaml` | ~2s |

**当前基线（本地）：** 328 条单元 + 19 条集成（7 个 integration 文件）。

---

## 分层说明

| 层级 | 目录 / 命令 | 环境要求 |
|------|-------------|----------|
| **L0** | `typecheck` `lint` `i18n:check` `build` `openapi:check` `theme:gen` | 无 GUI |
| **L1** | `testing/unit/` `testing/gen/` → `pnpm test` | Node / Vitest |
| **L2** | `testing/integration/` → `pnpm run test:integration` | **Electron Node** + `better_sqlite3` |
| **L3** | `testing/e2e/`（待建） | Playwright + Electron |

L2 **不要**与 L1 混在同一个 Vitest 进程里并行跑大量用例：集成配置已设 `fileParallelism: false`，避免 Windows 临时库删除竞态。

---

## SQLite 与 Electron 集成

桌面端打包的 `resources/better_sqlite3.node` 与 **Electron ABI** 绑定。本机 Node 24 等版本无法直接加载，会导致集成测试 skip。

**推荐：** 始终用 `pnpm run test:integration`（内部执行 `scripts/run-vitest-integration.mjs`）：

- 设置 `ELECTRON_RUN_AS_NODE=1`
- 清除 `AV_TEST_SKIP_CUSTOM_SQLITE`
- 使用 Electron 自带的 Node 跑 Vitest

`testing/helpers/vitestIntegrationSetup.ts` 会在**非 Electron** 环境下设置 `AV_TEST_SKIP_CUSTOM_SQLITE=1`，让 `betterSqliteNative.ts` 回退到 npm 预编译绑定（若 ABI 仍不匹配则 skip）。

若 plain Node 下仍 skip，可尝试 `pnpm run rebuild:native`（仅当你明确要在本机 Node 跑集成时）。

---

## helpers

| 文件 | 用途 |
|------|------|
| `registerElectronMock.ts` | integration 首行 import：mock `electron`、导入通知、`FileWatcher` |
| `withTempLibrary.ts` | 临时 archive/catalog 资料库 + `initDatabase` / teardown |
| `sampleAssets.ts` | `writeSamplePng()`、`writeTempSamplePng()`（库外路径，避免硬链接干扰） |
| `sqliteAvailable.ts` | `canRunSqliteIntegrationTests()` — 检测 native SQLite 是否可加载 |
| `vitestIntegrationSetup.ts` | Vitest integration setup：非 Electron 时跳过自定义 `.node` |

### L2 用例模板

```typescript
import { canRunSqliteIntegrationTests } from '../../helpers/sqliteAvailable'
import '../../helpers/registerElectronMock'
import { describe, it, expect } from 'vitest'
import { withTempLibrary } from '../../helpers/withTempLibrary'
import { writeTempSamplePng } from '../../helpers/sampleAssets'

describe.skipIf(!canRunSqliteIntegrationTests())('my feature integration', () => {
  it('does something with a real DB', async () => {
    await withTempLibrary('archive', async () => {
      const filePath = writeTempSamplePng('sample.png')
      // call service or handler ...
    })
  })
})
```

---

## 约定

### 路径与 import

- **镜像 `src/`：** `testing/unit/shared/foo.test.ts` 测 `src/shared/foo.ts`
- **别名：** 使用 `@/`、`@main/`、`@shared/`，勿 `../../src/...` 指向业务文件
- **命名：** `*.test.ts` = L1；`*.integration.test.ts` = L2

### 夹具

- 单文件 **< 100 KB** → `testing/fixtures/assets/`（可提交）
- 大 EXR、长视频 → `testing/fixtures/large/`（**.gitignore**）
- 解析路径：`join(import.meta.dirname ?? __dirname, '../../fixtures/assets/...')` 或 Vitest 下相对 `testing/unit/`

### 配置

| 文件 | 作用 |
|------|------|
| `vitest.config.ts` | 默认 L1；`TEST_INTEGRATION=1` 时可临时包含 integration |
| `vitest.integration.config.ts` | 仅 L2；`setupFiles` + `fileParallelism: false` |

---

## 已有用例索引（摘要）

### L1 单元（`testing/unit/`，40 文件）

| 领域 | 代表文件 |
|------|----------|
| 格式 / registry | `assetFormatRegistry.test.ts` `assetFormatRegistry.matrix.test.ts` `assetPreviewRegistry.test.ts` `fileTypeVisualCatalog.test.ts` |
| 主题 / 快捷键 / i18n | `themeRegistry.test.ts` `hotkeyRegistry.test.ts` `appLocale.test.ts` |
| EXR | `exrExrsDecoder.test.ts` `exrPreviewRender.test.ts` `exrThumbnailRender.test.ts` `exrMetadata.test.ts` + shared `exr*` |
| 缩略图 / 文本预览 | `thumbnailSkip.test.ts` `thumbnailJobs/runner.test.ts` `textPreviewThumbnail/*` |
| Page video 策略 | `pageVideoUrlPolicy.test.ts` `pageVideoImportParse.test.ts` `ytdlpStderr.test.ts` |
| 资料库展示 | `libraryDisplayName.test.ts` `libraryRecent.test.ts` `embeddedAssetImport.test.ts` |
| Web API 契约 | `main/api/openapiRoutes.contract.test.ts` |
| 其它 | `assetSearch.test.ts` `fullPageStitchService.test.ts` `canvasRenderQueue.test.ts` … |

### L2 集成（`testing/integration/`，7 文件 / 19 用例）

| 文件 | 覆盖 ID |
|------|---------|
| `importSingleAsset.integration.test.ts` | IMP-01 / IMP-02 / IMP-04 |
| `assetImportFolder.integration.test.ts` | IMP-03 |
| `librarySwitch.integration.test.ts` | LIB-02 |
| `webApiLibrary.integration.test.ts` | 库 info/state、API import、LIB-03 |
| `webApiAsset.integration.test.ts` | import→info→get→delete、library/switch 错误 |
| `exrExrsDecoder.integration.test.ts` | EXR 多层 / 缩略图对齐 |
| `exrMetadata.integration.test.ts` | EXR 元数据 |

完整矩阵与待补项见 [doc/strategy.md](./doc/strategy.md)。

---

## 新增测试 checklist

1. 在 `testing/unit/` 或 `testing/integration/` 按 `src/` 镜像路径新建文件
2. L2 首行 `import '../../helpers/registerElectronMock'`（相对深度按目录调整）
3. 需要 DB 时用 `withTempLibrary` + `describe.skipIf(!canRunSqliteIntegrationTests())`
4. 导入样例优先 `writeTempSamplePng()`（库外），避免 archive 硬链接与删除竞态
5. 新增 **Web API 路由** → 同步 `doc/web-api-v1-openapi.yaml` → `pnpm run openapi:check` → 扩展 `contract:sync`
6. 新增 **catalog 扩展名** → 更新 `assetFormatRegistry.matrix.test.ts`

---

## 常见问题

**Q: `test:integration` 里 SQLite 测试被 skip？**  
用 `pnpm run test:integration`（Electron），不要用 `test:integration:node`，除非已 `rebuild:native` 且 ABI 匹配。

**Q: Windows 上 `ENOTEMPTY` / `EPERM` 删临时库？**  
集成已串行 + teardown 重试。若仍失败，检查是否有未 `await` 的异步文件 IO（例如第三方库返回 Promise 的路径 API）。

**Q: 扩展的测试在这里跑吗？**  
**不。** 扩展是独立仓库：`AssetVault_Browser_Extension/testing/`，命令为 `pnpm test`（Node `node:test` + `contract:check`）。

**Q: 一条命令跑两端？**  
两仓库分开执行；本地可：`cd Pro && pnpm run test:all && cd ../AssetVault_Browser_Extension && pnpm test`。

---

*最后更新：2026-06-05*
