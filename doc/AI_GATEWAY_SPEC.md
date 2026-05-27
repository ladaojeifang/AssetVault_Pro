# AI 网关对接规范

> AssetVault Pro · AI 画布与自建统一网关的接口与校验规范  
> 版本：1.0 · 2026-05-20

---

## 1. 概述

### 1.1 定位

AssetVault Pro 的 AI 画布通过 **自建统一网关** 调用各厂商模型。客户端 **不持有** 各 Vendor API Key，仅配置：

- 网关 Base URL
- 用户 **API Token**

`modeconfig.json` 的数据 **结构与 LibTV 类似**，但 **发布、账号、计费、路由均与 LibTV 无关**。

### 1.2 架构

```
┌─────────────────┐     IPC      ┌──────────────────┐     HTTPS      ┌─────────────┐
│  Renderer       │ ◄──────────► │  Electron Main   │ ◄────────────► │  AI 网关    │
│  (画布 UI)      │              │  GatewayClient   │                │             │
└─────────────────┘              └──────────────────┘                └──────┬──────┘
        │                                  │                                │
        │ modeconfig catalog               │ Token / 缓存                   │ Provider 适配器
        └──────────────────────────────────┘                                ▼
                                                                    Google / OpenAI / 火山 …
```

| 组件 | 职责 |
|------|------|
| **网关** | 鉴权、积分计价与扣费、`modelCode` 路由、调上游 API、异步任务 |
| **modeconfig**（网关下发） | 模型列表、参数 UI、连线规则、`allowNodeType` 数量限制 |
| **客户端 Main** | HTTP、Token 存储、素材上传、组包 `inputs`、轮询任务、结果入库 |
| **客户端 Renderer** | 展示模型/参数/积分确认；**不持有 Token** |

### 1.3 已定产品决策

| 项 | 决策 |
|----|------|
| 认证 | **仅 API Token**（`Authorization: Bearer`） |
| 计费展示 | **每任务积分**由网关 `estimate` 计算；UI 在生成前展示 |
| modeconfig | **应用启动时从网关拉取**，本地缓存 + bundled 兜底 |

---

## 2. 认证与通用约定

### 2.1 请求头

```http
Authorization: Bearer <api_token>
Content-Type: application/json
X-Client-Version: 0.5.0-alpha
X-Platform: electron-win | electron-mac | electron-linux
X-Request-Id: <uuid>          # 可选，对账用
```

### 2.2 Token 存储（客户端）

- 存 Electron `safeStorage` / 系统 Keychain
- 401 → 提示用户到网关控制台更换 Token
- **无** OAuth / 刷新 Token 流程

### 2.3 统一错误响应

```json
{
  "success": false,
  "errCode": "INSUFFICIENT_POINTS",
  "errMessage": "积分不足",
  "details": {}
}
```

| HTTP | errCode | 说明 |
|------|---------|------|
| 401 | `AUTH_INVALID` | Token 无效 |
| 402 | `INSUFFICIENT_POINTS` | 积分不足 |
| 403 | `MODEL_DISABLED` | 模型未开通 |
| 409 | `ESTIMATE_EXPIRED` | 估价已过期，需重新 estimate |
| 429 | `RATE_LIMITED` | 限流 |
| 503 | `PROVIDER_UNAVAILABLE` | 上游故障 |

