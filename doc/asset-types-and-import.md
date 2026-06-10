# AssetVault Pro — 资产类型与入库处理说明

本文档梳理 Pro 当前**可导入资产**的类型划分、扩展名清单，以及各类文件在入库（import）时的处理逻辑。实现以代码为准，主要入口：

| 模块 | 路径 |
|------|------|
| **格式统一配置（新增扩展名优先改这里）** | `src/shared/assetFormatCatalog.ts` |
| 注册表 / 查询 API | `src/shared/assetFormatRegistry.ts` |
| 扩展名矩阵（由注册表导出） | `src/shared/supportedFormats.ts` |
| 类型分类 | `src/main/utils/fileUtils.ts` → `getFileType()` |
| 单文件入库 | `src/main/services/importSingleAsset.ts` |
| 批量/文件夹 | `src/main/services/assetImportService.ts` |
| 缩略图 | `src/main/services/ThumbnailService.ts` |
| 侧车元数据 | `src/main/services/assetSidecar.ts` → `items/{id}/meta.json` |

---

## 1. 总览

### 1.1 数据库 `file_type` 枚举

```text
image | video | audio | font | design | document | 3d | code | other
```

定义见 `src/shared/types.ts`。分类**优先看扩展名**，MIME 为 `application/octet-stream` 的设计/3D/代码文件仍能落入正确桶（见 `getFileType` 注释）。

### 1.2 资料库模式对入库的影响

| 模式 | 行为 |
|------|------|
| **完整库（archive）** | 文件复制或硬链接到 `items/{assetId}/{原始文件名}`；OBJ 会额外复制同目录 `.mtl`（见 §3.7） |
| **索引库（catalog）** | 默认**仅引用**源路径（`storageMode=referenced`）；`duplicatePolicy=import_copy` 或来自 `remote-imports/` 的托管下载会复制到 `items/` 并标记 `local` |

每条资产入库后写入 SQLite `assets` 表，并在 `items/{id}/meta.json` 写侧车（标签、文件夹、contentHash 等）。

### 1.3 通用入库流程（`importSingleAsset`）

对所有通过扫描/拖放/API 进入的**单个支持扩展名文件**：

1. **去重**：同 `importSource` 路径跳过；SHA-256 + 文件大小匹配时可 `ask` / `use_existing` / `import_copy`
2. **分类**：`mime-types` + 扩展名 → `fileType`
3. **落盘**：见 §1.2；生成 `items/{uuid}/` 目录
4. **类型专属处理**：缩略图、尺寸、调色板、EXIF、字体/视频元数据等（见各节）
5. **写库 + 侧车**：`writeAssetSidecarMeta`；可选分配文件夹
6. **异步 3D 缩略图**：仅 `fileType=3d` 且扩展名在预览白名单内（§3.7）

**文件夹递归导入**（`importAssetFolder`）：只导入扩展名在 `ALL_SUPPORTED_IMPORT_EXTENSIONS` 内的文件；**不会**把 `.mtl`、`.bin`、贴图等未列入矩阵的扩展名单独建资产。

---

## 2. 按 `file_type` 分类详表

### 2.1 图片 `image`

**扩展名**（`IMAGE_EXTENSIONS`）：

| 类别 | 扩展名 |
|------|--------|
| 常见位图 | `.jpg` `.jpeg` `.jfif` `.png` `.gif` `.webp` `.bmp` `.tga` `.ico` |
| 矢量 | `.svg` |
| HDR / 现代 | `.exr` `.hdr` `.heic` `.heif` `.avif` `.qoi` `.apng` |
| PNM / 贴图 / farbfeld | `.pbm` `.pgm` `.ppm` `.pam` `.dds` `.ff`（`@napi-rs/image` 直解） |
| ffmpeg 静态栅格 | `.jp2` `.j2k` `.jpc` `.j2c` `.jls` `.dpx` `.pcx` `.rgb` `.rgba` `.bw` `.sun` `.ras` `.xbm` `.xpm` `.fits` `.fit` `.fts`（见 `ffmpegRasterImageFormats.ts`） |
| RAW / DNG | `.cr2` `.nef` `.arw` `.orf` `.raf` `.dng` `.rw2` `.raw` |
| TIFF | `.tiff` `.tif` |

**入库处理**：

