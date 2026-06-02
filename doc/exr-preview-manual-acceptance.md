# EXR 预览 — 手工验收清单

> 对应修复计划 [exr-preview-fix-plan.md](./exr-preview-fix-plan.md)（F1–F7）。  
> 规格说明见 [exr-preview.md](./exr-preview.md)。

**验收人：** _______________  
**日期 / 版本：** _______________  
**构建：** `pnpm dev` 或打包产物 _______________

---

## 0. 前置条件

| # | 项 | 通过 |
|---|-----|------|
| 0.1 | 已执行 `pnpm test`（56 tests）与 `pnpm exec electron-vite build` 无失败 | ☐ |
| 0.2 | 仓库根目录存在 `test_24.0046.exr`（单 RGBA 960×540） | ☐ |
| 0.3 | 仓库根目录存在 `multi-layer.exr`（~55 层 Arnold 扁平 AOV） | ☐ |
| 0.4 | 已将上述样本导入当前资料库（拖入或「导入文件」） | ☐ |
| 0.5 | 开发工具可用（可选：主进程 Console、Renderer Network） | ☐ |

**可选样本（无则跳过对应章节）：**

| 文件 | 用途 |
|------|------|
| 含 `depth.Z` 单通道的 EXR | F7 单 dotted 数据层 |
| 含自定义后缀通道（非 R/G/B/A）的 EXR | F7 只读通道 UI |
| Multipart OpenEXR | F7 `layerListIncomplete` |
| 分辨率 >4096 或体积 >256MB 的 EXR | F3 通道开关禁用 |
| 体积 >512MB 的 EXR | F3 仅 RGBA 合成 |

---

## 1. 入口与基础交互

| # | 操作 | 期望 | 通过 |
|---|------|------|------|
| 1.1 | 资料库网格 **双击** `test_24.0046.exr` | 打开全页 EXR 预览，非通用图片预览 | ☐ |
| 1.2 | 选中 EXR → 详情面板 → **「EXR 预览」** | 同上 | ☐ |
| 1.3 | 预览页按 **Esc** 或左上角返回 | 回到资料库，无报错 | ☐ |
| 1.4 | 预览区 **滚轮** 缩放、拖拽平移、**重置视图** | 缩放百分比更新，图像居中可拖 | ☐ |
| 1.5 | 新导入 EXR 后网格出现 **缩略图**（非空白占位） | 数秒内生成 `thumb.webp` | ☐ |

---

## 2. F1 — RGBA fallback 与非 RGBA 失败语义

**样本：** `test_24.0046.exr`、`multi-layer.exr`

| # | 操作 | 期望 | 通过 |
|---|------|------|------|
| 2.1 | 打开 `test_24.0046.exr`，默认 **RGBA** 层 | 正常 HDR 预览（Reinhard + 曝光可调） | ☐ |
| 2.2 | 打开 `multi-layer.exr`，选中 **N**（法线）层 | 法线可视化（蓝紫色调、背景近黑），**曝光 slider 灰显** | ☐ |
| 2.3 | 在 N 层关闭 R/G/B 再逐个打开 | 图像随通道开关变化；无整页崩溃 | ☐ |
| 2.4 | 在 N 层预览正常前提下，切到 **albedo** 等 HDR 层 | 可正常切换，曝光重新可用 | ☐ |
| 2.5 | （可选）主进程临时破坏 exrs 初始化后重开 **RGBA** 预览 | 仍能通过 napi/ffmpeg 出合成图（非 AOV 层不应静默变成合成 beauty） | ☐ |

> **Fail 判定：** RGBA 文件在 exrs 异常时完全黑屏；或选 N 层却显示 beauty 合成图。

---

## 3. F2 — 默认图层统一与 metadata 诚实

**样本：** `multi-layer.exr`

| # | 操作 | 期望 | 通过 |
|---|------|------|------|
| 3.1 |  freshly 打开 `multi-layer.exr` 预览 | **初始选中层名** 与网格缩略图所用层一致（同为 beauty/RGBA 规则推导的 `defaultLayerName`） | ☐ |
| 3.2 | 侧栏 Layers 数量 | 与 header 解析层数一致（约 55，非 1 层假列表） | ☐ |
| 3.3 | 对比缩略图与预览 **首帧** 内容 | 同一默认层，主观一致（同 AOV、同 tonemap 风格） | ☐ |
| 3.4 | （可选）导入 header 损坏但 napi 可读的 EXR | 侧栏底部 **「无法读取完整图层列表，仅提供 RGBA 合成预览」**；不出现假多层层列表 | ☐ |

