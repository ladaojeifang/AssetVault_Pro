# EXR 预览 — 修复计划（基于 2026-06 代码审阅）

> 依据：主进程/渲染进程 EXR 管线审阅结论。  
> 关联规格：[exr-preview.md](./exr-preview.md)

---

## 目标

1. **RGBA 默认层**在 exrs 失败时仍能预览（napi/ffmpeg 兜底不被误杀）。
2. **预览 / 缩略图 / 取色**默认图层与 tonemap 策略一致，用户感知「同一张图同一个默认视图」。
3. **metadata 与 UI 文案**不撒谎：`previewable`、`channelControlAvailable`、侧栏提示与真实行为一致。
4. 每条改动有 **vitest 回归**，关键路径可手工验收。

---

## 优先级总览

| 阶段 | 主题 | 优先级 | 预估 |
|------|------|--------|------|
| **EXR-F1** | RGBA fallback 与 failureReason | P0 | 3h |
| **EXR-F2** | 默认图层统一 + metadata 诚实 | P0 | 4h |
| **EXR-F3** | previewable / channelControl 语义 | P1 | 3h |
| **EXR-F4** | 三管线对齐（取色 + tonemap 去重） | P1 | 3h |
| **EXR-F5** | IPC / UI 错误模型 | P2 | 4h |
| **EXR-F6** | 性能（解码缓存） | P2 | 6h+ |
| **EXR-F7** | 边界格式（multipart / 单通道 AOV） | P3 | 8h+ |

建议 **F1→F2→F3→F4** 作为一个可发布批次；F5/F6 可拆后续迭代。

---

## EXR-F1：RGBA fallback 与 failureReason（P0）

### 问题

`renderExrPreviewJpeg` 在 `decode_failed` 时 **提前 return**，导致 `layerName === RGBA` 时 napi/ffmpeg 永不执行（与注释「非 RGBA 不静默降级」意图冲突）。

### 改动

| 文件 | 内容 |
|------|------|
| `src/main/services/exrPreviewRender.ts` | 删除对 `decode_failed` 的无条件 early return；改为：**仅当 `layerName !== RGBA` 且 reason 为 `layer_missing` \| `decode_failed` 时** 直接失败；`RGBA` + `decode_failed` / `render_failed` 继续走 napi → ffmpeg |
| `src/main/services/exrPreviewRender.test.ts` | 新增：`exrs decode 抛错 + RGBA` → mock napi 成功；`exrs decode 失败 + N 层` → 不调用 ffmpeg |
| `src/main/ipc/handlers/exr.ts` | （可选本阶段）失败响应附带 `failureReason?: ExrPreviewFailureReason` |

### 决策表（实现时贴进 `exrPreviewRender.ts` 顶部注释）

```
exrs 结果          | layerName | 行为
-------------------|-----------|----------------------------------
ok                 | *         | 返回 exrs JPEG
layer_missing      | != RGBA   | 失败，不 fallback
layer_missing      | RGBA      | napi → ffmpeg（header 无 RGBA 但合成存在）
decode_failed      | != RGBA   | 失败，不 fallback
decode_failed      | RGBA      | napi → ffmpeg
render_failed      | RGBA      | napi → ffmpeg
render_failed      | != RGBA   | 失败
```

### 验收

- [x] `test_24.0046.exr`：mock `ensureExrsInitialized` 失败时预览仍出图（单测 mock）。
- [x] `multi-layer.exr` 选 `N` 层：exrs 像素失败时不出现 ffmpeg 合成图。
- [x] 现有 vitest 全绿（50 tests，含 PR-C）。

---

## EXR-F2：默认图层统一 + metadata 诚实（P0）

### 问题

- 预览页打开时选 **metadata 字母序第一个 previewable**；缩略图用 **`pickExrThumbnailLayerName`**（beauty / 首个 HDR RGB）→ 同文件两个默认视图。
- header 解析失败、仅 napi probe 成功时，metadata **固定 1 个 RGBA 层**，多 AOV 文件图层列表错误。

### 改动

| 文件 | 内容 |
|------|------|
| `src/shared/exrTypes.ts` | （可选）`ExrFileMetadata` 增加 `defaultLayerName?: string` |
| `src/main/services/exrExrsDecoder.ts` | 导出已有 `pickExrThumbnailLayerName`；或重命名为 `pickExrDefaultLayerName` 供预览/缩略图/取色共用 |
| `src/main/utils/exrMetadata.ts` | `resolveExrFileMetadata`：header 失败且仅 napi 时，`layers` 标为 **未知**（单条 `RGBA` + `previewable: false` + `probeSource: 'napi'`），或 `layers: []` + `layerListIncomplete: true`；**禁止**假装完整 AOV 列表 |
| `src/renderer/.../ExrPreviewPage.tsx` | metadata 加载后：`selectedLayer = meta.defaultLayerName ?? pickExrDefaultLayerNameFromLayers(meta.layers)`；若列表含 `pick` 结果则选中，否则第一项 |
| `src/main/utils/exrMetadata.ts` | header 成功时：根据 layer 名列表 **不算 exrs decode**，用与 `pickExrThumbnailLayerName` 相同规则从 `layers[]` 推导 `defaultLayerName`（纯名字匹配，不读像素） |

