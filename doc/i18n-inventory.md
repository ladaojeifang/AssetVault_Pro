# AssetVault Pro — 界面语言（i18n）改动清单

本文档记录 **AssetVault Pro** 渲染进程 UI 国际化（`zh-CN` / `en-US`）涉及的全部位置与文件，便于后续维护、补翻与 Code Review。

**范围约定**

| 包含 | 不包含 |
|------|--------|
| `src/renderer/**` 用户可见文案 | `src/main/**` 主进程对话框、系统级提示 |
| 设置 → 外观 → 界面语言 | `components/AiCanvas/**` 与 `AiCanvasApp.tsx` |
| Web API Playground 说明文档（OpenAPI） | 扩展仓库（Browser Extension） |
| 代码注释、样例占位文字（如字体预览 `AIGC创作`） | |

**默认语言：** `zh-CN`（`src/shared/appLocale.ts`）

**切换入口：** 设置 → 外观 → 界面语言（`SettingsPage` → `appearance.language`）

**校验命令：** `pnpm run i18n:check`（`scripts/check-i18n-keys.mjs`，校验 zh-CN ↔ en-US 各 namespace 键一致）

---

## 1. 基础设施

### 1.1 依赖

| 包 | 用途 |
|----|------|
| `i18next` | 核心 i18n |
| `react-i18next` | React 绑定（`useTranslation`） |

见 `package.json` → `dependencies`；脚本 `i18n:check`。

### 1.2 共享类型与持久化（`src/shared/`）

| 文件 | 作用 |
|------|------|
| `appLocale.ts` | `AppLocale`（`zh-CN` \| `en-US`）、默认值、`normalizeAppLocale`、`APP_LOCALE_STORAGE_KEY`、`APP_LOCALE_CHANGED` |
| `appLocale.test.ts` | locale 规范化单测 |
| `appPreferences.ts` | `AppPreferences.locale` 字段，随应用偏好读写 |

主进程通过 `settings:get/set-app-preferences` 持久化；渲染进程 `localStorage` 作启动 FOUC 缓存。

### 1.3 渲染进程 i18n 核心（`src/renderer/src/i18n/`）

| 文件 | 作用 |
|------|------|
| `index.ts` | 注册 11 个 namespace、`initI18n()`、导出 `{ i18n }` |
| `applyAppLocale.ts` | 切换语言：i18n + dayjs locale + localStorage + 写回 preferences + 派发 `APP_LOCALE_CHANGED` |
| `arcoLocale.ts` | Arco Design 组件库语言包映射 |
| `translateError.ts` | 错误码 → `errors` namespace 文案（供后续 API 错误展示） |

### 1.4 React 集成

| 文件 | 作用 |
|------|------|
| `src/renderer/src/stores/LocaleContext.tsx` | `LocaleProvider`、`useAppLocale()` |
| `src/renderer/src/main.tsx` | 启动时 `initI18n` / `applyAppLocale` |
| `src/renderer/src/App.tsx` | 挂载 `LocaleProvider`，Arco `ConfigProvider` 使用 `arcoLocale` |

---

## 2. 语言包（Locale JSON）

目录：`src/renderer/src/i18n/locales/{zh-CN,en-US}/`

共 **11 个 namespace**，中英文文件键名必须一一对应。

| Namespace | 主要覆盖 UI |
|-----------|-------------|
| `common.json` | 通用按钮/状态（保存、关闭、取消…） |
| `layout.json` | 标题栏、状态栏、窗口级文案 |
| `settings.json` | 设置页各 Tab；**含** `webApi.*`、`formatIcons.*`、`fontSettings.*`、`thumbRegenerate.*`、`hashScan.*`、`librarySelfCheck.*`、`advanced.*` |
| `toolbar.json` | 工具栏、视图切换、tooltip |
| `import.json` | 拖放导入、重复文件对话框；`dropTypes.*` |
| `sidebar.json` | 侧栏、文件夹/资料库切换、新建库弹窗 |
| `errors.json` | 可翻译错误码文案 |
| `assets.json` | 资产网格/列表、筛选、右键菜单、通知；`colorBuckets.*`、`colorPaletteAria` |
| `detail.json` | 详情侧栏；`context.*`（含字体详情） |
| `library.json` | 资料库设置面板、导入确认/进度/结果、`importPhase.*` |
| `preview.json` | 全屏预览页；`model3d.*`、`exr.*`、`svg.*`、`fontPreview.*`（含 `templates.*`） |

---