校验类 errCode 见 [§6.4](#64-校验错误码)。

### 2.4 Base URL

默认示例：`https://api.yourdomain.com/v1`

---

## 3. HTTP 接口

### 3.1 接口清单

| 方法 | 路径 | 时机 |
|------|------|------|
| GET | `/health` | 可选，连通性 |
| GET | `/modeconfig` | **启动**（有 Token） |
| GET | `/models` | **启动** + 刷新余额/价目 |
| POST | `/assets` | 上游含本地文件时 |
| POST | `/assets/init` | 可选，大文件预签名上传 |
| POST | `/generate/estimate` | **每次生成前** |
| POST | `/generate` | 用户确认后 |
| GET | `/tasks/{taskId}` | 轮询至终态 |
| DELETE | `/tasks/{taskId}` | 可选，取消排队任务 |

---

### 3.2 `GET /modeconfig`

**Query（可选）**

| 参数 | 说明 |
|------|------|
| `version` | 客户端缓存的 `releaseVersion`，用于 304 |
| `locale` | `zh` / `en` |

**Response 200**

```json
{
  "success": true,
  "errCode": null,
  "errMessage": null,
  "releaseVersion": "release/1.15.0_260520(1123)",
  "checksum": "sha256:…",
  "publishedAt": "2026-05-20T08:00:00Z",
  "data": [
    {
      "canvasNodeType": "GENERATE_IMAGE",
      "nodeConfig": [ /* 见 modeConfigTypes.ts */ ]
    }
  ]
}
```

- `data[]` 结构与仓库内 `modeconfig.json` 一致
- **304 Not Modified**：客户端继续使用本地缓存

**客户端策略**

| 时机 | 行为 |
|------|------|
| App 启动且有 Token | Main 拉取 → 内存 + `userData/ai-gateway/modeconfig.json` |
| 无 Token | bundled 兜底，标注「未连接网关」 |
| 拉取失败 | 上次缓存 → bundled |
| 打开 AI 画布 | 使用已加载 catalog，不重复拉（除非 version 变更） |

---

### 3.3 `GET /models`

返回模型运行态与 **参考单价**（下拉展示「约 X 积分起」）。

```json
{
  "balance": 1280,
  "currency": "points",
  "models": [
    {
      "modelCode": "KLING_V3",
      "enabled": true,
      "restricted": false,
      "canvasNodeTypes": ["GENERATE_VIDEO"],
      "pointsFrom": 80,
      "pointsHint": "按分辨率与时长浮动",
      "async": true,
      "avgDurationSec": 120
    }
  ]
}
```

| 字段 | 用途 |
|------|------|
| `balance` | 设置页 / 画布顶栏 |
| `pointsFrom` | 模型下拉旁起价 |
| `enabled` | `false` 时下拉置灰 |

---

### 3.4 `POST /assets`

`multipart/form-data`：`file` + 可选 `kind=image|video|audio`

**Response 200**

```json
{
  "assetRef": "ast_abc",
  "mime": "image/png",
  "sizeBytes": 1048576,
  "expiresAt": "2026-05-21T12:00:00Z"
}
```

- `generate` / `estimate` 的 `inputs` **只认 `assetRef` 或 inline `text`**
- 不认本地路径、blob URL、`file://`

**大文件（可选）**

1. `POST /assets/init` → 预签名 URL + `assetRef`
2. 客户端直传对象存储
3. `POST /assets/complete`

---

### 3.5 `POST /generate/estimate`

生成前 **必调**。请求体与 `/generate` 相同（不含扣费）。

**Request**

```json
{
  "modelCode": "KLING_V3",
  "canvasNodeType": "GENERATE_VIDEO",
  "params": {
    "prompt": "雨夜屋顶…",
    "resolution": "720P",
    "duration": "5",
    "aspectRatio": "16:9",
    "referModel": "referToVideo"
  },
  "inputs": [
    {
      "nodeType": "BASE_IMAGE",
      "sourceNodeId": "base_image-001",
      "order": 0,
      "payload": { "assetRef": "ast_001" }
    }
  ],
  "batchCount": 1,
  "clientRef": "canvas:{canvasId}:node:{nodeId}"
}
```

**Response 200**

```json
{
  "estimateId": "est_xyz",
  "pointsCost": 96,
  "balance": 1280,
  "sufficient": true,
  "expiresAt": "2026-05-20T10:01:00Z",
  "breakdown": [
    { "item": "base", "points": 80, "note": "KLING_V3 720P" },
    { "item": "duration", "points": 16, "note": "5s" }
  ],
  "warnings": []
}
```

| 字段 | 说明 |
|------|------|
| `estimateId` | 短有效期（建议 60s），`/generate` 须携带 |
| `pointsCost` | **本次将扣积分**（UI 主数字） |
| `sufficient` | `false` 时仍返回 cost，客户端禁用确认 |

**UI**：点「生成」→ estimate → 展示「本次消耗 96 积分（余额 1280）」→ 用户确认 → `/generate`。

---

### 3.6 `POST /generate`

**Request**：同 estimate，**必须**带 `estimateId`（有效期内）。

**Response 202**

```json
{
  "taskId": "tsk_123",
  "status": "queued",
  "pointsCharged": 96,
  "balanceAfter": 1184,
  "pollAfterMs": 2000
}
```

- **`pointsCharged` 以本响应为准**
- estimate 过期 → 409 `ESTIMATE_EXPIRED`

---

### 3.7 `GET /tasks/{taskId}`

```json
{
  "taskId": "tsk_123",
  "status": "running",
  "progress": 45,
  "modelCode": "KLING_V3",
  "canvasNodeType": "GENERATE_VIDEO",
  "pointsCharged": 96,
  "refundable": false,
  "error": null,
  "outputs": []
}
```

**status**：`queued` | `running` | `success` | `failed` | `cancelled`

**success 时 outputs 示例**

```json
"outputs": [
  {
    "type": "video",
    "url": "https://…/signed.mp4",
    "mime": "video/mp4",
    "expiresAt": "2026-05-21T…",
    "width": 1280,
    "height": 720
  }
]
```

客户端 Main：下载 → 导入素材库 → 回写节点 `assetId` / `previewUrl`。

**失败退款**

| 终态 | 建议 |
|------|------|
| `failed` + `refundable: true` | UI：「已退回 N 积分」 |
| `failed` + `refundable: false` | 仅展示原因 |

---

## 4. 模型查找与网关内部路由

### 4.1 查找键

```
(canvasNodeType, modelCode, releaseVersion) → modeconfig 条目
```

**禁止**仅用 `modelCode` 定位配置。例如 `BANANA_PRO` 同时存在于：

| canvasNodeType | 差异 |
|----------------|------|
| `GENERATE_IMAGE` | 可连文本+图片；多模态规则 |
| `GENERATE_STORYBOARD` | **仅图片**；分镜业务 |

### 4.2 网关内部 taskKind

| canvasNodeType | taskKind | 说明 |
|----------------|----------|------|
| `GENERATE_TEXT` | `text` | |
| `GENERATE_IMAGE` | `image` | |
| `GENERATE_VIDEO` | `video` | 多为 async |
| `GENERATE_AUDIO` | `audio` | |
| `GENERATE_STORYBOARD` | `storyboard` | 可与 image 共用 remoteModelId，后处理不同 |

### 4.3 Provider 分组（网关后台，用户不可见）

39 个唯一 `modelCode` 建议由约 12 个 Provider 适配器承载：

| Provider | 覆盖 modelCode（示例） |
|----------|------------------------|
| `google` | `GEMINI_*`, `VEO31*` |
| `openai` | `GPT_IMAGE_*`, `SORA_2` |
| `volcengine` | `DOUBAO_*`, `DOUBAO_SEEDREAM_*`, `JIMENG_*`, `PIXDANCE_*`, `SEEDANCE_*` |
| `kling` | `KLING_*` |
| `dashscope` | `QWEN_*`, `WAN2_6` |
| `minimax` | `HAILUO_*` |
| `vidu` | `VIDU_*` |
| `pixverse` | `PIXVERSE_*` |
| `midjourney` | `MIDJOURNEY` |
| `elevenlabs` | `ELEVENLABS_*` |
| `happyhorse` | `HAPPYHORSE_10` |
| `mock` | 开发占位 |

完整 modelCode 列表见仓库 `modeconfig.json` 或 `node_type.md`。

---

## 5. inputs 与 modeconfig 对齐

### 5.1 ConfigNodeType 枚举

与 `src/shared/modeConfigTypes.ts` 一致：

```
BASE_TEXT | BASE_IMAGE | BASE_VIDEO | BASE_AUDIO
GENERATE_TEXT | GENERATE_IMAGE | GENERATE_VIDEO | GENERATE_AUDIO | GENERATE_STORYBOARD
```

画布 Flow type（`base_image`）→ Config type（`BASE_IMAGE`）映射见 `canvasNodeTypes.ts`。

### 5.2 两层校验

#### 层 A：`allowInputNodeTypes`

每条 `inputs[].nodeType` 必须 ∈ 该模型条目的 `allowInputNodeTypes`。

对应客户端连线校验：`canConnectNodes()`。

#### 层 B：`modelConfig.allowNodeType`

对每条规则：

```json
{
  "codes": ["BASE_IMAGE", "GENERATE_IMAGE"],
  "length": "[0,14]",
  "allTextLength": null
}
```

统计 `inputs` 中 `nodeType ∈ codes` 的数量，须在 `length` 闭区间内。

| length | 含义 |
|--------|------|
| `[0,14]` | 0～14 个 |
| `[0,0]` | **必须为 0** |
| `[1,15]` | 至少 1 个 |

**层 A 通过 ≠ 层 B 通过。**

### 5.3 单条 input 结构

```json
{
  "nodeType": "BASE_IMAGE",
  "sourceNodeId": "base_image-xxx",
  "order": 0,
  "payload": { "assetRef": "ast_..." }
}
```

| nodeType | payload |
|----------|---------|
| `BASE_TEXT` | `{ "text": "..." }` |
| `GENERATE_TEXT` | `{ "text": "...", "translatedText?": "..." }` |
| `BASE_IMAGE` | `{ "assetRef": "..." }` |
| `GENERATE_IMAGE` | `{ "assetRef": "..." }` |
| `GENERATE_STORYBOARD` | `{ "assetRef": "..." }` |
| `BASE_VIDEO` / `GENERATE_VIDEO` | `{ "assetRef": "..." }` |
| `BASE_AUDIO` / `GENERATE_AUDIO` | `{ "assetRef": "..." }` 或 `{ "text": "..." }` |

- `params.prompt`：节点主提示词
- 上游文本：**补充 context**，不替代 prompt
- 多张参考图：**多条 input**，同 `nodeType` 用 `order` 区分顺序

### 5.4 params 校验

对 `modelConfig.params`：

| type | 规则 |
|------|------|
| `text` | 长度 ∈ `length`（如 `[1,1024]`） |
| `select` / `radio` | value ∈ `options[].value` |
| `switch` | `"true"` / `"false"` |

### 5.5 referModel 与 dependOn

视频等模型的 `referModel` 选项带 `dependOn`（`type: "inputNodeTypes"`）。

网关逻辑（与 UI `isReferModelOptionEnabled` 一致）：

1. 按 `inputs` 统计各 `inValues` 计数
2. 每条 `dependOn`：`count ∈ parseLength(length)`
3. 某 `referModel` 值 **当且仅当** 其全部 `dependOn` 通过才合法
4. 请求中 `params.referModel` 必须是当前 inputs 下的合法选项

示例（`PIXDANCE_2`）：

| referModel | 要点 |
|------------|------|
| `textToVideo` | 可有文本；图/视/音计数须为 0 |
| `referToVideo` | 图≤9、视≤3、音≤3；媒体合计 ≥1 |

### 5.6 batchCount

- 来自 `params.count`（1/2/4…），客户端 cap 建议 8
- `GENERATE_TEXT`：固定 `1`
- 积分：`pointsCost` 含 batch 总价

### 5.7 校验顺序（estimate / generate 共用）

```
1. Token 有效
2. modeconfig 存在 (canvasNodeType, modelCode)
3. /models 中 enabled === true
4. params 完整 + 类型/枚举/长度
5. inputs[].nodeType ∈ allowInputNodeTypes
6. 每条 allowNodeType 规则计数 ∈ length
7. referModel 等与 inputs 一致的 dependOn
8. payload 非空；assetRef 有效未过期
9. batchCount 合法
10. → 计价（estimate）或扣费建 task（generate）
```

**estimate 与 generate 必须共用同一 validate 函数。**

### 5.8 校验错误码

| errCode | 场景 |
|---------|------|
| `VALIDATION_UNKNOWN_MODEL` | modelCode + canvasNodeType 不存在 |
| `VALIDATION_INPUT_TYPE` | nodeType 不在 allowInputNodeTypes |
| `VALIDATION_INPUT_COUNT` | allowNodeType 计数越界 |
| `VALIDATION_PARAM` | prompt 过长、枚举非法 |
| `VALIDATION_REFER_MODEL` | referModel 与上游不匹配 |
| `VALIDATION_ASSET` | assetRef 无效/过期 |

失败响应示例：

```json
{
  "success": false,
  "errCode": "VALIDATION_INPUT_COUNT",
  "errMessage": "参考图片数量超出限制",
  "details": {
    "field": "inputs",
    "rule": {
      "codes": ["BASE_IMAGE", "GENERATE_IMAGE"],
      "length": "[0,9]",
      "actual": 12
    }
  }
}
```

---

## 6. 请求示例

### 6.1 纯文生图

```json
{
  "modelCode": "GPT_IMAGE_2",
  "canvasNodeType": "GENERATE_IMAGE",
  "params": {
    "prompt": "赛博朋克街景",
    "quality": "medium",
    "resolution": "1K",
    "aspectRatio": "1:1",
    "count": "1"
  },
  "inputs": [],
  "batchCount": 1
}
```

### 6.2 图生视频（2 图 + 1 视频）

```json
{
  "modelCode": "KLING_V3",
  "canvasNodeType": "GENERATE_VIDEO",
  "params": {
    "prompt": "镜头缓慢推进",
    "resolution": "720P",
    "duration": "5",
    "referModel": "referToVideo"
  },
  "inputs": [
    { "nodeType": "BASE_IMAGE", "order": 0, "payload": { "assetRef": "ast_a" } },
    { "nodeType": "BASE_IMAGE", "order": 1, "payload": { "assetRef": "ast_b" } },
    { "nodeType": "BASE_VIDEO", "order": 0, "payload": { "assetRef": "ast_v" } }
  ],
  "batchCount": 1
}
```

### 6.3 分镜（同 modelCode，不同 canvasNodeType）

```json
{
  "modelCode": "BANANA_PRO",
  "canvasNodeType": "GENERATE_STORYBOARD",
  "params": {
    "prompt": "四格分镜",
    "resolution": "2K",
    "aspectRatio": "16:9",
    "count": "1"
  },
  "inputs": [
    { "nodeType": "BASE_IMAGE", "order": 0, "payload": { "assetRef": "ast_1" } },
    { "nodeType": "GENERATE_IMAGE", "order": 1, "payload": { "assetRef": "ast_2" } }
  ],
  "batchCount": 1
}
```

**不可**携带 `BASE_TEXT` input（不在 STORYBOARD 条目的 `allowInputNodeTypes` 中）。

---

## 7. 积分计价（网关侧）

在 validate 通过后计价。建议因子：

| 因子 | 示例 |
|------|------|
| 基础 | modelCode + canvasNodeType + resolution |
| 时长 | params.duration（视频） |
| 批量 | batchCount |
| 多模态 | 参考图每张 +N；参考视频 +M |
| 分镜 | taskKind=storyboard 加价 |

- 规则配置在 **网关服务端**，与 modeconfig 解耦
- `inputs` 或 `params` 变化 → 须重新 estimate
- 流水 ledger 关联 `taskId`、`pointsCharged`

---

## 8. 客户端设置页

```
┌─ AI 网关 ───────────────────────────────────────┐
│  网关地址   [ https://api.yourdomain.com/v1 ]   │
│  API Token  [ •••••••••••••••••••• ]  [显示]     │
│  连接状态   ● 已连接                             │
│  积分余额   1,280        （GET /models）         │
│  配置版本   release/1.15.0_… （GET /modeconfig） │
│  [ 测试连接 ]  [ 刷新配置与价目 ]                │
└─────────────────────────────────────────────────┘

┌─ 开发 ──────────────────────────────────────────┐
│  ☑ Mock 生成（不请求网关）                        │
└─────────────────────────────────────────────────┘
```

**测试连接**：`GET /models` → balance + 可用模型数 + modeconfig version。

**不在设置页**：各 Vendor Key、完整单价表（准确价格在生成 estimate 时展示）。

---

## 9. 画布 UI 与积分

| 位置 | 内容 |
|------|------|
| 模型下拉 | `Gemini 2.5 Flash · 约 2 积分起`（`/models.pointsFrom`） |
| 点「生成」 | estimate → **「本次 96 积分」** 确认 |
| 成功 | 可选：「已消耗 96 积分，余额 1184」 |
| 失败 | 错误 + 是否退款 |
| 顶栏（可选） | 积分余额 |

---

## 10. 客户端 IPC 通道（规划）

> 实现时在 `preload` + `main/ipc/handlers/` 注册。命名风格对齐现有 `aiCanvas:*`。

### 10.1 网关配置

| 通道 | 方向 | 说明 |
|------|------|------|
| `aiGateway:getSettings` | invoke → | `{ baseUrl, hasToken }`（不回传明文 Token） |
| `aiGateway:saveSettings` | invoke → | `{ baseUrl, token? }` |
| `aiGateway:testConnection` | invoke → | 调 `/models`，返回 balance、modelCount、modeconfigVersion |

### 10.2 配置同步

| 通道 | 方向 | 说明 |
|------|------|------|
| `aiGateway:syncModeConfig` | invoke → | 拉 `/modeconfig`，写缓存，返回 catalog |
| `aiGateway:getModeConfig` | invoke → | 读内存/缓存/bundled |
| `aiGateway:syncModels` | invoke → | 拉 `/models`，更新 balance 与 enabled  map |

### 10.3 生成任务

| 通道 | 方向 | 说明 |
|------|------|------|
| `aiGateway:uploadAsset` | invoke → | 本地 path / bytes → `assetRef` |
| `aiGateway:estimate` | invoke → | 组包后 POST `/generate/estimate` |
| `aiGateway:generate` | invoke → | POST `/generate`，返回 `taskId` |
| `aiGateway:getTask` | invoke → | GET `/tasks/{id}` |
| `aiGateway:cancelTask` | invoke → | DELETE `/tasks/{id}` |
| `aiGateway:taskProgress` | main → renderer | 轮询或 WS 推送 progress |

### 10.4 画布集成（Renderer 调用）

| 通道 | 说明 |
|------|------|
| `aiCanvas:runGenerate` | 替换现有 Mock：`estimate` → 确认 → `generate` → poll → 更新节点 |
| `aiCanvas:getModelAvailability` | 读 enabled / pointsFrom 缓存 |

**组包在 Main**：从 `{ canvasId, nodeId, nodes, edges }` 解析上游 → `inputs[]` → 上传缺失 assetRef。

---

## 11. 客户端组包流程

```
用户点「生成」
  ↓
1. 取指向上游节点的边 → 节点列表
2. flow type → ConfigNodeType
3. 解析 payload；无 assetRef 则 POST /assets
4. 组装 { canvasNodeType, modelCode, params, inputs, batchCount }
5. POST /generate/estimate → UI 展示 pointsCost
6. 用户确认 → POST /generate（带 estimateId）
7. 轮询 GET /tasks/{id}
8. success → 下载 outputs → 导入素材库 → patch 节点
```

**本地粗检（可选）**：用缓存 modeconfig 预跑层 A/B；**以网关为准**。

**注意**：上游 `GENERATE_*` 若仅有 `previewUrl`、无 `assetId`，须先上传或导入素材库。

---

## 12. 网关后台（运维）

| 模块 | 说明 |
|------|------|
| Token 管理 | api_token → userId、权限、过期 |
| 积分账户 | balance、ledger（关联 taskId） |
| 计价引擎 | modelCode + params + inputs + batch → points |
| Model 路由 | modelCode → Provider + remoteModelId |
| modeconfig 发布 | 编辑 → `GET /modeconfig` |
| 任务队列 | 视频/async worker、重试、DLQ |

---

## 13. 实施顺序

| 阶段 | 内容 |
|------|------|
| P0 | 网关 `/modeconfig` + `/models`；客户端 Token 设置页 + 启动同步 |
| P1 | `/generate/estimate` + `/generate` + `/tasks`；1 个同步文本模型 |
| P2 | `/assets`；画布 estimate 确认 UI；替换 Mock |
| P3 | 异步视频模型 + 任务队列 |
| P4 | 全量 39 modelCode 路由 + 积分规则 |
| P5 | 退款策略 + 对账 |

---

## 14. 相关仓库文件

| 文件 | 说明 |
|------|------|
| `modeconfig.json` | 本地 bundled 兜底；结构与网关 `/modeconfig` 一致 |
| `node_type.md` | 画布节点类型说明 |
| `src/shared/modeConfigTypes.ts` | modeconfig TypeScript 类型 |
| `src/renderer/src/components/AiCanvas/modeConfigCatalog.ts` | 客户端 catalog 与连线校验 |
| `src/renderer/src/components/AiCanvas/canvasNodeTypes.ts` | Flow ↔ Config 类型映射 |
| `src/renderer/src/components/AiCanvas/genNodeData.ts` | 节点 `modelCode` + `params` |

---

## 15. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-05-20 | 初版：网关 API、inputs 校验、IPC 规划 |
