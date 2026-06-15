# 从其它资料库导入 — 规格与开发计划

> **状态**：V1 已实现（`importLibraryFromPath`、设置面板、Web API）  
> **版本**：V1（整库一次性导入 · 完整库 archive）  
> **关联**：可搬运库结构见 [AssetVault_Pro_PRD_V1.0.md](./AssetVault_Pro_PRD_V1.0.md) §4.4；去重见 `contentHashService` / `importSingleAsset`

---

## 1. 背景与目标

用户常有两个（或多个）**完整库（archive）**，希望合并到当前库，并保留：

- 文件夹树
- 标签及资产关联
- **用户分类**（`categories`）及资产的 `type_id`
- 文件内容（去重，不重复占盘）
- **来源可追溯**：为本次导入的资产打上「源库名称」标签

**「复制到其它资料库」**（`copyAssetsToOtherLibrary`）适用于在 UI 中**选中部分资产**跨库复制：会迁移文件夹、标签与 `type_id`，但**不做 SHA-256 去重**、不合并整库。整库合并请用本节「从其它资料库导入」流程。

**V1 目标**：在当前库 B 提供 **「从其它资料库导入…」**，选择源库 A 根目录，一次后台任务完成合并。

---

## 2. 范围

### 2.1 V1 包含

| 项 | 说明 |
|----|------|
| 源库类型 | 仅 **archive**（`manifest.libraryMode === 'archive'`） |
| 导入粒度 | **整库**（A 内全部资产） |
| 元数据 | 文件夹树、`tags`、`categories`、`asset_folders`、`asset_tags`、资产 `type_id`、notes 等（见 §5） |
| 文件 | 从 A 的 `items/{id}/` 拷贝到 B；缩略图一并处理 |
| 去重 | 按 **SHA-256 content_hash**（与单文件导入一致） |
| 源库 tag | 以 A 的 `displayName`（fallback 文件夹名）为 tag 名，写入 B 并关联到本批触及的资产 |
| 入口 | **设置 → 资料库** 面板按钮 |
| 进度 | IPC 推送 + 可取消（可选 V1.1） |
| API | `POST /api/v1/library/importFromLibrary`（异步 job + 轮询或 SSE 简化为同步阻塞 + 进度仅 IPC，见 §8） |

### 2.2 V1 不包含

- 只导入 A 的部分文件夹（V2）
- catalog 索引库作为源库（V2）→ 见 [library-import-catalog-to-catalog-spec.md](./library-import-catalog-to-catalog-spec.md)（**仅 catalog A → catalog B 同机**）
- 导入前 UI 预览清单（V2）
- 重复项 notes 冲突合并策略 UI（V1 默认：不覆盖 B 已有 notes，仅补标签）
- 导入后自动删除或修改源库 A

---

## 3. 用户流程

```text
设置 → 资料库 → [从其它资料库导入…]
  → 选择源库根目录（须含 manifest.json + library.sqlite）
  → 确认对话框（源库名、资产约数、仅支持完整库）
  → 后台导入（进度：阶段 + current/total + 当前文件名）
  → 完成报告（新增 / 重复跳过 / 失败 / 文件夹·标签统计）
  → 刷新当前库列表与文件夹树
```

**前置条件**

- 当前已打开目标库 B，且为 **archive**
- 源库 A 已关闭写入（建议用户先退出对 A 的编辑；实现侧只读打开 A 的 SQLite）
- A 路径 ≠ B 路径

---

## 4. 源库名称 tag

| 规则 | 说明 |
|------|------|
| Tag 名 | `manifest.displayName`  trim；空则用源库文件夹 `basename` |
| 创建 | B 中 `tags.name` 精确匹配则复用，否则 `INSERT` 新 tag |
| 关联 | 对 **新创建** 的资产必打；对 **去重跳过** 的资产，给 B 中 **已有** 那条补 `asset_tags`（不重复插入） |
| 与 A 原 tag | **叠加**：A 原有 tag 仍按 §5.3 合并，源库 tag **额外**一条 |

---

## 5. 导入算法（主进程 `importLibraryFromPath`）

### 5.1 阶段概览

```text
validateSource → openSourceDb (readonly)
  → phaseTags
  → phaseCategories
  → phaseFolders
  → phaseAssets (per asset: dedupe | copy | link metadata)
  → phaseFinalize (folder counts, FTS/search, notify UI)
  → report
```

### 5.2 校验 `validateSource`