### `defaultLayerName` 推导（与缩略图一致，仅基于名字）

优先级：`RGBA` → `beauty` / `default` / `composite` / `combined`（大小写不敏感）→ 第一个 `displayMode === 'hdr'` 且含 R+G+B → 第一个含 R+G+B → 排序后首层。

### 验收

- [x] `multi-layer.exr`：预览初始选中层与缩略图所用层 **同名**（集成测试断言）。
- [x] 模拟 header 失败：UI 显示「图层列表不完整」或仅合成预览提示，不出现假 55 层 / 假 1 层误导。

---

## EXR-F3：previewable 与 channelControlAvailable（P1）

### 问题

- `previewable` 恒为 `channels.length > 0`，UI「不可预览」永不出现。
- `estimateExrsChannelControlAvailable` 像素预算几乎不生效；为 false 时仍可按图层 exrs 解码，侧栏文案「仅合成预览」不准确。

### 改动

| 文件 | 内容 |
|------|------|
| `src/shared/exrChannelBudget.ts` | 重写语义，拆成两个函数：`estimateExrsPerLayerPreviewAvailable(w,h,fileSize)`（能否 exrs 按层预览）与 `estimateExrsChannelToggleAvailable(w,h,fileSize)`（能否分 R/G/B/A 开关）。建议规则：像素 > budget **或** 文件 > 256MB → channel toggle false；文件 > 512MB 或像素极大 → per-layer false，仅 RGBA 合成 fallback |
| `src/shared/exrTypes.ts` | `ExrFileMetadata`：`channelControlAvailable` 保留；可选 `perLayerPreviewAvailable` |
| `src/main/utils/exrMetadata.ts` | `previewable`：header 层在 **layerListIncomplete** 时为 false；完整列表时为 true（或 per-layer 与 exrs 子层同名） |
| `src/renderer/.../ExrPreviewPage.tsx` | 更新侧栏 copy：`channelControlAvailable === false` →「超大文件：通道开关已禁用，仍可切换图层」；若 `perLayerPreviewAvailable === false` →「仅提供 RGBA 合成预览，无法按 AOV 分层」并 **禁用图层列表** |

### 验收

- [x] 单元测试覆盖新 budget 函数边界（4096²、256MB、512MB）。
- [x] `multi-layer.exr`（7MB）：per-layer + channel toggle 均为 true（与现行为一致）。
- [x] napi-only metadata：`perLayerPreviewAvailable === false`（UI 合成预览模式）。

---

## EXR-F4：三管线对齐 + tonemap 去重（P1）

### 问题

- `analyzeAssetColors` 仍走 `rasterizeExrPreviewJpeg`（napi/ffmpeg），与缩略图 exrs 默认层不一致。
- Reinhard tonemap 在 `exrAovDisplay` 与 `exrPreviewRender.tonemapFloat` 重复。

### 改动

| 文件 | 内容 |
|------|------|
| `src/main/services/analyzeAssetColors.ts` | EXR 分支：优先读 **已有 thumb.webp**；否则调用 `renderExrThumbnailWebp`（或共享 `renderExrDefaultLayerJpeg`）再取色 |
| `src/main/services/exrPreviewRender.ts` | `buildRgba8FromFloat32` / napi 路径改用 `tonemapHdrSample`（删除 `tonemapFloat` 重复） |
| `src/main/services/exrThumbnailRender.ts` | （可选）抽出 `renderExrDefaultLayerRgba8(absPath, maxEdge)` 供预览 fallback 前段复用 |

### 验收

- [x] 取色优先 thumb.webp，否则 `renderExrThumbnailWebp`（与缩略图 exrs 默认层一致）。
- [x] napi fallback 使用 `tonemapHdrSample`（与 exrs HDR 路径同一 Reinhard）。

---

## EXR-F5：IPC 与 UI 错误模型（P2）

### 问题

- 预览 JPEG 经 base64 IPC，大图内存三份。
- `failureReason` 在 service 有、IPC/UI 无。

### 改动（分步）

1. **短期**：`exr:render-preview` 失败/成功可选返回 `failureReason`；`ExrPreviewPage` 对 `layer_missing` / `decode_failed` 显示不同提示。
2. **中期**：改为 `thumbnail://` 或临时文件路径 + `protocol.registerFileProtocol`，渲染进程 `img src` 不持 base64（需评估 Electron 安全与缓存清理）。
3. **类型**：`ExrPreviewRenderResult` 扩展 `failureReason`；preload 类型同步。

