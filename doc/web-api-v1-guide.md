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
- 导入接口的 `filePath` / `folderPath` 须为 **本机绝对路径**（如 `G:\images\a.jpg`）。
- v1 **不支持** multipart 上传；文件须已在磁盘上。

### 3.5 导入重复策略

`duplicatePolicy` 可选值（HTTP 默认 `use_existing`，不会弹窗）：

| 值 | 说明 |
|----|------|
| `use_existing` | 同路径或同内容已存在则跳过，返回 `skipped: true` |
| `import_copy` | 强制再导入一份 |
| `ask` | API 中等价于 `use_existing` |

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
| GET | `/api/v1/app/info` | 应用版本、是否打包等 |

### Library（资料库）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/library/info` | 当前库元数据、**libraryMode**、统计 |
| GET | `/api/v1/library/state` | 活动库路径、最近库列表 |

`libraryMode`：`catalog` = 索引库（引用原路径），`archive` = 完整库（拷贝进库）。

### Asset（资产）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/asset/get` | 分页查询（Query 参数） |
| POST | `/api/v1/asset/get` | 复杂查询（Body，同 GET 参数） |
| GET | `/api/v1/asset/info?id=` | 单条资产详情 |
| POST | `/api/v1/asset/import` | 从本机路径导入单个文件 |
| POST | `/api/v1/asset/importBatch` | 批量导入 |
| POST | `/api/v1/asset/importFolder` | 递归导入文件夹 |
| DELETE | `/api/v1/asset/delete` | 删除资产 |
| PATCH | `/api/v1/asset/update` | 更新 notes / metadata |
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

### 5.6 删除资产

```bash
curl -s -X DELETE http://127.0.0.1:41596/api/v1/asset/delete \
  -H "Content-Type: application/json" \
  -d "{\"ids\":[\"uuid-1\",\"uuid-2\"]}"
```

### 5.7 更新备注

```bash
curl -s -X PATCH http://127.0.0.1:41596/api/v1/asset/update \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"资产UUID\",\"notes\":\"API 写入的备注\"}"
```

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

### POST `/asset/importBatch`

| 字段 | 必填 | 说明 |
|------|------|------|
| `filePaths` | 是 | 路径字符串数组 |
| `targetFolderId` | 否 | |
| `duplicatePolicy` | 否 | |

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
| `INVALID_REQUEST` | 400 | 参数错误 |
| `UNAUTHORIZED` | 401 | 远程模式未带有效 Token |
| `ASSET_NOT_FOUND` | 404 | 资产不存在 |
| `FOLDER_NOT_FOUND` | 404 | 文件夹不存在 |
| `TAG_NOT_FOUND` | 404 | 标签不存在 |
| `FILE_NOT_FOUND` | 400 | 导入路径不存在 |
| `FILE_NOT_FILE` | 400 | 路径不是文件 |
| `FILE_NOT_DIRECTORY` | 400 | 路径不是目录 |
| `LIBRARY_NOT_READY` | 503 | 资料库未初始化 |
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

# 导入
r = requests.post(
    f"{BASE}/asset/import",
    headers={**HEADERS, "Content-Type": "application/json"},
    json={"filePath": r"G:\images\test.jpg"},
    timeout=60,
)
print(r.json())

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

- HTTP 上传文件（仅本机路径导入）
- 切换活动资料库（`library/switch` 未开放）
- 缩略图二进制下载、导入进度 SSE（计划 Phase 3）

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