---

## 4. F3 — 预算、`previewable` 与侧栏文案

**样本：** `multi-layer.exr`（正常预算）；可选超大 EXR

| # | 操作 | 期望 | 通过 |
|---|------|------|------|
| 4.1 | `multi-layer.exr`（~7MB） | 可 **切换图层**；R/G/B/A（或 X/Y/Z）通道按钮可点 | ☐ |
| 4.2 | `multi-layer.exr` | 侧栏 **不** 显示「仅 RGBA 合成」或「通道开关已禁用」 | ☐ |
| 4.3 | 可选：>4096² 或 >256MB 文件 | 底部提示 **「超大 EXR：通道开关已禁用，仍可切换图层」**；通道按钮 disabled | ☐ |
| 4.4 | 可选：>512MB 或极高分辨率 | 提示 **「超大 EXR 仅提供 RGBA 合成预览…」**；图层列表不可点 | ☐ |
| 4.5 | `layerListIncomplete === true` 时 | 底部 amber 提示 + 仅合成模式（见 §8） | ☐ |

---

## 5. F4 — 预览 / 缩略图 / 取色三管线

**样本：** `multi-layer.exr`、`test_24.0046.exr`

| # | 操作 | 期望 | 通过 |
|---|------|------|------|
| 5.1 | 导入后查看 **颜色标签 / 色条**（若 UI 展示 dominant colors） | 与缩略图主色一致，无明显偏色 | ☐ |
| 5.2 | 删除 `thumb.webp` 后触发重新取色（再导入或重建缩略图） | 取色仍成功，且与当前默认层缩略图策略一致 | ☐ |
| 5.3 | `test_24.0046.exr` 预览曝光调至 **2.0** | 画面变亮，无截断异常 | ☐ |
| 5.4 | `multi-layer.exr` **albedo** 层曝光 | HDR Reinhard 响应正常 | ☐ |

---

## 6. F5 — 错误提示与 preview 协议

**样本：** `multi-layer.exr`

| # | 操作 | 期望 | 通过 |
|---|------|------|------|
| 6.1 | 打开预览后，Renderer DevTools → Elements 中 `<img src>` | URL 为 **`assetvault-exr-preview://`** 开头，**非** `data:image/jpeg;base64,...` | ☐ |
| 6.2 | 快速切换 3–5 个图层 | 每次均能加载新 preview URL；无 IPC 超大 payload 卡顿 | ☐ |
| 6.3 | （开发调试）构造不存在图层名请求失败 | 居中错误文案含 **「图层不存在」**（非泛化「渲染失败」） | ☐ |
| 6.4 | 关闭应用再打开 | 无 preview 协议残留报错；再次预览正常 | ☐ |

> 6.3 若无 API 注入手段，可通过临时改 `selectedLayer` 或 IPC 测试；也可标记 N/A。

---

## 7. F6 — 性能与 debounce

**样本：** `multi-layer.exr`

| # | 操作 | 期望 | 通过 |
|---|------|------|------|
| 7.1 | 连续快速点击 **5 个不同图层** | 最终稳定显示最后一层；右上角短暂「更新中…」可接受 | ☐ |
| 7.2 | 选中一层后 **反复切换 R/G/B** | ~180ms 防抖，无每 click 全文件重解码卡顿 | ☐ |
| 7.3 | 拖动 **曝光** slider 连续变化 | ~400ms 防抖；松手后图像更新，拖动过程不过度掉帧 | ☐ |
| 7.4 | 在同一图层重复切换 **曝光 1.0 ↔ 2.0** | 第二次明显更快（RGBA 子层缓存命中） | ☐ |
| 7.5 | （可选）Task Manager 观察内存 | 切换图层时内存无 base64 三倍膨胀尖峰 | ☐ |

---

## 8. F7 — AOV 分类与边界格式

### 8.1 多 AOV 分类（`multi-layer.exr`）