| 子类型 | 缩略图 | 尺寸 | 调色板/主色 | metadata | 专属预览 |
|--------|--------|------|-------------|----------|----------|
| 普通位图 / TIFF / HEIC / PNM / DDS 等 | `@napi-rs/image` → `thumb.webp`；极小图可直接用原图 | ✓ | ✓ EXIF 写入 `metadata.exif` | — | 网格内预览 |
| **TGA / HDR / QOI / DPX …** | ffmpeg 解码 → PNG → WebP（`FFMPEG_STILL_RASTER_IMAGE_EXTENSIONS`） | ✓ | ✓ | — | 网格内预览 |
| **SVG** | Chromium 栅格化 → WebP；**>5MB** 跳过栅格（`svgRasterSkip`） | 解析 viewBox/width/height | 栅格成功时提取 | — | **全屏 SVG 预览** |
| **EXR** | `exrs` 库渲染默认层 → WebP | ✓ `resolveExrFileMetadata` | 栅格成功时提取 | `metadata.exr`（图层/AOV 信息） | **全屏 EXR 预览**（分层、通道、曝光） |

**伴随文件**：无自动复制。SVG/EXR 外链资源不在入库时拉取。

**GIF**：按 `image` 分类；缩略图走 ffmpeg 抽帧（与视频帧路径类似）。

---

### 2.2 视频 `video`

**扩展名**：`.mp4` `.mov` `.avi` `.mkv` `.webm` `.flv` `.wmv` `.m4v` `.3gp` `.mpeg` `.mpg` `.m2ts` `.mts`

**入库处理**：

| 步骤 | 说明 |
|------|------|
| 元数据 | `music-metadata`：时长 → `duration` / `metadata.duration`；首条视频轨宽高 |
| 缩略图 | ffmpeg 抽帧 → WebP（`generateVideo`） |
| 主色 | 抽帧 PNG 调色板分析 |
| 预览 | 网格缩略图；无独立全屏视频页（AiCanvas 除外） |

**伴随文件**：不复制字幕、章节文件等；仅主视频文件一条资产。

---

### 2.3 音频 `audio`

**扩展名**：`.mp3` `.wav` `.flac` `.aac` `.ogg` `.oga` `.wma` `.m4a` `.aiff` `.aif` `.ape` `.opus`

**入库处理**：

| 步骤 | 说明 |
|------|------|
| 元数据 | `music-metadata`：时长 |
| 缩略图 | **不生成** |
| 预览 | 文件类型占位图标 |

---

### 2.4 字体 `font`

**扩展名**：`.ttf` `.otf` `.woff` `.woff2` `.eot` `.ttc`

**入库处理**：

| 步骤 | 说明 |
|------|------|
| 元数据 | `parseFontFile` → `metadata.font`（族名、TTC 索引、可变轴、Unicode 抽样等） |
| 缩略图 | `generateFont`：fontkit 渲染样例文字（设置 → 字体 → 样例文字可配置） |
| 预览 | **全屏字体预览**（TTC 字重、对比同族、安装/导出） |

**伴随文件**：无。`.ttc` 内多字重通过索引切换，不拆成多条资产。

---

### 2.5 设计稿 `design`

**扩展名**：`.psd` `.ai` `.sketch` `.fig` `.xd` `.pdf` `.eps` `.indd` `.afdesign`

**入库处理**：

| 步骤 | 说明 |
|------|------|
| 复制/引用 | 同通用流程 |
| 缩略图 | **不自动生成**（无内置 PSD/AI 解析） |
| metadata | 无专项提取 |
| 预览 | 扩展名占位图标；可在设置中为扩展名配置 **emoji/图片占位**（`formatIconOverrides`） |

**说明**：`.pdf` 在 PRD 矩阵中归 **design**，不归 document。

---

### 2.6 文档 `document`

**扩展名**：`.doc` `.docx` `.xls` `.xlsx` `.ppt` `.pptx` `.md` `.txt` `.csv` `.rtf` `.odt` `.ods` `.odp`

**入库处理**：

| 步骤 | 说明 |
|------|------|
| 缩略图 | **不自动生成** |
| 预览 | 普通占位；**Markdown**（`.md` 等，见 `markdownFormats.ts`）支持 **全屏 Markdown 编辑/预览** |

**Markdown 扩展名**：`md` / `markdown` / `mdown` / `mkd`（`isMarkdownExtension`）。

**文章资料包（article bundle）**：浏览器扩展通过 Web API 会话导入时，最终主资产为 **一条 `.md` 文档资产**，包内其它文件作为 `items/{id}/` 下的相对路径文件共存（见 §4.2）。

---

### 2.7 三维 `3d`

**扩展名分两类**（`src/shared/model3dFormats.ts`）：