- 路径存在且为目录
- 存在 `{sourceRoot}/manifest.json`、`{sourceRoot}/library.sqlite`
- `libraryMode === 'archive'`（否则 `INVALID_SOURCE_MODE`）
- `sourceRoot` 规范化后 ≠ `getLibraryRoot()`
- 可选：schema 版本 / `formatVersion` 不低于当前支持最低版本

**打开源库 DB**：独立 `better-sqlite3` 连接，`readonly: true`，不切换 `getDatabase()` 活动库。

### 5.3 阶段 `phaseTags`

1. 读取 A：`SELECT * FROM tags`
2. 建立 `Map<sourceTagId, targetTagId>`：
   - B 中按 **name** 查找；有则映射，无则 `uuid` 新建并插入 B
3. 确保 **源库名称 tag**（§4）存在，记 `sourceLibraryTagId`（不参与 source→target 映射表中的 A tag 替换，单独处理）

### 5.3.1 阶段 `phaseCategories`

1. 读取 A：`SELECT * FROM categories ORDER BY sort_order`
2. 建立 `Map<sourceCategoryId, targetCategoryId>`：
   - B 中按 **name** 查找；有则映射，无则 `uuid` 新建并插入 B（保留 color/icon/description/sort_order）
3. 源库无 `categories` 表时跳过（兼容旧库）

### 5.4 阶段 `phaseFolders`

1. 读取 A：`folders` 按 `level ASC`（保证父先于子）
2. 建立 `Map<sourceFolderId, targetFolderId>`：
   - 匹配键：`(parentTargetId, name)` 或 A 的 `path` 字符串在 B 中找同名 `folders.path`
   - 不存在：在 B 插入新 folder（新 UUID，level/path 按 B 规则生成）
   - 存在：复用 B 的 id
3. **不导入** A 的 `coverAssetId`（资产尚未存在）；可在 `phaseAssets` 结束后第二遍 patch（V1 可省略封面，或最后按映射重写）

### 5.5 阶段 `phaseAssets`

对 A 每条 `assets` 行（可 `ORDER BY imported_at`）：

1. **解析源文件**  
   - `resolve` A 库内绝对路径：`join(sourceRoot, file_path)` 或 `items/{id}/` 下主文件  
   - 若文件不存在 → 记 `failed`，继续

2. **内容哈希**  
   - 优先 A.`content_hash`  
   - 否则 A 侧 `meta.json` 的 `contentHash`  
   - 否则对源文件 `computeFileSha256`（仅此时，进度计入 hash）

3. **去重**  
   - `findAssetIdByContentHash(B, fileSize, hash)`（复用 `contentHashService`）  
   - **命中**：`targetAssetId = existing`；**不拷贝** `items/`；执行 **metadata merge**（§5.6）  
   - **未命中**：`newId = uuid`；`copyOrHardlink` A 的条目目录 → B `items/{newId}/`；调用与 `importSingleAsset` 对齐的 DB + sidecar 写入（或内部抽取 `importAssetFromLibraryPack`）

4. **文件夹**  
   - 读 A `asset_folders`（及 legacy `assets.folder_id` 若仍在用）  
   - 映射为 B 的 `folderId`，`INSERT OR IGNORE` 进 `asset_folders`

5. **有效类型**  
   - 读 A `assets.type_id`（旧库无列时从 `asset_categories` 回退一条）  
   - 用户 uuid 经 `categoryMap` 映射；`__sys:*` 原样写入 B

6. **标签**  
   - A `asset_tags` → 映射 tag id → B 插入  
   - 追加 **源库名称 tag**（§4）

7. **进度**  
   - `emit('library:import-progress', { phase: 'assets', current, total, filename, status })`

### 5.6 重复项 metadata merge（默认）

| 字段 | 策略 |
|------|------|
| notes | B 已有非空则 **保留 B**；B 空且 A 非空则写入 A |
| tags | **并集**（含源库 tag） |
| type_id | 新建资产：映射源 `type_id`；重复项：**保留 B** |
| folders | **并集**（`asset_folders`） |
| 文件 / file_path | **不动** B |
| view_count 等 | 不覆盖 |

### 5.7 阶段 `phaseFinalize`

- 重建/增量更新 `assets_search`（对新增与 notes 变更条目）
- 更新 `folders.asset_count`（现有 folder 统计逻辑）
- `notifyAllWindowsAssetsImported()` / `library:import-complete`
- WAL checkpoint（B）

---

## 6. 错误与事务

