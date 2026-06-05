# AssetVault Pro Web API v1 — 使用说明

本文档面向脚本、自动化工具与集成开发者，说明如何在 **AssetVault Pro 已启动** 时通过本地 HTTP 接口操作当前活动资料库。

- 文档索引：[README.md](./README.md)
- 技术设计稿：[web-api-v1-design.md](./web-api-v1-design.md)
- OpenAPI 机器可读规范：[web-api-v1-openapi.yaml](./web-api-v1-openapi.yaml)

---

## 1. 使用前准备

| 条件 | 说明 |
|------|------|
| 应用已运行 | 关闭应用后 API 端口不会监听 |
| Web API 已启用 | **设置 → Advanced → 开发者 · Web API** 中勾选「启用」，保存 |
| 资料库已打开 | 主界面能正常浏览资产即可 |

默认地址（端口可在设置中修改）：

```text
http://127.0.0.1:41596/api/v1/
```

---

## 2. Playground（交互式调试）

Playground 内置 **Swagger UI**，可浏览全部接口、填写参数并直接发送请求，适合初次上手与调试。

### 2.1 打开方式

任选其一：

1. **应用内**：设置 → Advanced → 开发者 · Web API → **打开 Playground**
2. **浏览器**：启动应用后访问  
   `http://127.0.0.1:41596/api/v1/playground/`  
   （将 `41596` 换成你设置的端口）

### 2.2 界面说明

- 左侧按 **app / library / asset / folder / tag** 分组列出接口。
- 点击某个接口 → **Try it out** → 填写 Query / Body → **Execute**。
- 下方显示 HTTP 状态码与 JSON 响应。
- 顶栏链接可打开原始 **openapi.yaml** 规范文件。

### 2.3 使用注意

- Playground 需要能访问外网 CDN（加载 Swagger UI 静态资源）；纯离线环境请用 curl 或自读 OpenAPI 文件。
- 本机模式（未开启「允许远程访问」）一般 **不需要** 填写 Authorization。
- 若开启远程访问，在 Swagger 右上角 **Authorize** 填入：`Bearer <你的 token>`（与设置页中 Token 一致）。

### 2.4 OpenAPI 规范地址

```text
http://127.0.0.1:41596/api/v1/docs/openapi.yaml
```

可导入 Postman、Insomnia、Hoppscotch 等工具。

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
  "message": "资产不存在: xxx"
}
```

### 3.2 鉴权

| 模式 | 行为 |
|------|------|
| 默认（仅本机） | 监听 `127.0.0.1`，**无需 Token** |
| 允许远程访问 | 监听 `0.0.0.0`，须携带 Token |

Token 传递方式（二选一）：

```http
Authorization: Bearer <token>
```

或 Query：

```text
?token=<token>
```

Token 在 **设置 → Advanced → Web API** 中查看、复制或重新生成。

### 3.3 分页

列表类接口（如 `asset/get`）支持：

| 参数 | 说明 | 默认 |
|------|------|------|
| `offset` | 跳过条数 | 0 |
| `limit` | 返回条数，最大 1000 | 50 |

也可用 `page` + `pageSize`（`pageSize` 最大 200），与 UI 分页一致。

列表 `data` 常见形状：

```json
{
  "data": [ ],
  "total": 100,
  "offset": 0,
  "limit": 50
}
```

### 3.4 时间与路径

- JSON 中时间为 **ISO 8601** 字符串。
- **本机路径导入**：`filePath` / `folderPath` 须为 **本机绝对路径**（如 `G:\images\a.jpg`）。
- **URL 直链导入**：`importFromURL` / `importFromURLBatch` 由主进程下载 `http`/`https` **直链媒体**后写入资料库（见 [3.6](#36-从-url-导入浏览器扩展)）。**作品页**（YouTube watch、B 站 BV 等）须用 [§作品页视频导入](#作品页视频导入pagevideoimport)，否则会 `400 INVALID_REQUEST`。
- **作品页视频**：`pageVideoImport` 由本机 **yt-dlp** 解析页面后入库（见 [§作品页视频导入](#作品页视频导入pagevideoimport)）。
- v1 **不支持** multipart 上传；除 URL / yt-dlp 导入外，文件须已在磁盘上。

### 3.5 导入重复策略

`duplicatePolicy` 可选值（HTTP 默认 `use_existing`，不会弹窗）：

| 值 | 说明 |
|----|------|
| `use_existing` | 同路径或同内容已存在则跳过，返回 `skipped: true` |
| `import_copy` | 强制再导入一份 |
| `ask` | API 中等价于 `use_existing` |

### 3.6 从 URL 导入（浏览器扩展）

面向浏览器插件、网页采集脚本：扩展在页面侧解析**直链**图片/视频 URL，**不**在浏览器内下载大文件，而是把 URL 交给本机运行的 AssetVault Pro 主进程下载并导入。

| 项 | 说明 |
|----|------|
| 适用 URL | **CDN / 文件直链**（路径含 `.jpg`、`.png`、`.mp4`、`.webm` 等，或 host 为 `googlevideo.com`、`bilivideo.com` 等）。**作品页**（如 `youtube.com/watch`、`bilibili.com/video/BV…`，见 `isPageVideoWorkUrl` 正向规则）会被拒绝，须改用 `POST /asset/pageVideoImport` |
| 作品页误用 | `400 INVALID_REQUEST`，`message` 提示使用 `POST /api/v1/asset/pageVideoImport`；`details.useEndpoint` 为上述路径 |
| 协议 | 仅 `http://`、`https://` |
| 下载位置 | 先写入系统临时目录，再落到当前资料库 `remote-imports/<内容哈希>/` 下稳定文件名 |
| 资料库模式 | **catalog**：引用库内下载文件路径；**archive**：再拷贝进 `items/{id}/` |
| 打标签 | **分两步**：先导入拿到 `assetId`，再 `POST /tag/assign`（导入接口不传 `tagIds`） |
| 扩展名 | 须为应用支持的导入扩展名；可用 `filename` 提示（如 `photo.jpg`） |