| 子类 | 扩展名 | 应用内 3D 预览 | 自动缩略图 |
|------|--------|----------------|------------|
| **可预览** | `.glb` `.gltf` `.obj` `.stl` `.ply` `.fbx` | ✓ 全屏 + 详情内嵌 `ModelViewer` | ✓ 异步 WebGL 离屏渲染 |
| **仅入库** | `.abc` `.ma` `.mb` `.max` `.c4d` `.hip` `.usd` `.usda` `.usdz` `.blend` | `.c4d`/`.max`/`.blend` ✓ 嵌入提取；其余 ✗ | ✗（默认 emoji 占位，可设置覆盖） |

**入库处理（可预览格式）**：

| 步骤 | 说明 |
|------|------|
| 落盘 | 主模型文件入 `items/{id}/` |
| **OBJ + MTL** | **完整库**或**本地化**时：若源目录存在 `{同名}.mtl`（大小写不敏感），**复制到同一 `items/{id}/`**，**不**单独建 MTL 资产（`copyObjCompanionMtlForImport`） |
| 缩略图 | 入库完成后 `schedule3dThumbnailAfterImport` 异步生成，避免阻塞 |
| 动画 | GLB/GLTF/FBX 可检测动画轨；预览页有时间轴 |
| 预览 | Babylon.js；OBJ 加载时 MTL 需与 OBJ **同目录**（故入库时必须带上 MTL） |

**未自动处理的伴随资源**：

| 格式 | 说明 |
|------|------|
| **GLTF** | 外部 `.bin`、贴图 **不会**随导入复制；仅 `.gltf` 单文件入库 |
| **FBX** | 外部贴图不复制 |
| **USD 族 / Blend / Maya 等** | 仅主扩展名文件一条记录，无预览 |

**`.mtl` 单独拖入**：不在 `ALL_SUPPORTED_IMPORT_EXTENSIONS` 中 → **不会**被扫描导入。

---

### 2.8 代码 `code`

**扩展名**：`.js` `.ts` `.tsx` `.jsx` `.py` `.html` `.css` `.json` `.yaml` `.vue` `.go` `.java` …（完整列表见 `CODE_EXTENSIONS`）

**入库处理**：复制/引用 + SHA-256；**无缩略图、无专项 metadata**；占位图标。

**例外（文本预览缩略图）**：`.json`（`code`）、`.md`/`.txt`（`document` 或 `code` 中若扩展名匹配）入库后异步生成纸张风格 `thumb.webp`（`textPreviewThumbnail` 模块）。

---

### 2.9 其它 `other`

扩展名与 MIME 均无法匹配上述集合时落入 `other`。**无缩略图**。

---

## 3. 特殊伴随文件与侧车结构

### 3.1 OBJ → MTL（已实现）

```
源目录/
  model.obj
  model.mtl          ──复制──►  items/{assetId}/model.obj
                              items/{assetId}/model.mtl
```

- 触发：`importSingleAsset`（完整库）、`localizeAssetFromSource`（索引库本地化）
- **索引库仅引用** OBJ 时：**不**复制 MTL；预览/缩略图可能缺材质
- 实现：`src/main/services/importSingleAssetHelpers.ts`

### 3.2 资料包目录结构（Markdown article bundle）

```
items/{assetId}/
  article.md              ← DB 主文件 (filePath)
  thumb.webp 或 bundle 指定缩略图路径
  assets/image1.png       ← 相对路径，随包复制
  assets/video.mp4
  meta.json
```

- 入口：`articleBundleSession/*` → `importAssetFromPath(..., skipCopyIntoPack: true)`
- 允许写入包的扩展名：`articleBundleSessionPathPolicy.ts` 中 `ALLOWED_EXTS`
- `metadata.captureType = 'article_bundle'`，可写 `sourceUrl` / `pageTitle`

### 3.3 meta.json

每条资产侧车路径：`items/{id}/meta.json`。内容与 DB 行同步（文件名、hash、thumb、标签、文件夹等）。跨库导入时会复制或合并 pack 内除 `meta.json`/`thumb.*` 外的文件（`importLibraryShared.ts`）。

---

## 4. 非「单文件扫描」入库路径

这些路径最终多数仍调用 `importSingleAsset` / `importAssetFromPath`，但来源与预处理不同。