| 原则 | 说明 |
|------|------|
| 粒度 | **每条资产** 独立 try/catch；失败记入 `errors[]`，不中断整库 |
| 事务 | 单条资产：DB 写入 + sidecar 同一事务边界（与现有 import 一致） |
| 取消 | V1 可选：`AbortSignal` 在资产循环检查；已提交条目不回滚 |
| 源库 | 全程只读，不修改 A |

---

## 7. IPC 与 Preload

对齐现有 `library:upgrade-to-archive` / `library:upgrade-progress` 模式。

### 7.1 Channel

| Channel | 方向 | 说明 |
|---------|------|------|
| `library:import-from-library` | invoke | 参数 `{ sourceLibraryRoot: string }`；返回 `ImportLibraryResult` |
| `library:import-progress` | main → renderer | 进度推送 |
| `library:import-complete` | main → renderer | 可选，便于刷新 |

### 7.2 类型（`src/shared/libraryTypes.ts`）

```typescript
export type ImportLibraryPhase = 'validate' | 'tags' | 'folders' | 'assets' | 'finalize'

export interface ImportLibraryProgress {
  phase: ImportLibraryPhase
  current: number
  total: number
  filename: string
  status: 'processing' | 'done' | 'error'
}

export interface ImportLibraryResult {
  ok: true
  sourceDisplayName: string
  sourceLibraryRoot: string
  assetsAdded: number
  assetsSkippedDuplicate: number
  assetsFailed: number
  foldersCreated: number
  foldersMerged: number
  tagsCreated: number
  tagsMerged: number
  categoriesCreated: number
  categoriesMerged: number
  sourceLibraryTagName: string
  errors: Array<{ sourceAssetId: string; filename: string; reason: string }>
} | {
  ok: false
  error: string
  code?: 'INVALID_PATH' | 'INVALID_SOURCE_MODE' | 'SAME_LIBRARY' | 'SOURCE_NOT_FOUND' | 'SOURCE_DB_ERROR'
}
```

### 7.3 实现位置

| 层 | 文件 |
|----|------|
| 服务 | `src/main/services/importLibraryFromPath.ts`（新建） |
| IPC | `src/main/ipc/handlers/library.ts` |
| Preload | `src/preload/index.ts` → `library.importFromLibrary` / `onImportProgress` |
| UI | `src/renderer/src/components/Settings/LibrarySettingsPanel.tsx` |

---

## 8. Web API v1

### 8.1 `POST /library/importFromLibrary`

**说明**：在 **当前活动库** 上执行与 IPC 相同的导入；适合脚本化批量运维。

**Request body**

```json
{
  "sourceLibraryRoot": "G:\\Libraries\\MyRefs.library"
}
```

**Response**（JSend `success`）

与 `ImportLibraryResult`（`ok: true` 分支）字段一致。

**错误**

| HTTP | code | 说明 |
|------|------|------|
| 400 | `INVALID_SOURCE_MODE` | 源库与目标库模式组合不支持（须同为 archive 或同为 catalog） |
| 400 | `SAME_LIBRARY` | 源与目标相同 |
| 404 | `SOURCE_NOT_FOUND` | 路径无效 |
| 409 | `LIBRARY_BUSY` | 可选：已有导入任务运行中 |
| 503 | `LIBRARY_NOT_READY` | 当前无打开库 |

**文档同步**（实现时）

- [web-api-v1-guide.md](./web-api-v1-guide.md) — 新增 § 库操作
- [web-api-v1-openapi.yaml](./web-api-v1-openapi.yaml) — path 定义
- [web-api-v1-design.md](./web-api-v1-design.md) — §4 Library 补充

**进度**：HTTP 请求阻塞至完成；长时间导入时客户端依赖超时设置。可选 V1.1：`jobId` + `GET /library/importStatus?id=`（本规格暂不实现）。

---

## 9. UI 规格

**位置**：`LibrarySettingsPanel`，「升级为完整库」附近，仅当 `libraryMode === 'archive'` 显示。

**控件**

- 按钮：**从其它资料库导入…**
- 点击 → `dialog.showOpenDialog`（选目录，标题说明需含 `library.sqlite`）
- 确认框文案：源库显示名、路径、警告「仅支持完整库；重复文件将跳过拷贝；建议先备份目标库」
- 导入中：`busy` + 进度行（阶段 + `current/total` + 文件名）
- 完成：`Modal` 或 `Message` 展示报告摘要；失败列表可展开前 20 条

---

## 10. 开发计划

### 10.1 任务分解

