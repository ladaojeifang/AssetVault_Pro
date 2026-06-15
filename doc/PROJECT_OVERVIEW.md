# AssetVault Pro — 项目概述 (代码级)

> 生成日期：2026-06-02 | 基于 `master` 分支代码分析

---

## 1. 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Electron 28 + React 18 + TypeScript 5.6 |
| 构建 | electron-vite |
| UI | @arco-design/web-react + Tailwind CSS 3.4 + framer-motion |
| 数据库 | better-sqlite3 + Drizzle ORM |
| 3D 渲染 | @babylonjs/core + @babylonjs/loaders |
| 字体解析 | fontkit |
| 图像处理 | @napi-rs/image, @napi-rs/canvas |
| 视频 | ffmpeg-static |
| 元数据 | exifreader, music-metadata, file-type |
| 路由 | react-router-dom |
| 状态 | AppContext (React Context) + useAppTheme (ThemeContext) |
| 图编辑器 | @xyflow/react (React Flow) |
| 文件监控 | chokidar |
| 版本 | **0.5.0-alpha** |

---

## 2. 项目结构

```
AssetVault_Pro/
├── src/
│   ├── main/                 # Electron 主进程
│   │   ├── index.ts           # 应用入口与生命周期
│   │   ├── db/                # 数据库 (schema.ts, sqliteSchema.ts, index.ts)
│   │   ├── ipc/handlers/      # 9 个 IPC 处理器
│   │   ├── services/          # 40+ 业务服务
│   │   ├── api/               # Web API (HTTP Server + handlers + routes)
│   │   └── utils/             # 工具函数
│   │
│   ├── renderer/src/          # React UI
│   │   ├── components/        # UI 组件
│   │   │   ├── Layout/        # MainLayout, TitleBar, LibraryPane
│   │   │   ├── Assets/        # AssetGrid, MasonryGrid
│   │   │   ├── Detail/        # DetailPanel, DetailContextPanel
│   │   │   ├── Sidebar/       # Sidebar (文件夹树 / 类型筛选)
│   │   │   ├── Settings/      # SettingsPage + 各设置面板
│   │   │   ├── Preview/       # ModelViewer (Babylon.js)
│   │   │   ├── Import/        # 导入进度 / 重复提示
│   │   │   ├── AiCanvas/      # AI 画布编辑器
│   │   │   └── Common/        # 通用组件 (Toast, DropZone...)
│   │   ├── stores/            # 状态管理 (AppContext, ThemeContext)
│   │   ├── hooks/             # useHotkeys, useVirtualizer...
│   │   └── utils/             # 工具函数
│   │
│   ├── preload/index.ts       # IPC 桥接 (contextBridge)
│   └── shared/                # 主进程/渲染进程共享类型
│       ├── types.ts           # AssetItem, FolderItem, TagItem...
│       ├── libraryTypes.ts    # LibraryMode, StorageMode...
│       ├── fontTypes.ts       # 字体元数据类型
│       ├── model3dFormats.ts  # 3D 模型格式
│       └── ...
└── doc/                       # 文档
```

---

## 3. 完整功能列表

### 3.1 资产导入

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **单文件导入** | SHA-256 去重 → 元数据提取 → 缩略图生成 → 数据库写入 | `ipc.handle('assets:import')` → `importSingleAsset()` → `analyzeColorsFromFile()` → `getThumbnailService().generate()` → `finalizeAssetRecords()` |
| **文件夹导入** | 递归扫描 → 逐一调用 `importSingleAsset` | `ipc.handle('assets:import-folder')` → `readdirSync` 递归 → `importSingleAsset()` |
| **URL 导入** | 主进程 HTTP 流式下载 → 临时文件 → `importSingleAsset` | `ipc.handle('assets:importFromURL')` → `urlAssetImportService.importAssetFromUrl()` → 下载至 `remote-imports/` → `importAssetFromPath()` |
| **Data URL 导入** | 解析 `data:[mime];base64,` → 解码 → 临时文件 → 导入 | `handleAssetImportFromDataUrl()` → `dataUrlAssetImportService.importAssetFromDataUrl()` |
| **拖放导入** | `drop` 事件 → `webUtils.getPathForFile()` → IPC | `DropZone` 组件 → `handleFileDrop()` → `assets:import` |