| # | 图层 / 场景 | 期望 | 通过 |
|---|-------------|------|------|
| 8.1.1 | **N** | 法线模式，曝光禁用 | ☐ |
| 8.1.2 | **crypto_*** 类 | Crypto 哈希色块，曝光禁用 | ☐ |
| 8.1.3 | **albedo** / beauty 类 | HDR，曝光可用 | ☐ |
| 8.1.4 | 若存在 **abnormal** 层 | 按 **HDR** 显示，**非**法线蓝紫风格 | ☐ |
| 8.1.5 | 若存在 **bidirectional** 层 | HDR beauty，**非** data 归一化灰度 | ☐ |

### 8.2 单 dotted / 自定义通道（可选样本）

| # | 操作 | 期望 | 通过 |
|---|------|------|------|
| 8.2.1 | 含 **`depth.Z`** 的文件 | 侧栏独立 **depth** 层，通道 **Z**；data 归一化显示 | ☐ |
| 8.2.2 | 含非 R/G/B/A 后缀的层 | 自定义后缀为 **只读标签**（不可点）；tooltip「自定义通道（始终参与预览）」 | ☐ |
| 8.2.3 | 仅自定义后缀、无 R/G/B/A | 显示 **「全通道」** 文字；预览仍出图 | ☐ |

### 8.3 Multipart（可选样本）

| # | 操作 | 期望 | 通过 |
|---|------|------|------|
| 8.3.1 | 打开 multipart EXR | 侧栏 **layerListIncomplete** 提示；**仅 RGBA 合成**模式 | ☐ |
| 8.3.2 | exrs 能解码时 | RGBA 预览仍可出图 | ☐ |

---

## 9. 回归与明确不做项

| # | 项 | 期望 | 通过 |
|---|-----|------|------|
| 9.1 | 非 EXR 图片（PNG/JPG）预览 | 不受影响 | ☐ |
| 9.2 | SVG / 字体 / 模型预览入口 | 不受影响 | ☐ |
| 9.3 | 与 Nuke / Chaos Player **像素级一致** | **不在范围**，不要求 | N/A |
| 9.4 | Web API 暴露 EXR 图层预览 | **未实现**，不要求 | N/A |

---

## 10. 签核

| 区块 | 必测样本 | 结果 | 备注 |
|------|----------|------|------|
| §1 入口 | 任一 EXR | ☐ Pass ☐ Fail | |
| §2 F1 fallback | `test_24.0046.exr` + `multi-layer.exr` | ☐ Pass ☐ Fail | |
| §3 F2 默认层 | `multi-layer.exr` | ☐ Pass ☐ Fail | |
| §4 F3 预算 | `multi-layer.exr` | ☐ Pass ☐ Fail | |
| §5 F4 三管线 | 两样本 | ☐ Pass ☐ Fail | |
| §6 F5 协议/错误 | `multi-layer.exr` | ☐ Pass ☐ Fail | |
| §7 F6 性能 | `multi-layer.exr` | ☐ Pass ☐ Fail | |
| §8 F7 边界 | 可选 | ☐ Pass ☐ Fail ☐ Skip | |

**总体结论：** ☐ **可发布** ☐ **需修复后复验**

**阻塞问题（如有）：**

1. 
2. 

---

## 附录 A — 快速命令

```bash
pnpm dev
pnpm test
pnpm exec electron-vite build
```

## 附录 B — DevTools 检查 preview 协议

1. 打开 EXR 预览页  
2. Renderer：`Ctrl+Shift+I` → Elements → 选中预览 `<img>`  
3. 确认 `src` 形如：`assetvault-exr-preview://cache/<uuid>.jpg`

## 附录 C — 与自动化测试对照

| 手工项 | 自动化覆盖 |
|--------|------------|
| §2 RGBA fallback | `exrPreviewRender.test.ts` |
| §3 默认层 = 缩略图 | `exrExrsDecoder.integration.test.ts` |
| §4 预算边界 | `exrChannelBudget.test.ts` |
| §6 preview 协议 | `exrPreviewCache.test.ts` |
| §7 RGBA 缓存 | `exrExrsDecoder.test.ts` |
| §8 AOV 分类 | `exrAovDisplay.test.ts` |
| §8 multipart | `exrMetadata.test.ts` |

自动化通过 **不能替代** §1 入口、§7 主观流畅度与 §5 取色 UI 目视检查。