| ID | 任务 | 优先级 | 预估 | 依赖 |
|----|------|--------|------|------|
| LIM-01 | 新增 `importLibraryFromPath.ts`：`validateSource` + 只读打开源 DB | P0 | 4h | — |
| LIM-02 | `phaseTags` + 源库名称 tag | P0 | 3h | LIM-01 |
| LIM-02b | `phaseCategories`（name 映射） | P0 | 2h | LIM-01 |
| LIM-03 | `phaseFolders`（path 映射、层级） | P0 | 6h | LIM-01 |
| LIM-04 | `phaseAssets`：拷贝条目 + 新资产入库 | P0 | 8h | LIM-02, LIM-03 |
| LIM-05 | 去重 + 重复项 tag/folder/category/notes 合并 | P0 | 6h | LIM-04 |
| LIM-06 | `phaseFinalize`：search、folder count、通知 | P0 | 3h | LIM-05 |
| LIM-07 | IPC + `libraryTypes` + preload | P0 | 3h | LIM-06 |
| LIM-08 | `LibrarySettingsPanel` UI + 进度订阅 | P0 | 4h | LIM-07 |
| LIM-09 | Web API handler + routes + types | P1 | 3h | LIM-06 |
| LIM-10 | 文档：guide / openapi / design | P1 | 2h | LIM-09 |
| LIM-11 | 手动回归清单（见 §11） | P0 | 2h | LIM-08 |

**合计**：约 **44h**（1 人周量级）

### 10.2 建议实施顺序

```text
LIM-01 → LIM-02 → LIM-02b → LIM-03 → LIM-04 → LIM-05 → LIM-06
  → LIM-07 → LIM-08（可交付 UI 版本）
  → LIM-09 → LIM-10（API + 文档）
  → LIM-11
```

### 10.3 代码复用与重构

| 现有模块 | 用途 |
|----------|------|
| `contentHashService.findAssetIdByContentHash` | 去重 |
| `copyOrHardlinkIntoLibrary` / `importSingleAsset` 落盘逻辑 | 拷贝与 sidecar |
| `writeAssetSidecarMeta` / `syncAssetSidecarFromDb` | 侧车 |
| `readLibraryDisplayName`（library IPC） | 源库 tag 名 |
| `libraryUpgrade` 进度推送模式 | IPC 事件形状参考 |

**避免**复用 `copyAssetsToOtherLibrary` 主体（双库写同一 target DB 连接方式易错）；新服务统一在 **当前 B 的 Drizzle 连接** 上写，源库只读。

---

## 11. 验收与回归

### 11.1 场景

| # | 场景 | 预期 |
|---|------|------|
| 1 | B 空库 ← 导入 A（100 条，含 2 层文件夹） | 文件夹树一致；资产可预览 |
| 2 | B 已有与 A 重复的文件（同 hash） | 不增 `items/` 体积；B 条数不翻倍；重复条带 A 的标签 + 源库 tag |
| 3 | A 中某条文件缺失 | 报告 `assetsFailed`，其余成功 |
| 4 | 选 catalog 为源 | 拒绝，`INVALID_SOURCE_MODE` |
| 5 | 源路径 = 当前库 | 拒绝，`SAME_LIBRARY` |
| 6 | 导入后搜索 A 独有 tag 名 | 可筛到 |
| 7 | 源库 tag 名 = A.displayName | 存在且可筛选 |
| 8 | Web API 同路径调用 | 与 UI 结果一致 |
| 9 | 导入期间切换库 | V1：按钮 disabled；或拒绝新导入 |

### 11.2 非功能

- 1 万条 archive 导入：UI 不卡死（重活在 main；进度节流 100–200ms）
- 源库 SQLite 始终 readonly
- 导入后 B 的 `library.sqlite` 可正常关闭重开

---

## 12. 风险与后续

| 风险 | 缓解 |
|------|------|
| 大库导入耗时长 | 进度 IPC；文档建议先备份 |
| folder `path` 冲突 | V1 按 path 合并；极端重名需 V2 冲突 UI |
| A/B schema 版本差 | validate 阶段检查；不支持则明确报错 |
| 双 tag 名与源库 displayName 冲突 | 视为普通 tag 合并，不重复创建 |

**V2 候选**：部分文件夹导入、catalog 源、导入前预览、job 异步 API、取消按钮、文件夹封面映射。

---

## 13. 文档维护

| 文件 | 变更 |
|------|------|
| 本文 | 规格与计划主文档 |
| [doc/README.md](./README.md) | 索引一行 |
| [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) | 里程碑条目 |
| [AGENTS.md](../AGENTS.md) | 任务入口 |
| Web API 三件套 | 实现 LIM-09/10 时更新 |