### 3.2 资产浏览

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **瀑布流网格** | 列宽自适应 + 虚拟滚动 | `MasonryGrid` → `useMasonryLayout()` → 按 `columnWidth` 计算列数 → `@tanstack/react-virtual` |
| **分页查询** | offset/limit + 排序 | `assets:query` → `queryAssets()` → `buildSearchCondition()` + `buildColorBucketCondition()` + `buildSizePresetCondition()` + `buildDatePresetCondition()` |
| **搜索** | 多 token AND 语义 → `assets_search` 表 LIKE 匹配 | `assetSearch.ts: buildSearchCondition()` → 分词 → LIKE 拼接 `assets_search.search_text` |
| **颜色桶过滤** | 从 `dominantColor` 计算色相桶 | `buildColorBucketCondition()` → HSL 归类 |
| **尺寸/日期预设** | 预设值映射为 SQL 条件 | `buildSizePresetCondition()` / `buildDatePresetCondition()` |

### 3.3 资产详情面板

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **预览** | 图片缩略图 / 3D ModelViewer / 字体预览 / 文件占位 | `DetailPreview` → 按 `fileType` 分流 → `getThumbnail()` / `ModelViewer` / `FileTypePlaceholder` |
| **文件信息** | ID / 类型 / 大小 / 尺寸 / 时长 / 导入时间 / 浏览量 | `InfoSection` → `formatFileSize()` |
| **文件夹管理** | 多对多逻辑文件夹，添加/移除 | `handleAssignFolder()` → `assets:add-to-folders` / `assets:remove-from-folders` |
| **标签管理** | 多对多标签，添加/移除/创建新标签 | `handleAssignTag()` → `tags:assign-to-assets` / `tags:remove-from-assets` |
| **色彩分析** | 主色 + 调色板展示 | `assets:analyze-colors` → `analyzeColorsFromFile()` → `persistAssetColorAnalysis()` |
| **备注** | textarea 编辑，失焦/回车自动保存，max 16000 字 | `saveNotesIfChanged()` → `assets:update-notes` → `updateAssetNotes()` |
| **来源链接** | URL 输入框 + 打开按钮，http/https 校验，max 2048 | `saveSourceUrlIfChanged()` → `assets:update-source-url` → `updateAssetSourceUrl()` |
| **底部操作** | 本地化 / 重新链接 / 打开 / 资源管理器 / 删除 | → `assets:localize` / `assets:relink` / `fs:open-in-explorer` / `assets:delete` |

### 3.4 标签系统

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **CRUD** | 标签名唯一，颜色可配，含使用计数 | `tags:create/update/delete` → `tagService` |
| **分配/移除** | 多对多 `asset_tags` 表，触发器自动维护 `tags.usage_count` | `tags:assign-to-assets` / `tags:remove-from-assets` → `tr_tag_usage_insert` / `tr_tag_usage_delete` |

### 3.5 文件夹系统

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **树结构** | 自引用 `parent_id`，最多 5 层 (level 0-4) | `folders:get-tree` → 前端递归构建树 |
| **CRUD + 移动** | 移动时自动更新子节点 path 和 level | `folders:create/update/delete/move` |
| **多对多资产** | `asset_folders` 关联表，级联删除 | `folders` → `asset_folders` → `assets` |
| **图标/封面** | 自定义图标 (emoji/图片) + 资产封面 | `folders:import-icon-from-file` / `folders:set-cover` |

### 3.6 搜索索引

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **索引构建** | `assets_search` 表存储拼接文本：文件名 + 原始名 + 标签名 + 备注 + sourceUrl | `rebuildAssetSearchText()` → `finalizeAssetRecords()` |
| **搜索查询** | 分词 → 每词 LIKE 匹配 | `tokenizeSearchQuery()` → `buildSearchCondition()` → `sql` |
| **触发器已移除** | v4 后采用应用层更新索引 | `finalizeAssetRecords()` 显式调用 |

### 3.7 缩略图生成

| 类型 | 技术方案 | 关键路径 |
|------|----------|----------|
| **图片** | @napi-rs/image 缩放 → WebP | `ThumbnailService.generate()` → `@napi-rs/image` resize → `encodeWebp()` |
| **视频** | ffmpeg 提取首帧 → WebP | `ThumbnailService.generateVideo()` → `ffmpeg-static` → 帧 → WebP |
| **字体** | fontkit 解析 → canvas 渲染 → WebP | `fontPreviewRender()` → `ThumbnailService.generateFont()` |
| **3D 模型** | 隐藏窗口 Babylon.js → 截图 → WebP | `modelThumbnailRenderer.ts` → `ThumbnailService.generateModel()` |
| **SVG** | 隐藏窗口渲染 → snapshot | `svgThumbnailRenderer.ts` |
| **缓存** | 三级：LRU 内存 → 磁盘 WebP → DB 引用 | `ThumbnailService` 内部 LRU Cache |

