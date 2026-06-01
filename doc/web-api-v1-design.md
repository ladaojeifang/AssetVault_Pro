# AssetVault Pro Web API v1 — 设计稿

> 参考 [Eagle Web API](https://developer.eagle.cool/web-api/zh-cn) 的本地 HTTP、版本前缀、分页与 JSend 响应；实现上复用现有 `main` 业务层，HTTP 仅作协议适配。

**状态：** Phase 1 + Phase 2 核心端点已实现（本地 HTTP，默认 `127.0.0.1:41596`）

**用户手册：** [web-api-v1-guide.md](./web-api-v1-guide.md)（接口清单、示例、Playground 用法）  
**文档索引：** [README.md](./README.md)  
**版本：** `v1`  
**默认 Base URL：** `http://127.0.0.1:41596/api/v1/`

---

## 1. 目标与边界

| 项 | 说明 |
|----|------|
| 运行位置 | 应用**必须已启动**；API 随主进程生命周期启停 |
| 协议 | HTTP/JSON，`GET` 查询，`POST` 写入/复杂查询 |
| 与 IPC | **同一套 service**；IPC handler 与 HTTP route 均调用 `services/*`，禁止双份逻辑 |
| 非目标 v1 | 远程公网暴露、OAuth、文件二进制直传（v1 只接受**本机绝对路径**导入） |

---

## 2. 架构

```text
HTTP Client (curl / Node / Python)
        │
        ▼
┌───────────────────────────────────────┐
│  src/main/api/                        │
│  server.ts      Fastify 实例、监听端口   │
│  auth.ts        localhost / token      │
│  routes/*.ts    路由注册               │
│  dto.ts         请求校验、JSON 序列化   │
└───────────────┬───────────────────────┘
                │
                ▼
┌───────────────────────────────────────┐
│  src/main/services/ (现有 + 抽取)      │
│  assetQueryService, importService, …    │
└───────────────┬───────────────────────┘
                │
                ▼
         getDatabase() / libraryBundle
```

### 建议目录结构

```text
src/main/api/
  server.ts              # startApiServer / stopApiServer
  config.ts              # 端口、bind、token、enableRemote
  auth.ts                # preHandler
  errors.ts              # ApiError + 错误码
  serialize.ts           # AssetItem Date → ISO string
  routes/
    index.ts             # 注册所有路由
    app.ts
    library.ts
    asset.ts
    folder.ts
    tag.ts
  handlers/              # 薄层：解析参数 → 调 service → 包 JSend
    app.ts
    library.ts
    asset.ts
    folder.ts
    tag.ts

src/main/services/       # Phase 1 从 ipc/handlers 抽取
  assetQueryService.ts   # 原 assets:query 逻辑
  assetImportService.ts  # 封装 importSingleAsset / folder 扫描

src/shared/
  webApiTypes.ts         # 请求/响应 DTO（与 IPC 类型对齐）

doc/
  README.md              # 文档索引
  web-api-v1-design.md   # 本文档
  web-api-v1-guide.md      # 用户手册
  web-api-v1-openapi.yaml  # OpenAPI 3.1
```

### 启动集成（`src/main/index.ts`）

```typescript
// app.whenReady 内 initDatabase 成功后：
await startApiServer({ port: preferences.webApiPort ?? 41596 })

// app.on('before-quit'):
await stopApiServer()
```

---

## 3. 通用约定

### 3.1 响应格式（JSend）

**成功：**

```json
{
  "status": "success",
  "data": { }
}
```

**失败：**

```json
{
  "status": "error",
  "code": "ASSET_NOT_FOUND",
  "message": "资产不存在"
}
```

### 3.2 分页（列表类）

Query 参数（与 Eagle 对齐）：

| 参数 | 类型 | 默认 | 最大 | 说明 |
|------|------|------|------|------|
| `offset` | int | `0` | — | 跳过条数 |
| `limit` | int | `50` | `1000` | 返回条数 |

列表响应 `data` 形状：

```json
{
  "data": [ ],
  "total": 1200,
  "offset": 0,
  "limit": 50
}
```

资产查询另支持 `page` / `pageSize`（映射现有 `QueryParams`），与 `offset/limit` 二选一；**HTTP 层统一转换为 `offset/limit` 入 service**。

### 3.3 日期与时间

API JSON 中所有时间字段为 **ISO 8601 字符串**（如 `"2026-05-27T02:16:00.000Z"`），与内部 `Date` 互转在 `serialize.ts` 完成。

### 3.4 鉴权

| 场景 | 行为 |
|------|------|
| 默认 | 仅监听 `127.0.0.1`；**无需 token**（同 Eagle localhost） |
| `allowRemote: true` | 监听 `0.0.0.0`；请求须带 `Authorization: Bearer <token>` 或 `?token=` |
| Token 存储 | `userData/web-api.json`（设置页可查看/重新生成） |

### 3.5 错误码（v1）

| code | HTTP | 说明 |
|------|------|------|
| `INVALID_REQUEST` | 400 | 参数缺失/类型错误 |
| `UNAUTHORIZED` | 401 | 远程模式无 token |
| `LIBRARY_NOT_READY` | 503 | 资料库未初始化 |
| `ASSET_NOT_FOUND` | 404 | 资产 id 不存在 |
| `FOLDER_NOT_FOUND` | 404 | 文件夹不存在 |
| `TAG_NOT_FOUND` | 404 | 标签不存在 |
| `FILE_NOT_FOUND` | 400 | 导入路径不存在 |
| `FILE_NOT_FILE` | 400 | 路径是目录 |
| `DUPLICATE_SOURCE` | 409 | 同 import_source 已存在（可选返回 existingId） |
| `INTERNAL_ERROR` | 500 | 未捕获异常 |

---

## 4. 端点清单（Phase 1 — MVP）

### 4.1 App

#### `GET /app/info`

应用是否在线、版本信息。

**Response `data`:**

```typescript
interface AppInfoResponse {
  name: 'AssetVault Pro'
  version: string          // package.json version
  apiVersion: 'v1'
  platform: NodeJS.Platform
  packaged: boolean
}
```

**映射：** 读 `app.getVersion()`、`app.isPackaged`。

---

### 4.2 Library

#### `GET /library/info`

当前活动资料库元数据（对齐 `library:get-info` + `library:get-mode-stats`）。

**Response `data`:**

```typescript
interface LibraryInfoResponse {
  libraryRoot: string
  dbPath: string
  manifestPath: string
  displayName: string
  libraryMode: 'archive' | 'catalog'
  localization: LibraryLocalizationManifest | null
  stats: LibraryModeStats
}
```

**映射：** `library:get-info` + `getLibraryModeStats()`。

#### `GET /library/state`

活动库 + 最近列表（对齐 `library:get-state`）。

**Response `data`:**

```typescript
interface LibraryStateResponse {
  activeLibraryRoot: string
  recentLibraries: string[]
  libraryDisplayName: string
  libraryMode: 'archive' | 'catalog'
  manifestPath: string
  dbPath: string
}
```

#### `POST /library/importFromLibrary`

从其它 **archive** 资料库整库导入到当前库（标签、文件夹、资产；SHA-256 去重；来源库 displayName 作为 tag）。

```json
{ "sourceLibraryRoot": "G:\\other-archive-library" }
```

**映射：** `importLibraryFromPath(sourceLibraryRoot)`。进度仅 IPC（`library:import-progress`），HTTP 为同步阻塞直至完成。

**Response `data`:** `ImportLibrarySuccess`（见 `src/shared/libraryTypes.ts`）。

#### `POST /library/switch`（Phase 1 可选，默认 defer）

```json
{ "libraryRoot": "G:\\my-library" }
```

**映射：** `switchActiveLibrary(root)`。

---

### 4.3 Asset（核心）

#### `GET /asset/get`

分页列出资产（对齐 `assets:query`）。

**Query 参数：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `offset` / `limit` | int | 分页 |
| `page` / `pageSize` | int | 可选，转为 offset |
| `search` | string | 多 token AND 搜索 |
| `folderId` | uuid | 逻辑文件夹过滤 |
| `fileType` | FileType | image/video/… |
| `tags` | string | 逗号分隔 tagId，或重复 `tags=id1&tags=id2` |
| `colorBucket` | ColorBucket | |
| `sizePreset` | small\|medium\|large | 与 min/maxMb 互斥 |
| `minFileSizeMb` / `maxFileSizeMb` | number | |
| `datePreset` | today\|week\|month\|year | |
| `sortBy` | QueryParams['sortBy'] | 默认 importedAt |
| `sortOrder` | asc\|desc | 默认 desc |

**Response `data`:** 分页包装 + `AssetDto[]`（见 §5.1）。

**映射：** 抽取 `queryAssets(params) → { items, total, offset, limit }`。

---

#### `GET /asset/info?id={uuid}`

单条资产（路径参数亦可：`GET /asset/:id`，实现二选一，文档推荐 query 与 Eagle `item/info` 风格并存）。

**Response `data`:** `AssetDto`。

**映射：** `assets:get-by-id`。

---

#### `POST /asset/get`

复杂条件查询（body 传参，避免 URL 过长）。**Body 与 GET query 字段相同**，另可加 `tagIds: string[]`。

**映射：** 同 `assets:query`。

---

#### `POST /asset/import`

从**本机绝对路径**导入单个文件。

**Body:**

```typescript
interface AssetImportRequest {
  filePath: string              // 必填，如 G:\\imgs\\a.jpg
  targetFolderId?: string       // 逻辑文件夹 id
  duplicatePolicy?: 'ask' | 'use_existing' | 'import_copy'
}
```

> HTTP 无法弹窗：`duplicatePolicy` 默认 `use_existing`；`ask` 在 API 中等价于返回 409 + `DUPLICATE_PROMPT` 载荷（见下）。

**Response `data`（成功导入）:**

```typescript
interface AssetImportResponse {
  assetId: string
  skipped: false
}
```

**Response `data`（跳过-已存在）:**

```typescript
{
  "skipped": true,
  "reason": "duplicate_source" | "duplicate_content" | "unsupported_extension",
  "existingAssetId"?: string
}
```

**映射：** `importSingleAsset(filePath, options)`；`assets:import` 单元素数组。

---

#### `POST /asset/importBatch`

**Body:**

```typescript
interface AssetImportBatchRequest {
  filePaths: string[]
  targetFolderId?: string
  duplicatePolicy?: DuplicatePolicy
}
```

**Response `data`:**

```typescript
interface AssetImportBatchResponse {
  imported: string[]      // 新 assetId
  skipped: Array<{ filePath: string; reason: string; existingAssetId?: string }>
  errors: Array<{ filePath: string; message: string }>
}
```

**映射：** `assets:import` 循环逻辑。

---

#### `POST /asset/importFolder`

递归导入目录下受支持扩展名文件。

**Body:**

```typescript
interface AssetImportFolderRequest {
  folderPath: string
  targetFolderId?: string
  duplicatePolicy?: DuplicatePolicy
}
```

**Response `data`:**

```typescript
interface AssetImportFolderResponse {
  imported: string[]
  totalFiles: number
  errors: Array<{ filePath: string; message: string }>
}
```

**映射：** `assets:import-folder`。

---

#### `POST /asset/importFromURL`

由**主进程**下载 `http`/`https` URL 后导入（浏览器扩展、网页采集）。不在 HTTP 层传 `tagIds`；打标签见 `POST /tag/assign`。

**Body:**

```typescript
interface AssetImportFromUrlRequest {
  url: string                    // 必填
  filename?: string              // 可选，推断扩展名/原始文件名，如 photo.jpg
  targetFolderId?: string
  duplicatePolicy?: DuplicatePolicy
}
```

**下载限制：** 硬上限 300MB；有 `Content-Length` 时自适应上限（约 `length × 1.15 + 1MB`）。超限 → `400 INVALID_REQUEST`。

**落盘：** `libraryRoot/remote-imports/<sha256>/<safeFileName>`，再 `importSingleAsset`（catalog 引用该路径，archive 拷贝进 items）。

**映射：** `urlAssetImportService.importAssetFromUrl` → `importAssetFromPath`。

---

#### `POST /asset/importFromURLBatch`

**Body:**

```typescript
interface AssetImportFromUrlBatchRequest {
  items: Array<{ url: string; filename?: string }>
  targetFolderId?: string
  duplicatePolicy?: DuplicatePolicy
}
```

**Response `data`:**

```typescript
interface AssetImportFromUrlBatchResponse {
  imported: string[]
  skipped: Array<{ url: string; reason: string; existingAssetId?: string }>
  errors: Array<{ url: string; message: string }>
}
```

**映射：** `urlAssetImportService.importAssetFromUrlBatch`（默认顺序下载，单条失败记入 `errors`）。

---

#### `DELETE /asset/delete`

**Body:**

```json
{ "ids": ["uuid-1", "uuid-2"] }
```

**Response `data`:** `{ "deleted": 2 }`

**映射：** `assets:delete`。

---

#### `PATCH /asset/update`（Phase 1 子集）

**Body（部分字段）:**

```json
{
  "id": "uuid",
  "notes": "备注",
  "sourceUrl": "https://example.com",
  "metadata": { "key": "value" }
}
```

**映射：** `assets:update-notes` / `assets:update-source-url` / `assets:update-metadata`。`sourceUrl` 仅接受 `http://` / `https://` 开头 URL，空字符串清空链接。

---

#### `POST /asset/rename`

```json
{ "id": "uuid", "newName": "new-file.jpg" }
```

**映射：** `assets:rename`。

---

#### `POST /asset/relink`

索引库引用资产重链源文件。

```json
{ "assetId": "uuid", "newSourcePath": "G:\\new\\path.jpg" }
```

**映射：** `assets:relink`。

---

#### `POST /asset/localize`

索引 → 完整库拷贝。

```json
{ "assetIds": ["uuid"] }
```

**Response `data`:** `LocalizeAssetsResult`（见 `libraryTypes.ts`）。

**映射：** `assets:localize`。

---

### 4.4 Folder（Phase 2，接口先定稿）

| 方法 | 路径 | 映射 IPC |
|------|------|----------|
| GET | `/folder/get` | folders:list 或 get-tree 扁平化 |
| GET | `/folder/tree` | folders:get-tree |
| POST | `/folder/create` | folders:create |
| PATCH | `/folder/update` | folders:update |
| DELETE | `/folder/delete` | folders:delete |
| POST | `/folder/move` | folders:move |

**Create body:**

```json
{
  "name": "参考图",
  "parentId": null,
  "color": "#64748b",
  "icon": "📁"
}
```

---

### 4.5 Tag（Phase 2）

| 方法 | 路径 | 映射 IPC |
|------|------|----------|
| GET | `/tag/get` | tags:list |
| POST | `/tag/create` | tags:create |
| PATCH | `/tag/update` | tags:update |
| DELETE | `/tag/delete` | tags:delete |
| POST | `/tag/assign` | tags:assign-to-assets |
| POST | `/tag/remove` | tags:remove-from-assets |

**Assign body:**

```json
{
  "assetIds": ["a1"],
  "tagIds": ["t1", "t2"]
}
```

---

## 5. 数据模型（DTO）

### 5.1 `AssetDto`

与 `AssetItem` 一致，时间字段为 string：

```typescript
interface AssetDto {
  id: string
  filename: string
  originalName: string
  extension: string
  mimeType: string
  fileType: FileType
  folderId: string | null
  filePath: string
  storageMode?: 'local' | 'referenced'
  localizationState?: LocalizationState
  sourceMissingAt?: string | null
  sourceMissing?: boolean
  resolvedFilePath?: string
  fileSize: number
  contentHash?: string | null
  width?: number | null
  height?: number | null
  dominantColor?: string | null
  colorBucket?: string | null
  hasThumbnail: boolean
  notes?: string | null
  sourceUrl?: string | null
  viewCount: number
  importedAt: string
  updatedAt: string
  tagIds?: string[]
  folderIds?: string[]
}
```

### 5.2 `FolderDto` / `TagDto`

同 `FolderItem` / `TagItem`，`createdAt`/`updatedAt` → ISO string。

---

## 6. 调用示例

### 健康检查

```bash
curl -s http://127.0.0.1:41596/api/v1/app/info
```

### 查询资产

```bash
curl -s "http://127.0.0.1:41596/api/v1/asset/get?limit=20&search=cat&sortBy=importedAt&sortOrder=desc"
```

### 导入本地文件

```bash
curl -s -X POST http://127.0.0.1:41596/api/v1/asset/import \
  -H "Content-Type: application/json" \
  -d "{\"filePath\":\"G:\\\\test\\\\photo.jpg\",\"duplicatePolicy\":\"use_existing\"}"
```

### 复杂查询（POST body）

```bash
curl -s -X POST http://127.0.0.1:41596/api/v1/asset/get \
  -H "Content-Type: application/json" \
  -d "{\"folderId\":\"folder-uuid\",\"tags\":[\"tag-uuid\"],\"limit\":50}"
```

---

## 7. 配置项（`AppPreferences` 扩展）

```typescript
interface WebApiPreferences {
  enabled: boolean              // 默认 true（开发可关）
  port: number                    // 默认 41596
  bind: '127.0.0.1' | '0.0.0.0'  // 默认 127.0.0.1
  allowRemote: boolean            // 默认 false
  token?: string                  // UUID，allowRemote 时必填
}
```

设置页：**高级 → 开发者 → Web API**（显示 Base URL、复制 token、重新生成）。

---

## 8. 实现阶段

### Phase 1（建议 3–5 天）

- [x] Node `http` + `startApiServer` / 鉴权（Electron 28 不用 Fastify 5）
- [x] 抽取 `assetQueryService`、`assetImportService`
- [x] 路由：`app/info`、`library/info`、`library/state`
- [x] 路由：`asset/get`、`asset/info`、`asset/import`、`importBatch`、`importFolder`、`asset/delete`
- [x] 路由：`asset/importFromURL`、`asset/importFromURLBatch`（主进程下载，浏览器扩展）
- [x] `shared/webApiTypes.ts`
- [ ] 单元测试（supertest）
- [ ] README 链接本文档

### Phase 2

- [x] Folder / Tag 全套（`folderService` / `tagService`）
- [x] `asset/update`、`rename`、`relink`、`localize`
- [x] OpenAPI 3.1 yaml（`doc/web-api-v1-openapi.yaml`）
- [x] Playground（`GET /api/v1/playground/`，Swagger UI）
- [x] 设置页 Web API（高级 → 开发者）

### Phase 3

- [ ] SSE：`GET /event/import-progress` 推送导入进度
- [ ] 缩略图：`GET /asset/thumbnail?id=`（`image/webp` 流）
- [ ] 速率限制与审计日志文件

---

## 9. 与 Eagle 的对照

| Eagle | AssetVault v1 |
|-------|----------------|
| `http://localhost:41595/api/v2/` | `http://127.0.0.1:41596/api/v1/` |
| `item/get` | `asset/get` |
| `item/addFromURL` / 41593 表单 | `asset/importFromURL`（主进程下载） |
| `item/add`（本机/扩展下载） | `asset/import`（本机绝对路径） |
| `library/info` | `library/info` |
| localhost 免 token | 同左；远程需 token |
| JSend + offset/limit | 同左 |

差异：**v1 不提供 multipart 直传**；浏览器扩展应使用 `importFromURL`，由应用下载并入库。标签在 Eagle 扩展侧可随单条请求携带；AssetVault v1 为 **导入 + `tag/assign` 两步**。

---

## 10. 依赖建议

```json
{
  "dependencies": {
    "fastify": "^5.x",
    "@fastify/cors": "^10.x"
  }
}
```

CORS：默认仅允许 `127.0.0.1` 来源；`allowRemote` 时可配置 `origin: true` 供局域网脚本。

---

## 11. 验收标准（Phase 1）

1. 应用启动后 `GET /app/info` 返回 `success`。
2. `POST /asset/import` 导入 `G:\...` 文件后，`GET /asset/get` 能查到且 `libraryMode=catalog` 时为引用路径。
3. 未启动应用时端口无监听。
4. `allowRemote=false` 时外网 IP 访问返回 403/connection refused。
5. 与 UI 内 Ctrl+I 导入同一文件行为一致（重复策略除外：API 默认 `use_existing`）。

---

*文档版本：2026-05-27 · 随实现可更新 OpenAPI 与错误码表。*
