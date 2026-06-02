# EXR 预览与缩略图

AssetVault Pro 对 OpenEXR（`.exr`）提供全页预览（图层侧栏、通道开关、曝光）与资料库网格缩略图。多 AOV 合成文件（如 Arnold 扁平通道 `albedo.R`、`N.R`）与单 RGBA 文件均支持。

---

## 用户入口

| 操作 | 行为 |
|------|------|
| 双击 EXR 资产 | 打开 `ExrPreviewPage` 全页预览 |
| 详情面板 | 「EXR 预览」按钮 |
| 导入 / 扫描 | 自动生成缩略图（默认图层） |

---

## 渲染管线

```
                    ┌─────────────────────────────────────┐
                    │         exrMetadata (header)         │
                    │  图层列表 · 尺寸 · channelControl    │
                    └─────────────────┬───────────────────┘
                                      │ exrLayerGrouping (shared)
                    ┌─────────────────▼───────────────────┐
                    │      exrs WASM (exrsExrsDecoder)       │
                    │  decode · split flat AOV · rgba8       │
                    └─────────────────┬───────────────────┘
                                      │ exrAovDisplay (tonemap)
          ┌───────────────────────────┼───────────────────────────┐
          ▼                           ▼                           ▼
  exrPreviewRender            exrThumbnailRender          (fallback)
  JPEG → preview protocol     WebP → thumb.webp           napi / ffmpeg
```

### 预览（`exr:render-preview`）

1. **exrs** — 按图层解码子层，应用 AOV 显示模式（HDR Reinhard、法线向量、data 归一化、crypto 直出）。
2. **napi** — 仅默认 `RGBA` 层且文件在解码预算内时作为兜底。
3. **ffmpeg** — 仅默认 `RGBA` 合成预览；非默认图层失败时**不会**静默降级。

**预算**（`exrChannelBudget.ts`）：
- `perLayerPreviewAvailable` — 分辨率或文件 >512MB 时禁用 AOV 分层，仅 RGBA 合成。
- `channelControlAvailable` — 分辨率 >4096² 或文件 >256MB 时禁用 R/G/B/A 开关，仍可切换图层。

失败原因：`layer_missing` | `decode_failed` | `render_failed`（见 `ExrPreviewFailureReason`）。

**Fallback 规则（PR-A）**：仅 **RGBA 默认层**在 exrs 失败时可降级 napi/ffmpeg；其它 AOV 失败直接报错。

### 缩略图（`ThumbnailService.generateExr`）

1. **exrs** — `pickExrThumbnailLayerName` 选择图层：`RGBA` / `beauty` 等优先，否则第一个 HDR RGB AOV。
2. **napi → ffmpeg** — exrs 失败时沿用原路径（`exrRaster.ts`）。

---

## 关键模块

| 路径 | 职责 |
|------|------|
| `src/shared/exrDefaultLayer.ts` | 默认图层名推导（预览/缩略图/metadata 共用） |
| `src/shared/exrLayerGrouping.ts` | 通道名 → 图层分组（header 与 exrs 共用） |
| `src/shared/exrAovDisplay.ts` | AOV 显示模式与 tonemap |
| `src/shared/exrChannelBudget.ts` | 大文件 channel 控制预算 |
| `src/main/services/exrExrsDecoder.ts` | exrs 初始化、解码缓存、子层拆分、RGBA 构建 |
| `src/main/services/exrPreviewRender.ts` | 预览 JPEG |
| `src/main/services/exrThumbnailRender.ts` | 缩略图 WebP |
| `src/main/utils/exrMetadata.ts` | OpenEXR header 解析 |
| `src/renderer/.../ExrPreviewPage.tsx` | 预览 UI |

---

## 本地测试样本

仓库根目录（可选，集成测试 `skipIf` 缺失时跳过）：

| 文件 | 说明 |
|------|------|
| `multi-layer.exr` | ~55 层 Arnold 扁平 AOV |
| `test_24.0046.exr` | 单 RGBA 960×540 |

```bash
pnpm test          # 单元 + 集成（含 EXR）
pnpm test:watch    # 监听模式
```

手工发布前验收见 [exr-preview-manual-acceptance.md](./exr-preview-manual-acceptance.md)。

---

## 依赖

- npm 包 [`exrs`](https://www.npmjs.com/package/exrs)（Rust WASM）；`electron-builder` 需 `asarUnpack` WASM 资源。
- 兜底：`@napi-rs/image`、`ffmpeg`（`videoFrame.ts`）。

---

## 已知限制

- 预览经 `assetvault-exr-preview://` 协议加载 JPEG（主进程 LRU 缓存，避免 base64 IPC）。
- 子层 RGBA 与 exrs 解码结果有 LRU 缓存；曝光 slider debounce 400ms。
- UI 通道开关仅 R/G/B/A（及 X/Y/Z 映射）；**自定义后缀**通道显示为只读标签并始终参与预览。
- **Multipart OpenEXR**（`EXR_FLAG_MULTIPART`）：header 仅反映首个 part，metadata 标记 `layerListIncomplete`，UI 仅 RGBA 合成预览。

---

## 格式支持矩阵

| 格式 / 布局 | Header 图层列表 | exrs 预览 | 通道开关 | 备注 |
|-------------|-----------------|-----------|----------|------|
| 单 RGBA（`test_24.0046.exr`） | ✓ | ✓ | ✓ | napi/ffmpeg 可兜底 |
| Arnold 扁平多 AOV（`multi-layer.exr`） | ✓ | ✓ | 预算内 ✓ | `layer.suffix` 分组 |
| 单 dotted 数据层（如 `depth.Z`） | ✓ | ✓ | Z→B | 归入独立图层名 |
| 自定义后缀通道 | ✓ | ✓ | 只读 | 无 R/G/B/A 映射时显示「全通道」 |
| Multipart EXR | 不完整 | exrs 或 RGBA | 禁用 | `layerListIncomplete` |
| Header 不可读 | 不完整 | napi RGBA | 禁用 | `probeSource: napi` |
| 超大文件（>512MB 或高分辨率） | ✓ | RGBA 合成 | 禁用 | `perLayerPreviewAvailable: false` |