### 3.8 字体管理

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **元数据解析** | fontkit 读取 family/subfamily/glyphCount/unicodeCoverage/variationAxes | `parseFontMetadataFromAsset()` → `ParsedFontMetadata` |
| **TTC 面切换** | listFaces → updateFaceIndex → reparse | `fonts:list-faces` → `fonts:update-face-index` |
| **安装到系统** | 拷贝字体文件到 OS 字体目录 | `fonts:install-to-system` |
| **导出副本** | 保存对话框 → 拷贝 | `fonts:export-copy` |
| **预览窗口** | 独立窗口渲染字体样本 | `fonts:open-preview-window` |

### 3.9 3D 模型预览

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **模型加载** | Babylon.js Scene + 自动相机 + 环境贴图 | `ModelViewer` → `SceneLoader.ImportMeshAsync()` → 自动计算包围盒 |
| **支持格式** | glTF/GLB, OBJ, FBX, STL, PLY, 3MF | `isModel3dPreviewExtension()` |
| **全屏预览** | 双击 3D 资产 → 全屏 Babylon.js 窗口 | `openModelPreview()` |

### 3.10 资料库管理

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **两种模式** | `archive` (库内副本) / `catalog` (引用外部文件) | `manifest.json` 中 `libraryMode` |
| **创建/切换** | 选择目录 → 创建 `manifest.json` + `library.sqlite` + `items/` | `library:create-and-switch` / `library:switch` |
| **archive 升级** | catalog → archive：引用文件复制到库内 | `library:upgrade-to-archive` → `localizeAssets()` |
| **整库导入** | archive A → archive B：拷贝 assets + 标签 + 文件夹 + 去重 | `library:import-from-library` → `importArchiveToArchiveFromPath()` |
| **catalog 合并** | catalog A → catalog B：引用路径导入 + 本地化判断 | `importCatalogToCatalogFromPath()` |
| **引用验证** | 检查 referenced 资产源文件是否存在 | `library:verify-sources` |

### 3.11 内容去重

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **SHA-256 哈希** | 按文件内容计算哈希 | `computeFileSha256()` → `contentHashService` |
| **导入去重** | 按 `importSource` 或 `contentHash` 检测 | `findAssetIdByContentHash()` → 弹窗 `duplicateImportPrompt` |
| **批量扫描** | 遍历所有资产计算/验证哈希 | `scanLibraryContentHashes()` |