## 3. 翻译辅助工具（`src/renderer/src/utils/`）

| 文件 | 作用 | 消费方 |
|------|------|--------|
| `assetFilterLabels.ts` | 日期/尺寸预设标签 | `AssetFilterBar`、`ListViewColumnHeader` |
| `colorBucketLabels.ts` | 主色筛选桶标签 | `AssetFilterBar`、`StatusBar`、`ListViewColumnHeader` |
| `listViewColumns.ts` | 列表列标题（`i18n.getFixedT(..., 'assets')`） | 列表视图 |

---

## 4. 已接入 i18n 的组件与 Hooks

### 4.1 布局 / 壳层

| 文件 | Namespace（典型） |
|------|-------------------|
| `components/Layout/TitleBar.tsx` | `layout` |
| `components/Layout/StatusBar.tsx` | `layout`, `assets`（主色筛选） |
| `components/Layout/LibraryPane.tsx` | —（仅 JSX 注释含中文，未迁移） |

### 4.2 侧栏 / 资料库

| 文件 | Namespace |
|------|-----------|
| `components/Sidebar/Sidebar.tsx` | `sidebar` |
| `components/Sidebar/LibrarySwitcher.tsx` | `library` |
| `components/Sidebar/CreateLibraryModal.tsx` | `library` |
| `components/Sidebar/FolderContextMenu.tsx` | `sidebar` / `assets` |

### 4.3 工具栏 / 筛选

| 文件 | Namespace |
|------|-----------|
| `components/Toolbar/Toolbar.tsx` | `toolbar` |
| `components/Toolbar/AssetFilterBar.tsx` | `assets` |

### 4.4 资产列表 / 网格

| 文件 | Namespace |
|------|-----------|
| `components/Assets/AssetGrid.tsx` | `assets` |
| `components/Assets/MasonryGrid.tsx` | `assets` |
| `components/Assets/AssetContextMenu.tsx` | `assets` |
| `components/Assets/ListViewColumnHeader.tsx` | `assets` |
| `components/Assets/ListColumnResizeHandle.tsx` | `assets` |
| `components/Assets/FileSizeFilterControl.tsx` | `assets` |
| `components/Assets/AssetListNoResults.tsx` | `assets` |

### 4.5 详情侧栏

| 文件 | Namespace |
|------|-----------|
| `components/Detail/DetailPanel.tsx` | `detail` |
| `components/Detail/DetailContextPanel.tsx` | `detail` → `context.*` |
| `components/Detail/FontDetailContext.tsx` | `detail` → `context.*` |

### 4.6 全屏预览

| 文件 | Namespace |
|------|-----------|
| `components/MarkdownPreview/MarkdownPreviewPage.tsx` | `preview` |
| `components/ModelPreview/ModelPreviewPage.tsx` | `preview` → `model3d.*` |
| `components/ModelPreview/ModelPreviewViewport.tsx` | `preview` → `model3d.*` |
| `components/ModelPreview/ModelAnimationTimeline.tsx` | `preview` → `model3d.*` |
| `components/ExrPreview/ExrPreviewPage.tsx` | `preview` → `exr.*`（含 R/G/B 通道按钮；见 §6 主题修复） |
| `components/SvgPreview/SvgPreviewPage.tsx` | `preview` → `svg.*` |
| `components/FontPreview/FontPreviewPage.tsx` | `preview` → `fontPreview.*` |
| `components/Preview/ModelViewer.tsx` | `preview` → `model3d.*`（详情内嵌 3D） |

### 4.7 导入 / 通用

| 文件 | Namespace |
|------|-----------|
| `components/Common/DropZone.tsx` | `import` |
| `components/Common/Toast.tsx` | `common`（关闭按钮 `aria-label`） |
| `components/Common/ColorPaletteStrip.tsx` | `assets` → `colorPaletteAria` |
| `components/Import/DuplicateImportBridge.tsx` | `import` |

### 4.8 设置

| 文件 | Namespace |
|------|-----------|
| `components/Settings/SettingsPage.tsx` | `settings`（常规/外观/高级；含 `LibraryStorageStatsCard`、`AdvancedSettings`） |
| `components/Settings/LibrarySettingsPanel.tsx` | `library` |
| `components/Settings/WebApiSettingsSection.tsx` | `settings` → `webApi.*`；打开 Playground 时附带 `?lang=`（§5） |
| `components/Settings/FormatIconOverridesSection.tsx` | `settings` → `formatIcons.*` |
| `components/Settings/FontSettingsSection.tsx` | `settings` → `fontSettings.*` |
| `components/Settings/ModelThumbRegenerateButton.tsx` | `settings` → `thumbRegenerate.*` |
| `components/Settings/FontThumbRegenerateButton.tsx` | `settings` → `thumbRegenerate.*` |
| `components/Settings/ContentHashScanButton.tsx` | `settings` → `hashScan.*` |