| 路径 | 产物类型 | 处理摘要 |
|------|----------|----------|
| **拖放 / 打开对话框 / 文件夹扫描** | 各支持扩展名 | §1.3 |
| **URL 直链下载**（`urlAssetImportService`） | 按响应/扩展名分类 | 下载到临时或 `remote-imports/{sha256}/` 再 import |
| **data URL**（`dataUrlAssetImportService`） | 多为 `image` | 解码 → `remote-imports/` → import；限 300MB |
| **整页截图会话**（`fullPageSession`） | `image`（`.jpg`/`.png`） | 浏览器条带图纵向拼接 → 单张长图 → import |
| **Markdown 资料包会话**（`articleBundleSession`） | `document`（`.md`） | 多文件写入同一 `items/{id}/` → 以 md 注册资产 |
| **作品页视频**（`pageVideoImport` + yt-dlp） | `video` | 下载到 job 临时目录 → `importAssetFromPath`；写 `sourceUrl`、`metadata.importPipeline` |
| **AI Canvas 输出**（`importCanvasOutput`） | 按输出文件 | 临时文件 → import |
| **跨资料库导入**（`importLibraryFromPath` 等） | 复制 pack | 复制 `items/{id}/` 内容 + 合并 DB |

---

## 5. 缩略图与预览能力矩阵

| file_type | 自动 thumb | 全屏/特殊预览 | 备注 |
|-----------|------------|---------------|------|
| image（常规） | ✓ | — | 小图可能直接用原图 |
| image（svg） | 条件 ✓ | SVG 预览页 | >5MB 跳过栅格 |
| image（exr） | ✓ | EXR 预览页 | HDR 专用渲染 |
| video | ✓ | — | ffmpeg 帧 |
| audio | ✗ | — | |
| font | ✓ | 字体预览页 | |
| design | ✗ | — | 可配置格式图标 |
| document | ✗ | Markdown 预览（仅 md 系） | |
| 3d（预览集） | ✓ 异步 | 3D 预览页 + 内嵌 ModelViewer | Babylon 隐藏窗口 |
| 3d（c4d/max/blend） | ✓ 异步 | — | 嵌入预览提取 → WebP；详见 [thumbnail-pipeline.md](./thumbnail-pipeline.md) |
| 3d（仅入库，其余） | ✗ | — | 默认 3D emoji 图标 |
| code（json）/ document（md/txt） | ✓ 异步 | — | Canvas 纸张预览 + 系统中文字体；详见 [thumbnail-pipeline.md](./thumbnail-pipeline.md) |
| code / other（其余） | ✗ | — | |

预览路由：`src/renderer/src/utils/specialPreview.ts`、`LibraryPane.tsx`；双击/详情入口见 `AssetGrid.tsx`、`DetailPanel.tsx`。

---

## 6. 重复检测与指纹

| 机制 | 字段/算法 |
|------|-----------|
| 同源路径 | `importSource` |
| 内容重复 | SHA-256 + `fileSize`（`contentHash`）；UI 可 ask |
| 扫描补指纹 | 设置 → 资料库 → 「扫描并更新内容指纹」 |

算法常量：`CONTENT_HASH_ALGO`（`src/shared/importTypes.ts`）。

---

## 7. 明确不支持或未纳入矩阵的情况

- **扩展名不在** `ALL_SUPPORTED_IMPORT_EXTENSIONS` **的文件**（含 `.mtl`、常见贴图 `.jpg` 若仅作 OBJ 伴随而不单独导入）
- **GLTF 外链资源**、**FBX 贴图**、**USD 层/变体** 不自动打包
- **AiCanvas** 内部节点与 UI 文案（独立模块，非资产库 file_type）
- **主进程对话框**错误提示未 i18n（与渲染进程语言设置无关）

---

## 8. 维护提示

1. 新增扩展名：改 `supportedFormats.ts` 对应 Set，并确认 `getFileType` 优先级；若需缩略图/预览，在 `importSingleAsset` / `ThumbnailService` 增加分支。
2. 新增「伴随文件」逻辑：参考 OBJ+MTL，在 `importSingleAssetHelpers.ts` 扩展，并在**完整库**与**本地化**两条路径保持一致。
3. 文件夹扫描与对话框过滤均依赖 `ALL_SUPPORTED_IMPORT_EXTENSIONS`，Companion 文件若不应单独成资产则**不要**加入该集合。
4. Web API / 扩展会话类导入需同步更新 `doc/web-api-v1-openapi.yaml` 与扩展 contract。

---

## 9. 相关文档

- [thumbnail-pipeline.md](./thumbnail-pipeline.md) — 缩略图专项：生成管线、缓存、启动补全、IPC 重建
- [i18n-inventory.md](./i18n-inventory.md) — 界面语言改动清单（与本文档独立）
- [web-api-v1-guide.md](./web-api-v1-guide.md) — HTTP 导入与会话 API 用法