### 3.12 Web API

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **HTTP Server** | 自建 Node `http` (非Fastify) | `startApiServer()` → 路由匹配 → 鉴权 |
| **鉴权** | 本地 `127.0.0.1` 免 token；远程需 `Bearer` | `auth.ts` → `preHandler` |
| **端点数** | 30+ | app/info, library/*, asset/get|info|import|update|delete|rename|relink|localize, folder/*, tag/* |
| **响应格式** | JSend (`{status:"success",data:{}}` / `{status:"error",code,message}`) | `serialize.ts: jsendSuccess()` |
| **OpenAPI** | 3.1 YAML + Swagger Playground | `/api/v1/playground/` → `web-api-v1-openapi.yaml` |
| **Token 管理** | UUID 生成，设置页可查看/重生成 | `webApiTokenStore.ts` |

### 3.13 文件监控

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **chokidar 监控** | 导入时自动 watch 源目录 | `FileWatcher` → `chokidar.watch()` → `'add'/'change'/'unlink'` 事件 |
| **配置开关** | `autoWatchFolders` 偏好 | `isAutoWatchFoldersEnabled()` |

### 3.14 快捷键系统

| 快捷键 | 功能 | 实现 |
|--------|------|------|
| `Space` | 打开详情面板 | `useHotkeys.ts` |
| `Ctrl+I` | 导入文件 | `useHotkeys.ts` |
| `Ctrl+Shift+O` | 导入文件夹 | `useHotkeys.ts` |
| `Ctrl+B` | 切换侧栏 | `useHotkeys.ts` |
| `Ctrl+D` | 切换详情面板 | `useHotkeys.ts` |
| `Ctrl+L` | 资料库切换器 | `useHotkeys.ts` |
| `Delete` | 删除选中 | `useHotkeys.ts` |
| `F5` | 刷新 | `useHotkeys.ts` |
| `Ctrl+K` | 聚焦搜索 | `useHotkeys.ts` |

### 3.15 设置系统

| 设置项 | 文件 |
|--------|------|
| 默认导入路径 | `GeneralSettings` |
| 自动监控文件夹 | `GeneralSettings` |
| 缩略图质量/尺寸 | `GeneralSettings` |
| 瀑布流网格大小 | `AppearanceSettings` |
| 软件主题 (深/浅) | `AppearanceSettings` (ThemeContext) |
| 快捷键查看 | `ShortcutSettings` |
| 搜索延迟 | `AdvancedSettings` |
| 最大缓存 | `AdvancedSettings` |
| Web API 配置 | `WebApiSettingsSection` (端口/bind/token/远程) |
| 字体设置 | `FontSettingsSection` |
| 格式图标覆盖 | `FormatIconOverridesSection` |
| 资料库自检 | `LibraryStorageStatsCard` (DB行数 vs 磁盘目录数) |

### 3.16 AI 画布

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **独立窗口** | hash 路由 `#/ai-canvas` → `AiCanvasApp` | `window:open-ai-canvas` |
| **节点系统** | React Flow 图编辑器 | `AiCanvasEditor` → `@xyflow/react` |
| **生成节点** | Image/Text/Video/Model3D 生成器 | `ImageGeneratorDock`, `TextGeneratorDock`, `VideoGeneratorDock` |
| **资产拖放** | 主窗口资产 → AI 画布 | `assetDragBridge` → 跨窗口 IPC |
| **输出导入** | 画布输出 PNG → 导入到资料库 | `aiCanvas:import-output` |

### 3.17 资产拖放 (跨窗口)

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **设置拖放数据** | 主窗口设置 assetIds → IPC 广播 | `assetDrag:set` |
| **消费拖放数据** | AI 画布读取 assetIds | `assetDrag:consume` |
| **状态同步** | 跨窗口事件广播 | `asset-drag:state` 事件 |

### 3.18 侧栏

| 功能 | 技术方案 | 关键路径 |
|------|----------|----------|
| **资料库切换器** | 最近列表 + 选择/创建 UI | `LibrarySwitcher` |
| **文件夹树** | 递归渲染，深度缩进，右键菜单 | `FolderTree` → 递归 map → `FolderNode` |
| **类型筛选** | FileType 枚举 → 选中高亮 | `TypeFilterSidebar` |

---

## 4. 数据库 Schema

### `folders` — 逻辑文件夹
| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | UUID |
| name | TEXT | 名称 |
| parent_id | TEXT FK | 自引用，null 为根 |
| path | TEXT UNIQUE | 全路径 |
| level | INTEGER | 层级 0-4 |
| asset_count | INTEGER | 资产计数 |
| color | TEXT | 侧栏强调色 (#hex) |
| icon | TEXT | emoji/图标 |
| cover_asset_id | TEXT | 手动封面资产 |

### `assets` — 核心资产表
| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | UUID |
| filename | TEXT | 当前文件名 |
| original_name | TEXT | 导入时原始文件名 |
| extension | TEXT | 扩展名 |
| mime_type | TEXT | MIME 类型 |
| file_type | TEXT | image/video/audio/font/design/document/3d/code/other |
| folder_id | TEXT FK | 遗留单文件夹 (已废弃, 改用 asset_folders) |
| file_path | TEXT UNIQUE | 文件相对路径 |
| storage_mode | TEXT | local / referenced |
| localization_state | TEXT | idle / pending / done / failed |
| source_missing_at | INTEGER | 源文件缺失时间戳 |
| import_source | TEXT | 导入来源路径 (去重) |
| file_size | INTEGER | 字节数 |
| content_hash | TEXT | SHA-256 十六进制 |
| content_hash_computed_at | INTEGER | 哈希计算时间 |
| width | INTEGER | 像素宽 |
| height | INTEGER | 像素高 |
| dominant_color | TEXT | 主色 #RRGGBB |
| color_bucket | TEXT | 色相桶 (过滤用) |
| colors | TEXT | 调色板 JSON |
| duration | REAL | 秒 |
| thumbnail_path | TEXT | 缩略图相对路径 |
| has_thumbnail | INTEGER | 0/1 |
| metadata | TEXT | EXIF/IPTC/ID3 JSON |
| notes | TEXT | 用户备注 (max 16000) |
| source_url | TEXT | 来源网页链接 (http/https, max 2048) |
| view_count | INTEGER | 浏览量 |
| access_count | INTEGER | 访问次数 |
| file_created_at | INTEGER | 文件创建时间 |
| file_modified_at | INTEGER | 文件修改时间 |
| imported_at | INTEGER | 导入时间 |
| updated_at | INTEGER | 更新时间 |

### `tags` — 标签定义
| 列 | 类型 | 说明 |
|----|------|------|
| id | TEXT PK | UUID |
| name | TEXT UNIQUE | 名称 |
| color | TEXT | 颜色 #hex |
| description | TEXT | 描述 |
| usage_count | INTEGER | 使用计数 (触发器维护) |

### `asset_tags` — 资产-标签多对多
| 列 | 类型 |
|----|------|
| asset_id | TEXT FK → assets |
| tag_id | TEXT FK → tags |
| assigned_at | INTEGER |

### `asset_folders` — 资产-文件夹多对多
| 列 | 类型 |
|----|------|
| asset_id | TEXT FK → assets |
| folder_id | TEXT FK → folders |
| assigned_at | INTEGER |

### `assets_search` — 搜索索引
| 列 | 类型 | 说明 |
|----|------|------|
| asset_id | TEXT PK | FK → assets |
| search_text | TEXT | 拼接文本: filename + originalName + tagNames + notes + sourceUrl |

### `_av_schema_meta` — Schema 版本管理
| 列 | 类型 |
|----|------|
| key | TEXT PK |
| value | INTEGER |

当前版本: **v5** (新增 source_url 列)

---

## 5. 核心数据流

### 5.1 资产导入数据流
```
用户操作 (拖放/Ctrl+I/API)
  → IPC / HTTP
    → importSingleAsset()
      → 计算 SHA-256
      → 去重检测 (contentHash / importSource)
      → 拷贝文件到 items/{id}/
      → 提取元数据 (EXIF/字体/视频/音频)
      → 生成缩略图 (图片/视频/字体/3D/SVG)
      → 提取颜色调色板
      → INSERT INTO assets
      → INSERT INTO assets_search (搜索索引)
      → INSERT INTO asset_folders
      → 写入 meta.json (sidecar)
      → 通知 UI 刷新
```

### 5.2 资产查询数据流
```
UI 搜索/过滤请求
  → AppContext.queryAssets()
    → IPC 'assets:query'
      → queryAssets()
        → tokenizeSearchQuery() → buildSearchCondition()
        → buildColorBucketCondition() / buildSizePresetCondition() / buildDatePresetCondition()
        → SQL SELECT + JOIN + WHERE + ORDER BY + LIMIT/OFFSET
        → attachResolvedPaths() (解析路径)
        → getAssetTagIds() / getAssetFolderIds()
    → 返回 AssetItem[]
    → UI 更新 AssetGrid/MasonryGrid
```

### 5.3 详情面板交互流
```
用户点击资产 (AssetGrid)
  → AppContext.selectMultiple(id) + setDetailPanelOpen(true)
  → LibraryPane 渲染 <DetailPanel />
    → 查找 selectedAsset (从全局 assets 列表)
    → 渲染 DetailPreview (缩略图/ModelViewer/占位图标)
    → 渲染 InfoSection (文件信息/文件夹/标签/颜色/备注/链接)
    → 底部操作按钮:
      → 本地化 → assets:localize → localizeAssets()
      → 删除 → assets:delete → deleteAssets()
      → 在资源管理器 → fs:openAssetItemDirectory
      → 打开 → fs:openInExplorer
    → 备注输入 → debounce → assets:update-notes → updateAssetNotes()
    → 来源链接 → debounce → assets:update-source-url → updateAssetSourceUrl()
```

### 5.4 库导入流程
```
用户选择源资料库
  → IPC 'library:import-from-library'
    → 校验源库路径 + 模式 (archive/catalog)
    → 阶段1: 标签迁移 (phaseTags)
    → 阶段2: 用户分类迁移 (phaseCategories)
    → 阶段3: 文件夹迁移 (phaseFolders)
    → 阶段4: 资产迁移 (逐个)
      → SHA-256 去重
      → 新资产: cp items/ + INSERT
      → 重复资产: mergeAssetMetadata (folder/tag 合并；type_id 保留目标库)
    → 阶段5: 收尾 (refreshFolderAssetCounts, flushDatabase, 通知)
```

### 5.5 Web API 数据流
```
HTTP Client (curl/Python/JS)
  → http://127.0.0.1:41596/api/v1/asset/get?limit=20
    → ApiServer → 路由匹配 (routes/index.ts)
    → 鉴权检查 (auth.ts)
    → Handler (handlers/asset.ts)
      → 调用同一 service (assetQueryService, assetMutationService...)
      → JSend 序列化 (serialize.ts)
    → JSON 响应
```

---

## 6. 文件清单 (按层分类)

### 主进程 IPC (9 个)
| 文件 | 通道数 |
|------|--------|
| `ipc/handlers/assets.ts` | 22 |
| `ipc/handlers/folders.ts` | 11 |
| `ipc/handlers/library.ts` | 12 |
| `ipc/handlers/settings.ts` | 12 |
| `ipc/handlers/tags.ts` | 5 |
| `ipc/handlers/fonts.ts` | 9 |
| `ipc/handlers/fs.ts` | 7 |
| `ipc/handlers/window.ts` | 6 |
| `ipc/handlers/aiCanvas.ts` | 5 |

### 主进程服务 (40+)
| 类别 | 文件 |
|------|------|
| 资产导入 | importSingleAsset.ts, assetImportService.ts, urlAssetImportService.ts, dataUrlAssetImportService.ts |
| 资产查询 | assetQueryService.ts, assetQueryFilters.ts, assetSearch.ts, assetSearchIndex.ts |
| 资产变更 | assetMutationService.ts, assetSidecar.ts, assetRowHelpers.ts, assetPathResolver.ts, assetLookup.ts |
| 资产操作 | renameAsset.ts, localizeAsset.ts, copyAssetsToOtherLibrary.ts |
| 缩略图 | ThumbnailService.ts, modelThumbnailRenderer.ts, svgThumbnailRenderer.ts, modelThumbnailSkip.ts, assetThumbnailOverride.ts |
| 色彩 | analyzeAssetColors.ts, persistAssetColors.ts, backfillColorBuckets.ts |
| 内容哈希 | contentHashService.ts |
| 资料库 | libraryBundle.ts, libraryManifest.ts, librarySwitch.ts, libraryUpgrade.ts, libraryApiService.ts |
| 库导入 | importLibraryShared.ts, importLibraryFromPath.ts, importCatalogToCatalogFromPath.ts |
| 文件监控 | FileWatcher.ts |
| 字体 | fontPreviewRender.ts |
| 重建 | regenerateFontThumbnails.ts, regenerateModelThumbnails.ts, repairOrphanItemPacks.ts |
| 其他 | duplicateImportPrompt.ts, importNotify.ts, appPreferencesStore.ts, appShutdown.ts |

### Web API (6 文件)
| 文件 | 职责 |
|------|------|
| api/server.ts | HTTP Server 启停 |
| api/auth.ts | 鉴权中间件 |
| api/errors.ts | 错误码定义 |
| api/serialize.ts | AssetItem → JSend JSON |
| api/handlers/asset.ts | asset CRUD 端点 |
| api/handlers/library.ts | library 端点 |
| api/handlers/folder.ts | folder CRUD 端点 |
| api/handlers/tag.ts | tag CRUD 端点 |
| api/handlers/app.ts | 健康检查 |
| api/routes/index.ts | 30+ 路由注册 |

### 渲染进程组件 (30+)
| 类别 | 组件 |
|------|------|
| 布局 | MainLayout, TitleBar, LibraryPane |
| 资产 | AssetGrid, MasonryGrid |
| 详情 | DetailPanel, DetailContextPanel, FontDetailContext |
| 侧栏 | Sidebar (文件夹树/类型筛选) |
| 预览 | ModelViewer (Babylon.js) |
| 设置 | SettingsPage, GeneralSettings, AppearanceSettings, ShortcutSettings, AdvancedSettings, WebApiSettingsSection, FontSettingsSection, FormatIconOverridesSection, LibrarySettingsPanel, LibraryStorageStatsCard |
| 导入 | DuplicateImportBridge |
| 通用 | ColorPaletteStrip, FileTypePlaceholder, FolderIconDisplay, DropZone, Toast |
| AI画布 | AiCanvasShell, AiCanvasEditor, AiCanvasLeftToolbar, AiCanvasAddMenu, ImageGeneratorDock, TextGeneratorDock, VideoGeneratorDock, UnifiedGenNode, 各种节点组件 (~25 个) |