**下载大小限制（自适应 + 超限报错）：**

| 规则 | 说明 |
|------|------|
| 硬上限 | **300 MB**（`Content-Length` 已超过则直接 400，不开始下载） |
| 自适应 | 有 `Content-Length` 时：上限 ≈ `length × 1.15 + 1MB`，且不低于 5MB、不超过硬上限 |
| 无 `Content-Length` | 按硬上限流式下载，超出则中断并返回 400 |
| 错误 | `code`: `INVALID_REQUEST`，`message`: `下载文件超过最大限制`（`details.maxBytes` 为 314572800） |

**推荐调用顺序（单张保存）：**

1. `GET /app/info` — 确认应用与 API 可用  
2. `GET /library/info` — 可选，确认 `libraryMode`  
3. `GET /folder/tree` — 收集窗口选文件夹时用  
4. `POST /asset/importFromURL` — 传入 `url`、`targetFolderId`、`duplicatePolicy`  
5. `POST /tag/assign` — 传入 `assetIds`、`tagIds`（若用户选了标签）

**批量保存：** 页面侧筛选后调用 `POST /asset/importFromURLBatch`，再对 `data.imported` 批量 `tag/assign`。

#### `POST /asset/fetchRemoteBody`（主进程下载，返回 dataUrl，不入库）

与 `importFromURL` **共用同一下载栈**（`downloadRemoteUrlToFile`、`mergeDownloadHeaders`、体积上限、防盗链占位检测），但**不**注册资料库资产，仅把字节以 Data URL 返回。供扩展 Markdown 资料包：`fetchRemoteBody` → `articleBundleSession/append` 的 `fileDataUrl`。

**Request**

```json
{
  "url": "https://img.pc520.net/wp-content/uploads/2025/11/2025113023042886.jpg",
  "headers": { "Referer": "https://www.pc528.net/文章页完整URL" }
}
```

| 字段 | 说明 |
|------|------|
| `url` | http/https 直链（图片、音视频片段等） |
| `headers` | 可选；与 `importFromURL` 相同白名单（`Referer` 等），用于绕过防盗链 |

**Response `data`**

```json
{
  "dataUrl": "data:image/jpeg;base64,...",
  "bytes": 239315,
  "contentType": "image/jpeg"
}
```

| 错误 | 说明 |
|------|------|
| `INVALID_REQUEST` + 防盗链占位 | 未带正确 `Referer` 时 CDN 可能返回 GIF 水印，服务端拒绝 |
| `INVALID_REQUEST` + 作品页提示 | URL 命中 `isPageVideoWorkUrl`，应走 `pageVideoImport` |

**curl 示例**

```bash
curl -s -X POST http://127.0.0.1:41596/api/v1/asset/fetchRemoteBody \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://img.pc520.net/wp-content/uploads/2025/11/2025113023042886.jpg\",\"headers\":{\"Referer\":\"https://www.pc528.net/\"}}"
```

---

## 4. 接口总览

除下列 REST 接口外，还提供（无需鉴权）：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/docs/openapi.yaml` | OpenAPI 规范 |
| GET | `/api/v1/playground/` | Swagger Playground 页面 |

### App

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/app/info` | 应用版本、是否打包、支持的特性 (`features`) |

### Library（资料库）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/library/info` | 当前库元数据、**libraryMode**、统计 |
| GET | `/api/v1/library/state` | 活动库路径、最近库列表 |
| POST | `/api/v1/library/importFromLibrary` | 从其它资料库整库导入：archive→archive 或 catalog→catalog（同机）；SHA-256 去重，catalog 模式见 [library-import-catalog-to-catalog-spec.md](./library-import-catalog-to-catalog-spec.md) |

`libraryMode`：`catalog` = 索引库（引用原路径），`archive` = 完整库（拷贝进库）。

