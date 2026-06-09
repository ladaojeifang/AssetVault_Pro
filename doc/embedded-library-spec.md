# 内嵌库（Embedded Library）功能规格

> 功能：将一个已有文件夹**原地转化**为完整资料库，文件不复制、不移动，items/ 仅存放元数据与缩略图。

---

## 一、背景与动机

现有两种库模式各有局限：

| 模式 | 文件位置 | 局限 |
|------|----------|------|
| `archive`（完整库） | 复制到 `items/{id}/` | 占用双份磁盘空间；原始目录结构丢失 |
| `catalog`（索引库） | 保留原绝对路径 | 路径为绝对路径，跨机不可移植 |

**内嵌库** 解决以上问题：
- 文件保留在原位（目录结构不变）
- 路径存储为**库内相对路径**（可移植）
- `items/` 只存 `meta.json` + 缩略图，不存原始文件

---

## 二、核心概念

### 2.1 数据模型扩展

```typescript
// src/shared/libraryTypes.ts

export type LibraryMode = 'archive' | 'catalog' | 'embedded'

export type StorageMode = 'local' | 'referenced' | 'embedded'
```

### 2.2 目录结构

```
{所选文件夹}/
├── manifest.json          # 库清单（libraryMode: "embedded"）
├── library.sqlite         # SQLite 数据库
├── items/                 # 元数据目录（无原始文件）
│   ├── {uuid-1}/
│   │   ├── meta.json      # 资产 sidecar 元数据
│   │   └── thumb.webp     # 缩略图
│   └── {uuid-2}/
│       ├── meta.json
│       └── thumb.webp
├── 子目录A/               # ← 原始文件结构不变
│   ├── texture.png        # ← 真实文件保留原位
│   └── model.fbx
└── 子目录B/
    └── image.jpg
```

### 2.3 路径存储

```
file_path       = "子目录A/texture.png"     （相对库根的正斜杠路径）
storage_mode    = "embedded"
thumbnail_path  = "items/{uuid}/thumb.webp" （相对库根）
import_source   = "D:/完整/绝对/路径.png"    （导入时的绝对路径，用于去重）
```

### 2.4 路径解析

`resolveLibraryPath()` 已天然支持相对路径解析，无需额外改动：

```typescript
// storage_mode = 'embedded', file_path = '子目录/texture.png'
// → 解析结果: {libraryRoot}/子目录/texture.png
return normalize(join(libraryRootResolved, storedPath.split('/').join(sep)))
```

---

## 三、扫描与导入流程

### 3.1 入口

用户操作路径：**设置 → 资料库面板 → "创建内嵌库"**，选择文件夹。

或者：**库切换 → 选择已有文件夹 → "以此文件夹创建内嵌资料库"**。

### 3.2 前置校验

```
1. 所选路径是否有效目录？ → 否：提示"不是有效文件夹"
2. 文件夹是否已是资料库？（存在 manifest.json + library.sqlite）
   → 是 & mode = 'embedded'：提示"已是内嵌资料库，可直接切换"
   → 是 & mode ≠ 'embedded'：提示"该文件夹已是{archive|catalog}资料库，不支持"
3. 文件夹是否包含 library.sqlite 但无 manifest.json？
   → 提示"检测到已有数据库，是否在现有数据库上继续创建？（会保留已有数据）"
4. 磁盘可写性检查 → 否：提示"文件夹不可写"
```

### 3.3 扫描阶段（Phase: scan）

使用 Node.js `fs.readdirSync({ recursive: true })` 递归扫描：

```
输入: 文件夹根路径
输出: 文件清单 [{ absPath, relPath, ext, size, mtime }]

过滤规则:
- 跳过 items/ 目录
- 跳过 library.sqlite、manifest.json
- 跳过隐藏文件（.开头）
- 跳过非支持格式（对照 supportedFormats.ts）
- 跳过零字节文件
- 跳过符号链接（默认不跟随）

排序: 按文件名自然排序，保证可复现的导入顺序
进度: 每 100 个文件发送一次进度事件
```

### 3.4 导入阶段（Phase: import）

对扫描到的每个文件，依次执行：