### 4.9 Hooks / 非组件模块（渲染进程）

| 文件 | 方式 | 文案域 |
|------|------|--------|
| `hooks/useHotkeys.ts` | `i18n.getFixedT(..., 'assets')` | 缩略图相关 notify |
| `hooks/useFontFace.ts` | `i18n.t('preview:fontPreview.loadFailed')` | 字体加载失败 |
| `utils/model3d/loadModel.ts` | `i18n.t('preview:model3d.*')` | 动画名、无网格错误 |

---

## 5. Web API Playground 双语 OpenAPI

Playground 内 Swagger UI 的**接口说明**随语言切换，与渲染进程 locale 联动。

| 文件 | 作用 |
|------|------|
| `doc/web-api-v1-openapi.yaml` | 中文说明（默认） |
| `doc/web-api-v1-openapi.en.yaml` | 英文说明（`summary` / `description` 等） |
| `resources/api-playground/index.html` | 根据 `?lang=en` \| `?lang=zh` 或浏览器语言加载对应 yaml |
| `src/main/api/staticDocs.ts` | 提供 `/api/v1/docs/openapi.yaml` 与 `/api/v1/docs/openapi.en.yaml` |
| `package.json` → `build.extraResources` | 打包时复制两份 yaml |
| `components/Settings/WebApiSettingsSection.tsx` | 打开 Playground：`locale === 'en-US'` → `?lang=en`，否则 `?lang=zh` |

**手动访问示例**

- 中文：`http://127.0.0.1:41596/api/v1/playground/?lang=zh`
- 英文：`http://127.0.0.1:41596/api/v1/playground/?lang=en`

**维护注意：** 修改 Pro API 时，若用户可见说明变更，需**同时**更新 `web-api-v1-openapi.yaml` 与 `web-api-v1-openapi.en.yaml`。扩展仓库镜像仍以中文版为 contract sync 源（见 Extension `contracts/README.md`）。

---

## 6. 同期 UI 调整（非 i18n，但与预览页相关）

| 文件 | 改动 |
|------|------|
| `components/ExrPreview/ExrPreviewPage.tsx` | R/G/B 通道按钮：`av-accent` → `av-accent-blue`，未选中态对比度优化（Light 主题可读） |

---

## 7. 明确未迁移（仍含中文 UI 或硬编码）

### 7.1 AI 画布（按约定排除）

`src/renderer/src/components/AiCanvas/**`（约 30+ 文件）及：

- `src/renderer/src/AiCanvasApp.tsx`
- `src/renderer/src/stores/AiCanvasNavContext.tsx`

### 7.2 仅注释 / 样例 / 非 UI 字符串

| 文件 | 说明 |
|------|------|
| `components/Sidebar/Sidebar.tsx` | JSX 注释 |
| `components/Layout/LibraryPane.tsx` | 文件头注释 |
| `components/Detail/FontDetailContext.tsx` | 注释；默认样例 `VibeShotClub\nAIGC创作` |
| `components/Settings/FontSettingsSection.tsx` | textarea placeholder 样例中文 |
| `utils/listViewColumns.ts`、`main.tsx`、`stores/AppContext.tsx` | 注释 |
| `shared/fontSettings.ts` → `FONT_PREVIEW_TEMPLATES` | 模板 **label** 已在 UI 侧用 `fontPreview.templates.*` 覆盖；**text** 仍为中文样例内容 |
| `shared/colorBucket.ts` → `COLOR_BUCKET_OPTIONS[].label` | 共享层仍为中文；**展示**已走 `colorBucketLabels.ts` |

### 7.3 主进程 / API 响应

- `src/main/**` 内错误消息、对话框未做 i18n
- OpenAPI / JSend `message` 字段多为英文或机器码，与 UI locale 无关

---

## 8. 维护检查清单

1. 新增用户可见字符串 → 写入 **zh-CN + en-US** 对应 namespace JSON，组件内用 `t('key')` 或 `useTranslation('ns')`。
2. 提交前运行 `pnpm run i18n:check`。
3. 非 React 上下文（工具函数、notify）可用 `i18n.getFixedT(locale, 'ns')` 或 `i18n.t('ns:key')`（需保证 `i18n` 已 init）。
4. 改 Web API 说明 → 同步 **两个** OpenAPI yaml。
5. 不要改 `AiCanvas/**` 除非单独立项做画布 i18n。