### Asset（资产）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/asset/get` | 分页查询（Query 参数） |
| POST | `/api/v1/asset/get` | 复杂查询（Body，同 GET 参数） |
| GET | `/api/v1/asset/info?id=` | 单条资产详情 |
| POST | `/api/v1/asset/import` | 从本机路径导入单个文件 |
| POST | `/api/v1/asset/importFromURL` | 从 URL 导入（主进程下载） |
| POST | `/api/v1/asset/pageVideoImport` | 作品页视频：创建 yt-dlp 导入任务（异步 job） |
| POST | `/api/v1/asset/pageVideoImport/batch` | 作品页视频：批量创建任务 |
| GET | `/api/v1/asset/pageVideoImport/batch/{batchId}` | 作品页视频：查询批次下全部 job |
| GET | `/api/v1/asset/pageVideoImport/jobs/{jobId}` | 作品页视频：查询任务进度/结果 |
| DELETE | `/api/v1/asset/pageVideoImport/jobs/{jobId}` | 作品页视频：取消任务 |

> `jobs/{jobId}` 与 `batch/{batchId}` 为路径参数路由，**未**列入 Playground 左侧静态列表；可在 Swagger 中手动输入路径，或见 [OpenAPI](./web-api-v1-openapi.yaml)。
| POST | `/api/v1/asset/importFromDataUrl` | 从 data URL 导入（主进程导入截图结果） |
| POST | `/api/v1/asset/fullPageSession/start` | 整页截图：创建拼接会话 |
| POST | `/api/v1/asset/fullPageSession/append` | 整页截图：登记条带文件（本机路径） |
| POST | `/api/v1/asset/fullPageSession/finish` | 整页截图：纵向拼接并导入为 **1** 个资产 |
| DELETE | `/api/v1/asset/fullPageSession/{sessionId}` | 整页截图：取消会话并清理临时目录 |
| GET | `/api/v1/asset/fullPageSession/{sessionId}` | 整页截图：查询会话进度 |
| POST | `/api/v1/asset/importBatch` | 批量导入 |
| POST | `/api/v1/asset/importFolder` | 递归导入文件夹 |
| POST | `/api/v1/asset/importFromURLBatch` | 批量从 URL 导入（主进程下载） |
| DELETE | `/api/v1/asset/delete` | 删除资产 |
| PATCH | `/api/v1/asset/update` | 更新 notes / sourceUrl / metadata |
| POST | `/api/v1/asset/rename` | 重命名 |
| POST | `/api/v1/asset/relink` | 索引库重链源文件 |
| POST | `/api/v1/asset/localize` | 索引资产本地化到完整库 |

### Folder（逻辑文件夹）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/folder/get` | 扁平列表 |
| GET | `/api/v1/folder/tree` | 树形结构 |
| GET | `/api/v1/folder/info?id=` | 单个文件夹 |
| POST | `/api/v1/folder/create` | 创建 |
| PATCH | `/api/v1/folder/update` | 更新名称/颜色/图标等 |
| DELETE | `/api/v1/folder/delete` | 删除 |
| POST | `/api/v1/folder/move` | 移动（`newParentId: null` 表示移到根） |

### Tag（标签）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/tag/get` | 全部标签 |
| GET | `/api/v1/tag/info?id=` | 单个标签 |
| POST | `/api/v1/tag/create` | 创建 |
| PATCH | `/api/v1/tag/update` | 更新 |
| DELETE | `/api/v1/tag/delete` | 删除 |
| POST | `/api/v1/tag/assign` | 为资产打标签 |
| POST | `/api/v1/tag/remove` | 移除资产上的标签 |

---

## 5. 常用示例

以下示例默认本机、端口 `41596`、无需 Token。PowerShell 中 JSON 建议用 `curl.exe` 或下方 `Invoke-RestMethod`。

### 5.1 健康检查

```bash
curl -s http://127.0.0.1:41596/api/v1/app/info
```

### 5.2 查询当前资料库类型

```bash
curl -s http://127.0.0.1:41596/api/v1/library/info
```

关注 `data.libraryMode`：`catalog` 或 `archive`。

```powershell
(Invoke-RestMethod http://127.0.0.1:41596/api/v1/library/info).data.libraryMode
```

### 5.3 分页查询资产

```bash
curl -s "http://127.0.0.1:41596/api/v1/asset/get?limit=20&search=logo&sortBy=importedAt&sortOrder=desc"
```

**Query 参数（节选）：**

| 参数 | 说明 |
|------|------|
| `search` | 搜索关键词（多词 AND） |
| `folderId` | 逻辑文件夹 ID |
| `fileType` | `image` / `video` / `audio` / `font` / … |
| `tags` | 逗号分隔的 tagId，或重复 `tags=id1&tags=id2` |
| `colorBucket` | 颜色族筛选 |
| `sizePreset` | `small` / `medium` / `large` |
| `minFileSizeMb` / `maxFileSizeMb` | 文件大小（MB） |
| `datePreset` | `today` / `week` / `month` / `year` |
| `sortBy` | `importedAt` / `filename` / `fileSize` / `random` 等 |
| `sortOrder` | `asc` / `desc` |

**POST 复杂查询（Body 与 Query 相同）：**