```
1. 去重检查
   ├─ 按 (file_size, content_hash) 查 DB
   │   └─ 命中 → 跳过（记录 skippedDuplicate）
   └─ 按 import_source（绝对路径）查 DB
       └─ 命中 → 若 hash 相同则跳过，hash 不同则更新（文件内容已变）

2. 计算 content_hash（SHA-256，仅当去重需要时）
   - 小文件（<16MB）直接 hash
   - 大文件采样 hash（首/中/尾各 1MB）

3. 提取元数据
   - 图像：尺寸、主色、EXIF
   - 音频/视频：时长
   - 字体：字体族元数据
   - 3D 模型：类型标记
   - 其他：文件类型分类

4. 生成缩略图 → 写入 items/{uuid}/thumb.webp
   - 图像：缩放至 512px 宽
   - 视频：截取第 1 秒帧
   - 音频/字体/3D：使用 fileType placeholder
   - 其他：使用格式图标

5. 写入 DB 行
   INSERT INTO assets (
     id, filename, file_path, storage_mode,
     file_size, content_hash,
     extension, mime_type, file_type,
     width, height, dominant_color,
     thumbnail_path,
     import_source, file_modified_at, imported_at
   ) VALUES (...)

6. 写入 sidecar → items/{uuid}/meta.json
   （与 archive 模式的 sidecar 格式一致）

7. 搜索索引（FTS）
```

### 3.5 收尾阶段（Phase: finalize）

```
1. 确保 manifest.json 存在且 libraryMode = 'embedded'
2. 整理元数据（如统计文件夹内资产数量）
3. 广播 library:switched 事件
4. 发送导入完成报告
```

### 3.6 进度事件

```typescript
type EmbeddedImportPhase = 'scan' | 'import' | 'finalize'

interface EmbeddedImportProgress {
  phase: EmbeddedImportPhase
  current: number
  total: number
  filename: string
  status: 'processing' | 'done' | 'error'
}
```

---

## 四、代码改动范围

### 4.1 类型层（shared）

| 文件 | 改动 |
|------|------|
| `src/shared/libraryTypes.ts` | `LibraryMode` 增加 `'embedded'`；`StorageMode` 增加 `'embedded'` |
| `src/shared/formatIconOverrides.ts` | 无改动 |

### 4.2 主进程服务层

| 文件 | 改动 |
|------|------|
| **新增** `src/main/services/importEmbeddedLibrary.ts` | 核心扫描 + 导入逻辑 |
| `src/main/services/libraryBundle.ts` | `ensureLibraryDirectories` 适配（embedded 模式下 items/ 仍需要） |
| `src/main/services/libraryManifest.ts` | `readLibraryManifestFile` 支持 `'embedded'` 模式 |
| `src/main/services/librarySwitch.ts` | **移除** `assertEmptyDirectoryForNewLibrary` 对 embedded 的限制；新增 `createEmbeddedLibrary` 流程 |
| `src/main/services/assetPathResolver.ts` | `resolveAssetContentPath` 支持 `'embedded'` storage mode |
| `src/main/services/importSingleAsset.ts` | 可选：支持将单文件以 embedded 方式导入 |
| `src/main/services/FileWatcher.ts` | 确认 watcher 支持 embedded 库（文件在库根下任意位置） |
| `src/main/services/ThumbnailService.ts` | 无改动（已支持 libraryRoot 切换） |

### 4.3 IPC 层

| 文件 | 改动 |
|------|------|
| `src/main/ipc/handlers/library.ts` | 新增 `library:create-embedded` channel |
| `src/preload/index.ts` | 新增 `createEmbeddedLibrary` API |
| `src/main/ipc/index.ts` | 注册新 handler |

### 4.4 UI 层

| 文件 | 改动 |
|------|------|
| `src/renderer/src/components/Settings/LibrarySettingsPanel.tsx` | 新增"创建内嵌库"按钮 |
| `src/renderer/src/i18n/locales/zh-CN/settings.json` | 新增内嵌库相关文案 |
| `src/renderer/src/i18n/locales/en-US/settings.json` | 同上 |

### 4.5 数据库

| 改动 | 说明 |
|------|------|
| Schema 不变 | `storage_mode TEXT` 新增合法值 `'embedded'`，无需 DDL 变更 |
| 无需迁移 | 现有 archive/catalog 数据不受影响 |

### 4.6 Web API（可选）

