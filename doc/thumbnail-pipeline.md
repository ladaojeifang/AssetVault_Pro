# 缩略图管线

本文描述 AssetVault Pro 如何为各类型资产生成、缓存与回填缩略图。类型矩阵见 [asset-types-and-import.md](./asset-types-and-import.md) §5。

## 架构概览

```text
导入 / 启动补全 / IPC 重建
        ↓
thumbnailJobs (async queue)
        ↓
ThumbnailService.generate*()
        ↓
磁盘 items/{id}/thumb.webp  +  DB thumbnail_path
        ↓
thumbnailRead → 渲染进程 data URL / 网格展示
```

| 组件 | 路径 | 职责 |
|------|------|------|
| 生成服务 | `src/main/services/ThumbnailService.ts` | 按类型调用 ffmpeg、Canvas、Babylon、EXR、SVG 等 |
| 异步任务 | `src/main/services/thumbnailJobs/` | 导入后排队、启动 pending 回填、批量重建 |
| 读取 | `src/main/services/thumbnailRead.ts` | 解析 bundle `_thumb.jpg`、DB 路径、默认 `thumb.webp` |
| 跳过标记 | `thumbnailSkip.ts` | 避免对超大/失败资产反复重试 |
| 图形门控 | `thumbnailGraphicsGate.ts` | 与 Canvas 渲染队列协调 |

## 三级缓存

1. **内存 LRU**（`ThumbnailService` 内，默认约 256MB）
2. **磁盘** — `{libraryRoot}/items/{assetId}/thumb.webp`（有库根时）；否则 legacy `userData/thumbnails/`
3. **数据库** — `assets.thumbnail_path`、`has_thumbnail`

小图可能 **直接使用原图路径**（`usedOriginal`），不写入 WebP。

## 按类型的生成方式

| 类型 | 方法 | 说明 |
|------|------|------|
| 栅格图 | `generate()` | `@napi-rs/image` 缩放；超大源文件跳过（500MB 上限） |
| GIF / 视频 | `generateVideo()` | ffmpeg 抽帧 |
| 字体 | `generateFont()` | Canvas 样张渲染 |
| 3D 预览集 | `generateModel()` | 隐藏 Babylon 离屏窗口 |
| C4D/MAX/Blend | `generateEmbeddedDcc()` | `3d-thumb-extractor` 提取嵌入预览 |
| EXR | `renderExrThumbnailWebp` | HDR 专用 |
| SVG | `renderSvgToWebpBuffer` | 大图（>5MB）可跳过栅格 |
| 文本/MD/JSON | `generateTextPreview()` | Canvas 纸张预览或 ffmpeg 路径 |

自定义缩略图（`customThumbnail`）与文章 bundle `_thumb.jpg` 优先于自动生成。

## 异步调度

- 导入完成后由 `thumbnailJobs/definitions.ts` 注册 job，按 `fileType` / 扩展名匹配。
- 应用启动时 `thumbnailStartup.ts` 延迟处理 pending 行，避免阻塞首屏。
- 设置或 IPC **重建缩略图** 走 `thumbnailJobs/runner.ts` → `runThumbnailRegenerateBatch`。

## IPC

渲染进程通过 IPC 触发单资产重建（见 `src/main/ipc/handlers/assets.ts` 内 `generate` / `generateVideo` / `generateModel` 等分支）。

## 维护提示

1. 新增扩展名：先在 `src/shared/assetFormatCatalog.ts` 注册，再在 `ThumbnailService` 与 job definitions 增加分支。
2. 改输出格式或路径时同步 `thumbnailRead.ts` 与 sidecar 同步逻辑。
3. 集成测试：`testing/unit`；依赖本机大文件的 EXR 等在 `testing/integration`（CI 默认排除）。