```bash
curl -s -X POST http://127.0.0.1:41596/api/v1/asset/get \
  -H "Content-Type: application/json" \
  -d "{\"folderId\":\"文件夹UUID\",\"tags\":[\"标签UUID\"],\"limit\":50}"
```

### 5.4 单条资产

```bash
curl -s "http://127.0.0.1:41596/api/v1/asset/info?id=资产UUID"
```

`GET /asset/info` 会增加浏览次数（与 UI 打开详情一致）。

### 5.5 导入本机文件

```bash
curl -s -X POST http://127.0.0.1:41596/api/v1/asset/import \
  -H "Content-Type: application/json" \
  -d "{\"filePath\":\"G:\\\\images\\\\photo.jpg\",\"duplicatePolicy\":\"use_existing\"}"
```

可选 `targetFolderId` 指定逻辑文件夹。

**成功导入：**

```json
{
  "status": "success",
  "data": { "skipped": false, "assetId": "uuid" }
}
```

**已存在跳过：**

```json
{
  "status": "success",
  "data": {
    "skipped": true,
    "reason": "duplicate_source",
    "existingAssetId": "uuid"
  }
}
```

**批量导入：**

```bash
curl -s -X POST http://127.0.0.1:41596/api/v1/asset/importBatch \
  -H "Content-Type: application/json" \
  -d "{\"filePaths\":[\"G:\\\\a.jpg\",\"G:\\\\b.png\"]}"
```

**导入整个文件夹（递归、仅受支持扩展名）：**

```bash
curl -s -X POST http://127.0.0.1:41596/api/v1/asset/importFolder \
  -H "Content-Type: application/json" \
  -d "{\"folderPath\":\"G:\\\\素材\\\\2024\"}"
```

### 5.5.1 导入 URL（主进程下载）

```bash
curl -s -X POST http://127.0.0.1:41596/api/v1/asset/importFromURL \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"https://example.com/photo.jpg\",\"filename\":\"photo.jpg\",\"targetFolderId\":\"文件夹UUID\",\"duplicatePolicy\":\"use_existing\"}"
```

**成功：**

```json
{
  "status": "success",
  "data": { "skipped": false, "assetId": "uuid" }
}
```

**超限示例：**

```json
{
  "status": "error",
  "code": "INVALID_REQUEST",
  "message": "下载文件超过最大限制"
}
```

### 5.5.2 批量导入 URL

```bash
curl -s -X POST http://127.0.0.1:41596/api/v1/asset/importFromURLBatch \
  -H "Content-Type: application/json" \
  -d "{\"items\":[{\"url\":\"https://example.com/a.jpg\",\"filename\":\"a.jpg\"},{\"url\":\"https://example.com/b.png\"}],\"targetFolderId\":\"文件夹UUID\",\"duplicatePolicy\":\"use_existing\"}"
```

**响应 `data` 形状：**

```json
{
  "imported": ["uuid-1", "uuid-2"],
  "skipped": [
    { "url": "https://example.com/dup.jpg", "reason": "duplicate_source", "existingAssetId": "uuid-old" }
  ],
  "errors": [
    { "url": "https://example.com/huge.bin", "message": "下载文件超过最大限制" }
  ]
}
```

单条失败不会导致整批 HTTP 失败；请检查 `errors` 数组。

### 5.5.3 URL 导入后打标签（第二步）

```bash
curl -s -X POST http://127.0.0.1:41596/api/v1/tag/assign \
  -H "Content-Type: application/json" \
  -d "{\"assetIds\":[\"上一步返回的 assetId\"],\"tagIds\":[\"标签UUID\"]}"
```

### 5.5.4 从 data URL 导入（截图结果）

```bash
curl -s -X POST http://127.0.0.1:41596/api/v1/asset/importFromDataUrl \
  -H "Content-Type: application/json" \
  -d "{\"dataUrl\":\"data:image/jpeg;base64,/9j/4AAQ...\",\"filename\":\"screenshot.jpg\",\"duplicatePolicy\":\"use_existing\"}"
```

说明：`dataUrl` 仅支持 `data:<mime>;base64,...`，由插件生成（如区域/元件/整页截图 canvas 输出）。

### 5.6 删除资产

```bash
curl -s -X DELETE http://127.0.0.1:41596/api/v1/asset/delete \
  -H "Content-Type: application/json" \
  -d "{\"ids\":[\"uuid-1\",\"uuid-2\"]}"
```

### 5.7 更新备注 / 来源链接

```bash
# 更新备注
curl -s -X PATCH http://127.0.0.1:41596/api/v1/asset/update \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"资产UUID\",\"notes\":\"API 写入的备注\"}"

# 设置来源链接
curl -s -X PATCH http://127.0.0.1:41596/api/v1/asset/update \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"资产UUID\",\"sourceUrl\":\"https://www.behance.net/gallery/12345\"}"

# 清空来源链接
curl -s -X PATCH http://127.0.0.1:41596/api/v1/asset/update \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"资产UUID\",\"sourceUrl\":\"\"}"
```