| 端点 | 说明 |
|------|------|
| `POST /api/v1/library/createEmbedded` | 创建内嵌库 |
| `GET /api/v1/library/info` | 返回 `libraryMode` 包含 `embedded` |

---

## 五、边界情况与约束

### 5.1 已包含 items/ 目录的文件夹

如果目标文件夹中已存在名为 `items` 的目录（非库创建），扫描时会自动跳过 `items/` 内的文件。库会使用已有的 `items/` 路径，不会覆盖已有文件（新的子目录以 UUID 命名，基本无冲突风险）。

### 5.2 已有 manifest.json 或 library.sqlite

> 见 3.2 前置校验第 2 条 — 已有资料库 → 不允许覆盖。

如果需要支持"将已有 archive/catalog 库原地转为 embedded"，另行设计。V1 暂不支持。

### 5.3 超大文件夹（10万+ 文件）

- 扫描阶段：使用流式 `readdir` 替代 `readdirSync`，分批处理
- 导入阶段：每 500 个文件提交一次事务，避免内存爆满
- 进度：每 100 个文件发送一次 IPC 事件（防抖 200ms）

### 5.4 文件被外部修改

- FileWatcher 监听 `change` 事件 → 更新 `file_modified_at`、`file_size`、`content_hash`
- 文件被外部移动/删除 → 检测到文件不存在 → 标记 `source_missing_at`

### 5.5 文件被外部新增

- FileWatcher `add` 事件 → 触发类似 `importSingleAsset` 的流程
- 自动生成缩略图、元数据、写入 DB

### 5.6 网络驱动器 / NAS

- 扫描和哈希可能较慢，需超时处理
- `source_missing_at` 机制可处理临时断连

### 5.7 资产删除

- 用户通过 UI 删除资产 → 仅删除 `items/{id}/` 目录（meta.json + thumb.webp）
- 原始文件**不删除**（这是 embedded 模式的核心约定）
- DB 行删除

### 5.8 库间导入

| 源库模式 | 目标库模式 | 行为 |
|----------|-----------|------|
| archive → embedded | 复制文件到目标相对路径 + 创建元数据 |
| catalog → embedded | 复制文件到目标相对路径 + 创建元数据 |
| embedded → archive | 复制文件到 `items/{id}/` |
| embedded → embedded | 复制文件到目标相对路径（保持相对路径结构）|

这些在 V1 中可暂不实现，后续按需扩展。

### 5.9 跨平台路径

- `file_path` 始终存储为正斜杠相对路径（与现有约定一致）
- `resolveLibraryPath` 在解析时转换为 OS 分隔符

---

## 六、实现估算

| 模块 | 预估工时 | 优先级 |
|------|----------|--------|
| 类型扩展（LibraryMode / StorageMode） | 0.5h | P0 |
| `importEmbeddedLibrary.ts`（扫描 + 导入） | 12h | P0 |
| `librarySwitch.ts` 适配 | 2h | P0 |
| IPC + preload 适配 | 2h | P0 |
| UI（设置面板入口 + 进度） | 4h | P0 |
| FileWatcher 适配（嵌入式库根目录监听） | 3h | P1 |
| 库间导入扩展 | 8h | P2 |
| 文档 / OpenAPI / i18n | 2h | P1 |
| 手动回归测试 | 4h | P0 |
| **合计** | **~37.5h** | |

---

## 七、与现有模式的对比

| 维度 | archive（完整库） | catalog（索引库） | **embedded（内嵌库）** |
|------|------------------|------------------|---------------------|
| 文件位置 | `items/{id}/name.ext` | 原始绝对路径 | **库内相对路径（原地）** |
| 可移植性 | ✅ 高（自包含） | ❌ 低（依赖绝对路径） | ✅ **高（相对路径）** |
| 磁盘占用 | ❌ 双份（原 + 库内副本） | ✅ 单份 | ✅ **单份** |
| 原始目录结构 | ❌ 丢失 | ✅ 保留 | ✅ **保留** |
| 资产删除行为 | 删除副本 | 仅删 DB 行 | **仅删 items/{id}/（不删文件）** |
| 外部修改感知 | ❌ 不适用 | ✅ 通过 FileWatcher | ✅ **通过 FileWatcher** |
| 适用场景 | 分散素材集中管理 | 已有 NAS/服务器的素材索引 | **项目目录就地管理** |