### 验收

- [x] 选不存在图层：UI 显示「图层不存在」非泛化「渲染失败」。
- [x] 预览 JPEG 经 `assetvault-exr-preview://` 提供，不再 base64 IPC。

---

## EXR-F6：性能 — 解码与子层缓存（P2）

### 问题

每次切换图层/通道/曝光触发 `decodeExrFileCached` 命中后仍 **`buildRgba8FromExrsSubLayer` 全图**；7MB×55 层交互卡。

### 改动（按收益排序）

| 项 | 说明 |
|----|------|
| debounce | 曝光 slider 单独 debounce 300–500ms（图层/通道 180ms 保持） |
| 子层 RGBA 缓存 | `Map<cacheKey, { mtime, layer, channels, exposure, maxEdge, rgba8 }>`，key 含 subLayer + toggle + exposure + maxEdge |
| decodeCache LRU | `decodeCache` 改为 LRU（容量 4–8），按 absPath |
| 缩略图 | 生成后不再重复 decode（已有 disk cache） |

### 验收

- [x] `buildRgba8FromExrsSubLayerCached` 同参重复调用命中缓存。
- [x] exrs 文件 decode LRU（容量 8）；曝光 debounce 400ms。

---

## EXR-F7：边界格式与 AOV 启发式（P3）

| 项 | 改动方向 |
|----|----------|
| multipart EXR | 读 `EXR_FLAG_MULTIPART`；按 part 解析 channels 或标记 `layerListIncomplete` |
| `isFlatMultiAovChannelLayout` | 单 dotted 通道（`depth.Z`）纳入 flat 或单独 data 层逻辑 |
| non-flat `fullChannelNames` | else 分支用 `layer.channelNamesAlphabetical` 原名校验，勿仅 `channelSuffixes` |
| AOV 分类 | `normal` 子串改为 segment 匹配（复用 `layerNameMatchesDataKeyword` 风格）；`crypto` 同理 |
| 自定义 suffix UI | 通道列表无法映射 R/G/B/A 时，展示只读 suffix 列表或「全通道」单开关 |

**PR-C 已做（部分）**：AOV segment 匹配（`abnormal` 不再误判为 normal）；non-flat `fullChannelNames` 用真实通道名。

**PR-D 已做**：multipart 标记 `layerListIncomplete`；单 dotted（`depth.Z`）flat 分组；自定义 suffix 只读 UI；格式支持矩阵见 [exr-preview.md](./exr-preview.md)。

### 验收

- [x] `abnormal` 不误判为 normal 向量（`exrAovDisplay.test.ts`）。
- [x] `bidirectional` 仍不误判为 data（已有单测保持）。
- [x] 新增 fixture 或文档记录「不支持/部分支持」格式清单（`exr-preview.md` 格式支持矩阵）。
- [x] multipart header → `layerListIncomplete`；`depth.Z` 独立图层（单测）。

---

## 测试清单（每阶段合并前）

```bash
pnpm test
pnpm exec electron-vite build
```

| 场景 | 样本 | 期望 |
|------|------|------|
| 单 RGBA | `test_24.0046.exr` | 预览/缩略图/取色一致 |
| 多 AOV | `multi-layer.exr` | 默认层同名；N 向量显示；55 层 header↔exrs |
| exrs 挂 | mock init fail | RGBA 仍 preview；N 层失败 |
| header fail | mock metadata | 不展示假图层列表 |

手工验收步骤见 [exr-preview-manual-acceptance.md](./exr-preview-manual-acceptance.md)。

建议新增：`exrPreviewRender.test.ts` fallback 矩阵；`exrMetadata.test.ts` header-only-failure；`ExrPreviewPage` 可选 RTL smoke（mock API）。

---

## 文档同步

| 文件 | 更新 |
|------|------|
| [exr-preview.md](./exr-preview.md) | fallback 决策表、defaultLayerName、budget 双函数、已知限制 |
| [README.md](./README.md) | 本计划链接（完成后可归档或合并进 exr-preview） |
| [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) | 「EXR-F1～F4」一行里程碑（可选） |

---

## 建议实施顺序（单 PR 或两 PR）

**PR-A（必发）**：EXR-F1 + EXR-F2 + 测试 + doc 决策表  
**PR-B（体验）**：EXR-F3 + EXR-F4  
**PR-C（优化）**：EXR-F5 + EXR-F6  
**PR-D（格式）**：EXR-F7 + multipart fixture

---

## 不在本计划内（明确 defer）

- 缩略图与预览 **像素级** 和 Chaos Player / Nuke 对齐（需参考图与视觉回归）。
- Web API 暴露 EXR 图层预览端点。
- GPU / 原生 OpenEXR 解码替换 WASM。