`sourceUrl` 仅接受 `http://` / `https://` 开头的合法 URL，空字符串表示清空链接。
`metadata` 为 JSON 对象，会序列化存入数据库。

### 5.8 文件夹与标签

```bash
# 文件夹树
curl -s http://127.0.0.1:41596/api/v1/folder/tree

# 创建文件夹
curl -s -X POST http://127.0.0.1:41596/api/v1/folder/create \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"参考图\",\"parentId\":null,\"color\":\"#64748b\"}"

# 创建标签并关联资产
curl -s -X POST http://127.0.0.1:41596/api/v1/tag/create \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"待修\",\"color\":\"#ef4444\"}"

curl -s -X POST http://127.0.0.1:41596/api/v1/tag/assign \
  -H "Content-Type: application/json" \
  -d "{\"assetIds\":[\"资产UUID\"],\"tagIds\":[\"标签UUID\"]}"
```

### 5.9 索引库专用

**重链源文件**（仅 `catalog` / `referenced` 资产）：

```bash
curl -s -X POST http://127.0.0.1:41596/api/v1/asset/relink \
  -H "Content-Type: application/json" \
  -d "{\"assetId\":\"资产UUID\",\"newSourcePath\":\"G:\\\\新路径\\\\file.jpg\"}"
```

**本地化（拷贝进完整库）：**

```bash
curl -s -X POST http://127.0.0.1:41596/api/v1/asset/localize \
  -H "Content-Type: application/json" \
  -d "{\"assetIds\":[\"uuid-1\",\"uuid-2\"]}"
```

---

## 6. 请求体字段速查

### POST `/asset/import`

| 字段 | 必填 | 说明 |
|------|------|------|
| `filePath` | 是 | 本机绝对路径 |
| `targetFolderId` | 否 | 逻辑文件夹 ID |
| `duplicatePolicy` | 否 | 默认 `use_existing` |

### POST `/asset/importFromURL`

| 字段 | 必填 | 说明 |
|------|------|------|
| `url` | 是 | http/https **直链**资源 URL（含 `.jpg` 等图片）；作品页 URL → `400 INVALID_REQUEST`（见 §3.6） |
| `filename` | 否 | 仅用于推断扩展名与原始文件名（如 `photo.jpg`） |
| `headers` | 否 | 下载时附加 HTTP 头（仅允许 `Referer`、`User-Agent`、`Accept`、`Accept-Language`），用于绕过防盗链 |
| `targetFolderId` | 否 | 逻辑文件夹 ID |
| `duplicatePolicy` | 否 | 默认 `use_existing` |

### POST `/asset/importBatch`

| 字段 | 必填 | 说明 |
|------|------|------|
| `filePaths` | 是 | 路径字符串数组 |
| `targetFolderId` | 否 | |
| `duplicatePolicy` | 否 | |

### POST `/asset/importFromURLBatch`

| 字段 | 必填 | 说明 |
|------|------|------|
| `items` | 是 | 数组：`[{ url: string, filename?: string }]` |
| `targetFolderId` | 否 | 逻辑文件夹 ID |
| `duplicatePolicy` | 否 | 默认 `use_existing` |

### POST `/asset/importFromDataUrl`

| 字段 | 必填 | 说明 |
|------|------|------|
| `dataUrl` | 是 | `data:<mime>;base64,...`（截图结果） |
| `filename` | 否 | 可选，用于推断文件名 |
| `targetFolderId` | 否 | 逻辑文件夹 ID |
| `duplicatePolicy` | 否 | 默认 `use_existing` |

### 整页截图会话（`fullPageSession`）

浏览器扩展将条带通过 `append.stripDataUrl` 写入当前资料库 `{libraryRoot}/remote-imports/inspect-{时间戳}/strip-NNNN.jpg`（`start.options.sessionId` 可指定 `inspect-{时间戳}`），最后 `finish` 纵向拼接并导入为 **一个** 图片资产。完整契约见扩展仓库 `docs/fullpage-stitch-session-api-spec.md`。

| 步骤 | 方法 | 说明 |
|------|------|------|
| 1 | `POST /asset/fullPageSession/start` | 返回 `sessionId`（`inspect-*`）、`tempDir`（资料库内路径）、`limits` |
| 2 | `POST /asset/fullPageSession/append` | `stripDataUrl` 或 `filePath`（须在 `tempDir` 内）；`stripIndex` 从 0 连续递增 |
| 3 | `POST /asset/fullPageSession/finish` | 拼接 + 入库；`deleteSessionFilesAfter` 控制是否删除条带目录 |
| 取消 | `DELETE /asset/fullPageSession/{sessionId}` | 删除临时目录，不入库 |
| 查询 | `GET /asset/fullPageSession/{sessionId}` | `state`、`stripsReceived` 等 |

`finish` 成功后资产 `metadata` 含 `captureType: "fullpage"`；`sourceMeta.pageUrl` 写入 `sourceUrl`。

### Markdown 资料包会话（`articleBundleSession`）