---

## 9. 文件索引（按路径排序）

```
doc/i18n-inventory.md                          ← 本文档
doc/web-api-v1-openapi.yaml                      ← Playground 中文 spec
doc/web-api-v1-openapi.en.yaml                   ← Playground 英文 spec
package.json                                     ← i18next 依赖；i18n:check；打包 openapi.en
resources/api-playground/index.html              ← Playground 页面（lang 切换）
scripts/check-i18n-keys.mjs                      ← 键一致性校验

src/shared/appLocale.ts
src/shared/appLocale.test.ts
src/shared/appPreferences.ts

src/main/api/staticDocs.ts                       ← 静态 OpenAPI 路由

src/renderer/src/i18n/index.ts
src/renderer/src/i18n/applyAppLocale.ts
src/renderer/src/i18n/arcoLocale.ts
src/renderer/src/i18n/translateError.ts
src/renderer/src/i18n/locales/zh-CN/*.json         ← 11 个 namespace
src/renderer/src/i18n/locales/en-US/*.json

src/renderer/src/stores/LocaleContext.tsx
src/renderer/src/main.tsx
src/renderer/src/App.tsx

src/renderer/src/utils/assetFilterLabels.ts
src/renderer/src/utils/colorBucketLabels.ts
src/renderer/src/utils/listViewColumns.ts
src/renderer/src/utils/model3d/loadModel.ts
src/renderer/src/hooks/useHotkeys.ts
src/renderer/src/hooks/useFontFace.ts

src/renderer/src/components/Layout/TitleBar.tsx
src/renderer/src/components/Layout/StatusBar.tsx
src/renderer/src/components/Sidebar/Sidebar.tsx
src/renderer/src/components/Sidebar/LibrarySwitcher.tsx
src/renderer/src/components/Sidebar/CreateLibraryModal.tsx
src/renderer/src/components/Sidebar/FolderContextMenu.tsx
src/renderer/src/components/Toolbar/Toolbar.tsx
src/renderer/src/components/Toolbar/AssetFilterBar.tsx
src/renderer/src/components/Assets/AssetGrid.tsx
src/renderer/src/components/Assets/MasonryGrid.tsx
src/renderer/src/components/Assets/AssetContextMenu.tsx
src/renderer/src/components/Assets/ListViewColumnHeader.tsx
src/renderer/src/components/Assets/ListColumnResizeHandle.tsx
src/renderer/src/components/Assets/FileSizeFilterControl.tsx
src/renderer/src/components/Assets/AssetListNoResults.tsx
src/renderer/src/components/Detail/DetailPanel.tsx
src/renderer/src/components/Detail/DetailContextPanel.tsx
src/renderer/src/components/Detail/FontDetailContext.tsx
src/renderer/src/components/MarkdownPreview/MarkdownPreviewPage.tsx
src/renderer/src/components/ModelPreview/ModelPreviewPage.tsx
src/renderer/src/components/ModelPreview/ModelPreviewViewport.tsx
src/renderer/src/components/ModelPreview/ModelAnimationTimeline.tsx
src/renderer/src/components/ExrPreview/ExrPreviewPage.tsx
src/renderer/src/components/SvgPreview/SvgPreviewPage.tsx
src/renderer/src/components/FontPreview/FontPreviewPage.tsx
src/renderer/src/components/Preview/ModelViewer.tsx
src/renderer/src/components/Common/DropZone.tsx
src/renderer/src/components/Common/Toast.tsx
src/renderer/src/components/Common/ColorPaletteStrip.tsx
src/renderer/src/components/Import/DuplicateImportBridge.tsx
src/renderer/src/components/Settings/SettingsPage.tsx
src/renderer/src/components/Settings/LibrarySettingsPanel.tsx
src/renderer/src/components/Settings/WebApiSettingsSection.tsx
src/renderer/src/components/Settings/FormatIconOverridesSection.tsx
src/renderer/src/components/Settings/FontSettingsSection.tsx
src/renderer/src/components/Settings/ModelThumbRegenerateButton.tsx
src/renderer/src/components/Settings/FontThumbRegenerateButton.tsx
src/renderer/src/components/Settings/ContentHashScanButton.tsx
```

---

*最后更新：与 Pro 渲染进程 i18n 全量迁移及 Playground 双语 OpenAPI 同期。*