浏览器扩展将网页正文提取为 Markdown，并将相关图片/视频下载到临时目录，最后通过 `finish` 将整个目录导入为 **一个** 资产。完整契约见扩展仓库 `docs/page-markdown-export-pro-requirements.md`。

| 步骤 | 方法 | 说明 |
|------|------|------|
| 1 | `POST /asset/articleBundleSession/start` | 返回 `sessionId`（`ab_*`）、`tempDir`（系统下载目录下的临时路径）、`limits` |
| 2 | `POST /asset/articleBundleSession/append` | `filePath`（本机路径，须在 `tempDir` 内）、`fileDataUrl`（base64，由 Pro 写入 `tempDir/relativePath`）、或 `sourceUrl` + 可选 `headers`（由 Pro 主进程下载，与 `importFromURL` 相同，可带 `Referer`）；三选一 |
| 辅助 | `POST /asset/fetchRemoteBody` | 主进程下载 URL 并返回 `dataUrl`（带 `Referer` 等 headers；不入库；用于资料包图片回退） |
| 3 | `POST /asset/articleBundleSession/finish` | 校验必备文件（`.md` 和 `_thumb.jpg`）后，将整个目录移入资料库并注册为单资产 |
| 取消 | `DELETE /asset/articleBundleSession/{sessionId}` | 删除临时目录，不入库 |
| 查询 | `GET /asset/articleBundleSession/{sessionId}` | `state`、`filesCount` 等 |

`finish` 成功后资产 `metadata` 含 `captureType: "article_bundle"`；`sourceMeta.pageUrl` 写入 `sourceUrl`。资产的主文件为该 `.md` 文件，缩略图为 `_thumb.jpg`。

### 作品页视频导入（`pageVideoImport`）

浏览器扩展提交 **作品页 URL**（YouTube watch、B 站 BV、抖音 `/video/` 等），由本机 **yt-dlp** 子进程解析下载并入库；**CDN 直链**仍走 `importFromURL`（§3.6）。实现为内存 Job 队列 + 磁盘快照，**非**同步阻塞接口。

**yt-dlp 二进制：** 优先 `{userData}/AssetVault/bin/yt-dlp(.exe)`（首次缺失时从 GitHub Release 自动下载）；其次 `ASSETVAULT_YTDLP_PATH` / `YTDLP_PATH`、`resources/bin`、Windows pip Scripts、PATH。`GET /app/info` 的 `features` 含 `pageVideoImport` 表示当前进程能 `spawn` 成功；若刚下载完成，可再请求一次 `app/info`（会重试探测托管路径）。

| 步骤 | 方法 | 说明 |
|------|------|------|
| 能力 | `GET /app/info` | `features` 含 `pageVideoImport`；`ytdlp.version`、`limits.pageVideoImport`（见下表） |
| 1 | `POST /asset/pageVideoImport` | 返回 `jobId`（`pvi_*`）、`status: queued`、`pollAfterMs`（默认 1500） |
| 2 | `GET /asset/pageVideoImport/jobs/{jobId}` | 轮询 `status` / `stage` / `progressPercent`；终态含 `assetId`、`skipped` 或 `error` |
| 取消 | `DELETE /asset/pageVideoImport/jobs/{jobId}` | 见下文「取消」 |
| 批量 | `POST /asset/pageVideoImport/batch` | `batchId`（`pvb_*`）+ `jobs[]`；顶层字段可被 `items[]` 覆盖（与单条解析一致） |
| 批量查询 | `GET /asset/pageVideoImport/batch/{batchId}` | 该批次全部 job；无记录 → `404 BATCH_NOT_FOUND`（含终态 job 已被 24h 清理的情况） |

**`limits.pageVideoImport`（与代码一致）：**

| 字段 | 默认 | 含义 |
|------|------|------|
| `maxBatchItems` | 50 | 单次 batch 条数上限 |
| `maxConcurrentJobs` | 2 | 配置上限；**当前实现**同一时刻通常只跑 **1** 个 yt-dlp 子进程（上一 job 结束后才 `pump` 下一个） |
| `maxActiveJobs` | 100 | **queued + running** 总数上限，满则 `429 PAGE_VIDEO_QUEUE_FULL` |
| `jobTimeoutMs` | 3600000 | 单 job 总时长 → `YTDLP_JOB_TIMEOUT` |
| `stallTimeoutMs` | 600000 | stderr 无进度 → `YTDLP_STALLED` |
| `pollIntervalMsRecommended` | 1500 | 建议轮询间隔 |

**Job 状态：** `queued` → `running` → `completed` | `failed` | `cancelled`。`stage` 可为 `extracting` / `downloading` / `postprocessing` / `importing` / `done`。

**持久化：** `{userData}/AssetVault/page-video-jobs.json`（约 400ms 防抖写入；**可能含 `cookieHeader` 明文**）。重启后：`running` → `failed`（`YTDLP_INTERRUPTED`）；`queued` 重建 temp 目录并重新排队。终态 job 在内存保留约 **24h**（`jobRetentionMs`）后从 Map 剔除，快照同步变少。

**取消：**

| 原状态 | 行为 |
|--------|------|
| `queued` | 立即 `cancelled`，删除 temp，`filesRemoved: true` |
| `running` | 设 `cancelRequested` 并 `kill` yt-dlp；响应仍为 `status: running`、`filesRemoved: false`，须轮询至 `cancelled` 后 temp 才清理 |

**与 `importFromURL` 分界：** 代码用 `isPageVideoWorkUrl`（**正向匹配** YouTube watch、B 站 BV 等作品页；**非**「凡非直链即作品页」）判断。图片直链（如 `img.pc520.net/.../*.jpg`）走 `importFromURL` / `fetchRemoteBody`；作品页误走 `importFromURL` → `400 INVALID_REQUEST` + `details.useEndpoint`。

**`duplicatePolicy`：** `use_existing` 在 **yt-dlp 下载前** 按 `sourceUrl`（`sourceMeta.pageUrl` 或 `url`）查库，命中则 `skipped`。**`replace` 未实现**：按 `import_copy` 处理，job `warnings` 含 `REPLACE_NOT_IMPLEMENTED`。

**Cookie（单条与批量相同）：** 优先级 `cookiesFile` > `cookieHeader` > `cookiesFromBrowser`；file 与 header 不可同时传。未传时默认 `cookiesFromBrowser: "none"`（**不是** edge）。有 file/header 时强制 `cookiesFromBrowser: none`。  
Cookie 库复制失败（DPAPI 等）时，仅 **`youtube` / `vimeo` / `twitter`**（或 `platform` 省略）且原策略非 `none` 会自动重试 `none`，warning `COOKIE_FALLBACK_NONE`；**B 站等不会自动回退**。

**清晰度：** 未传 `format` 时按 `platform` 选预设（如 `bilibili` → 1080p DASH 合并串）。需有效登录 Cookie（B 站常需 `cookieHeader` + `SESSDATA`）。

**字幕 `options.writeSubs`：** yt-dlp 会 `--write-subs` 写到 job 的 temp 目录，但入库 **仅选取最大视频文件**（`.mp4` 等），**字幕文件不会进入资料库**，成功后 temp 会删除。

**体积：** 作品页管线 **无** 单文件 300MB 上限；`importFromURL` 仍受 §3.6 限制。

**入库：** `sourceUrl` = `sourceMeta.pageUrl`（缺省 `url`）；`metadata.importPipeline` = `pageVideoImport`。

**常见错误码（HTTP 多为 422，队列满 429，无库 503）：**

| code | 说明 |
|------|------|
| `YTDLP_NOT_INSTALLED` | 无可用 yt-dlp（503 于 create 前探测失败） |
| `YTDLP_AUTH_REQUIRED` | 需登录 |
| `YTDLP_COOKIE_COPY_FAILED` | 浏览器 Cookie 库读取失败 |
| `YTDLP_EXTRACTOR_FAILED` | 无法解析页面 |
| `YTDLP_DOWNLOAD_FAILED` | 其它下载失败 |
| `YTDLP_POSTPROCESS_FAILED` | 合并/ffmpeg 失败 |
| `YTDLP_STALLED` | 长时间无进度 |
| `YTDLP_JOB_TIMEOUT` | 超过 `jobTimeoutMs` |
| `YTDLP_INTERRUPTED` | 应用重启时原 `running` job |
| `PAGE_VIDEO_NOT_SUPPORTED` | 直链 URL 误走本接口 |
| `PAGE_VIDEO_QUEUE_FULL` | 活跃 job 数达上限 |
| `JOB_NOT_FOUND` | 无此 job（探针 `pvi___capability_probe___` 亦为此码） |
| `BATCH_NOT_FOUND` | 无此 batchId 下 job |
| `COOKIES_FILE_NOT_FOUND` | `cookiesFile` 路径不存在 |
| `LIBRARY_NOT_READY` | 资料库未初始化（**非** `LIBRARY_NOT_OPEN`） |

**请求体速查（单条 / batch 项）：** `url`（必填）、`platform`、`format`、`cookiesFromBrowser`（`edge`/`chrome`/`firefox`/`none`）、`cookiesFile`、`cookieHeader`、`targetFolderId`、`duplicatePolicy`、`sourceMeta`、`options`（`writeSubs`、`subtitleLangs`、`noPlaylist` 默认 true）。

### POST `/folder/create`

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | 是 | 文件夹名称 |
| `parentId` | 否 | 父级 ID，`null` 为根 |
| `color` | 否 | 十六进制颜色 |
| `icon` | 否 | emoji 或库内图标路径 |

### POST `/folder/move`

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | 要移动的文件夹 |
| `newParentId` | 否 | 目标父级；`null` 表示根目录 |

### POST `/tag/assign` 与 `/tag/remove`

| 字段 | 必填 | 说明 |
|------|------|------|
| `assetIds` | 是 | 资产 ID 数组 |
| `tagIds` | 是 | 标签 ID 数组 |

---

## 7. 错误码

| code | HTTP | 含义 |
|------|------|------|
| `INVALID_REQUEST` | 400 | 参数错误；URL 导入时可能为：无效 url、非 http(s)、不支持的扩展名、**下载超限**、远程返回非 2xx |
| `UNAUTHORIZED` | 401 | 远程模式未带有效 Token |
| `ASSET_NOT_FOUND` | 404 | 资产不存在 |
| `FOLDER_NOT_FOUND` | 404 | 文件夹不存在 |
| `TAG_NOT_FOUND` | 404 | 标签不存在 |
| `FILE_NOT_FOUND` | 400 | 导入路径不存在 |
| `FILE_NOT_FILE` | 400 | 路径不是文件 |
| `FILE_NOT_DIRECTORY` | 400 | 路径不是目录 |
| `LIBRARY_NOT_READY` | 503 | 资料库未初始化（**作品页视频** `pageVideoImport` 等） |
| `LIBRARY_NOT_OPEN` | 503 | 资料库未就绪（**整页截图**等会话接口文案） |
| `PAGE_VIDEO_NOT_SUPPORTED` | 422 | 直链 URL 误用 `pageVideoImport` |
| `PAGE_VIDEO_QUEUE_FULL` | 429 | 作品页视频活跃 job 数达上限 |
| `JOB_NOT_FOUND` | 404 | 作品页视频 job 不存在 |
| `BATCH_NOT_FOUND` | 404 | 作品页视频 batch 无 job |
| `YTDLP_*` | 422/503 | 作品页视频 yt-dlp 相关失败（见 §作品页视频导入） |
| `COOKIES_FILE_NOT_FOUND` | 400 | `cookiesFile` 路径无效 |
| `FULLPAGE_SESSION_*` | 400/404/409/500 | 整页会话：路径、顺序、尺寸、拼接或入库失败 |
| `ARTICLE_BUNDLE_*` | 400/404/409/500 | Markdown 资料包会话：路径、大小、数量限制或入库失败 |
| `NOT_FOUND` | 404 | 未知路由 |
| `INTERNAL_ERROR` | 500 | 服务端异常 |

---

## 8. Python 最小示例

```python
import requests

BASE = "http://127.0.0.1:41596/api/v1"
# TOKEN = "your-token"  # 若开启远程访问
# HEADERS = {"Authorization": f"Bearer {TOKEN}"}
HEADERS = {}

# 资料库类型
info = requests.get(f"{BASE}/library/info", headers=HEADERS, timeout=10).json()
print("libraryMode:", info["data"]["libraryMode"])

# 本机路径导入
r = requests.post(
    f"{BASE}/asset/import",
    headers={**HEADERS, "Content-Type": "application/json"},
    json={"filePath": r"G:\images\test.jpg"},
    timeout=60,
)
print(r.json())

# 从 URL 导入（浏览器扩展场景）
r_url = requests.post(
    f"{BASE}/asset/importFromURL",
    headers={**HEADERS, "Content-Type": "application/json"},
    json={"url": "https://example.com/photo.jpg", "duplicatePolicy": "use_existing"},
    timeout=120,
)
body = r_url.json()
print(body)
if body.get("status") == "success" and body["data"].get("assetId"):
    tag = requests.post(
        f"{BASE}/tag/assign",
        headers={**HEADERS, "Content-Type": "application/json"},
        json={"assetIds": [body["data"]["assetId"]], "tagIds": ["标签UUID"]},
        timeout=30,
    )
    print(tag.json())

# 查询
q = requests.get(
    f"{BASE}/asset/get",
    params={"limit": 10, "search": "test"},
    headers=HEADERS,
    timeout=30,
).json()
print("total:", q["data"]["total"])
```

---

## 9. 限制与后续计划

**当前 v1 不支持：**

- multipart / 表单直传（可用 **本机路径** 或 **URL 由主进程下载**）
- 切换活动资料库（`library/switch` 未开放）
- 缩略图二进制下载、导入进度 SSE（计划 Phase 3）

**浏览器扩展相关（已支持）：**

- `POST /asset/importFromURL`、`POST /asset/importFromURLBatch`（**直链**；作品页会 400）
- `POST /asset/pageVideoImport` 及 batch / `GET jobs/{id}` / `GET batch/{id}` / `DELETE jobs/{id}`（**作品页视频**，yt-dlp）
- 标签须导入后调用 `POST /tag/assign`

**与 UI 的关系：**

- API 与界面共用同一套数据库与服务层；导入、查询结果应与 Ctrl+I 导入、筛选栏一致（重复策略除外：API 默认不弹窗）。

---

## 10. 相关文件

| 文件 | 说明 |
|------|------|
| `doc/web-api-v1-guide.md` | 本文档 |
| `doc/web-api-v1-design.md` | 设计与实现说明 |
| `doc/web-api-v1-openapi.yaml` | OpenAPI 3.1 |
| `doc/README.md` | 全项目文档索引 |
| `resources/api-playground/index.html` | Playground 页面源码 |

如有接口行为与文档不一致，以当前版本源码与 OpenAPI 为准，欢迎反馈。
