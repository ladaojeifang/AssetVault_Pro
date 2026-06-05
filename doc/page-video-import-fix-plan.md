# 作品页视频导入（pageVideoImport）— 优化与 Bug 修复计划

> **依据**：2026-06 对 `src/main/services/pageVideoImport/*` 与 Web API 的代码审阅（以代码为准）。  
> **关联**：[web-api-v1-guide.md](./web-api-v1-guide.md) §作品页视频导入、[web-api-v1-openapi.yaml](./web-api-v1-openapi.yaml)、扩展仓 `page-video-import` 联调规格。

---

## 目标

1. **单条与批量 API 行为一致**（Cookie、`format`、平台预设不互相打架）。
2. **类型与实现、文档三方对齐**（去掉「能解析但不能跑」的字段；错误码可区分）。
3. **取消与超时可靠**（running 任务能杀子进程、少留孤儿 temp）。
4. 关键路径有 **自动化测试** + 与扩展仓一致的 **手工验收清单**。

非目标（本计划不强行做，除非单独立项）：

- Job 持久化到 SQLite（工作量大，见 PVI-F8）。
- `importFromURL` 自动分流到 `pageVideoImport`（产品决策，见 PVI-F9）。
- 托管 `POST /system/ytdlp/update`（规格 optional）。

---

## 优先级总览

| 阶段 | 主题 | 优先级 | 预估 |
|------|------|--------|------|
| **PVI-F1** | 批量创建：Cookie / format 与单条对齐 | P0 | 2h |
| **PVI-F2** | `duplicatePolicy: replace` 语义落地或从 API 移除 | P0 | 3h |
| **PVI-F3** | 取消 running：子进程生命周期 | P0 | 4h |
| **PVI-F4** | 超时/停滞错误码拆分 + 队列命名澄清 | P1 | 2h |
| **PVI-F5** | 死代码与类型卫生（`runYtdlpForJob`、默认 Cookie） | P1 | 1h |
| **PVI-F6** | 文档 / OpenAPI / `app/info` 与实现对齐 | P1 | 2h |
| **PVI-F7** | 单元测试 + 冒烟脚本加固 | P1 | 4h |
| **PVI-F8** | Job 持久化（可选迭代） | P2 | 12h+ |
| **PVI-F9** | `importFromURL` 分流（可选产品项） | P3 | 6h+ |
| **PVI-F10** | B 站 extractor-args / 字幕选项 | P2–P3 | 4h+ |

建议发布批次：**F1 → F2 → F3**（联调必过）；**F4–F7** 同版本或紧跟小版本；F8–F10 按产品排期。

---

## 现状问题索引（历史审阅；多数已修复）

| ID | 状态 | 说明 |
|----|------|------|
| B1 | 已修复 | `buildBatchItemBody` + `parseCreateBody` |
| B2 | 已文档化 | `replace` → `import_copy` + `REPLACE_NOT_IMPLEMENTED` |
| B3 | 已修复 | `ytdlpCancel` + `killChildProcess` |
| B4 | 已修复 | `YTDLP_JOB_TIMEOUT` vs `YTDLP_STALLED` |
| B5 | 已修复 | `runYtdlpForJob(jobId)` 无死参数 |
| B6 | 已修复 | 删除 `defaultCookiesFromBrowser: edge`；默认 `none` |
| B7 | 部分 | runner 已支持 `--write-subs`，但**字幕不入库**（见 guide） |
| B8 | 已文档化 | `LIBRARY_NOT_READY` |
| B9 | 已缓解 | `getAppInfo` 在托管二进制存在时 `resetYtdlpCache` |
| B10 | 已修复 | `GET batch/{batchId}` |

**仍与代码/产品不一致、文档已标明：** `maxConcurrentJobs=2` 但实现通常串行 1 路 yt-dlp；B 站无 `extractor-args`。

---

## PVI-F1：批量创建与单条对齐（P0）

### 问题

`pageVideoImportCreate` 走完整 `parseCreateBody(body)`；`pageVideoImportBatch` 手写共享字段并 **省略** `cookiesFile`、`cookieHeader`，且在未传 body.`format` 时强制 `PAGE_VIDEO_IMPORT_LIMITS.defaultFormat`，使 `resolvePageVideoFormat(item.platform)` 对 **format 字段** 失效（`parseCreateBody` 收到非空 `format` 则不再按平台解析）。

### 改动

| 文件 | 内容 |
|------|------|
| `pageVideoImportService.ts` | **方案 A（推荐）**：批量循环改为 `parseCreateBody({ ...item, platform: item.platform ?? body.platform, targetFolderId: sharedTarget, duplicatePolicy: item.duplicatePolicy ?? body.duplicatePolicy, cookiesFromBrowser: item.cookiesFromBrowser ?? body.cookiesFromBrowser, cookiesFile: item.cookiesFile ?? body.cookiesFile, cookieHeader: item.cookieHeader ?? body.cookieHeader, format: item.format ?? body.format, sourceMeta: merge(item.sourceMeta, body.sourceMeta?), options: item.options ?? body.options })`；删除 batch 内独立的 `format`/`cookiesFromBrowser` 预解析块（或仅保留校验） |
| `pageVideoImportService.ts` | **方案 B（最小 diff）**：在现有循环的 `parseCreateBody` 参数中补上 `cookiesFile`、`cookieHeader`；**不传** `format`，除非 `body.format` 或 `item.format` 显式存在 |
| `doc/web-api-v1-guide.md` | 批量一节写明：顶层 `cookieHeader`/`cookiesFile`/`format` 可被 item 覆盖 |
| `doc/web-api-v1-openapi.yaml` | `PageVideoBatchCreateBody` 增加 `cookieHeader`、`cookiesFile` 与单条一致 |

### 验收

- [ ] `POST .../batch`，body 仅顶层 `cookieHeader` + `platform: bilibili` 的 items → 与单条 create 相同 stderr/清晰度表现。
- [ ] batch 无 `format`、item `platform: bilibili` → job 记录 `format` 等于 `pageVideoFormatPolicy` 的 bilibili 预设。
- [ ] batch 顶层 `format` 仅在没有 item.`format` 时生效。

### 测试（F7 可先做本项）

- vitest：`parseCreateBody` / 抽 `buildBatchItemBody(raw, shared)` 纯函数，覆盖「仅顶层 cookieHeader」「per-item platform」。

---

## PVI-F2：`duplicatePolicy: replace`（P0）

### 问题

API 接受 `replace`，`runJob` 却映射为 `import_copy`；`assetImportService` 本身仅支持 `ask` \| `use_existing` \| `import_copy`。

### 决策（实现前二选一，写入 guide）

| 选项 | 行为 | 工作量 |
|------|------|--------|
| **2a 实现 replace** | `use_existing` 查 `sourceUrl` 得 `existingAssetId` → 删除或覆盖文件 + 更新 metadata（需定义：仅换文件 vs 删资产重建） | 大 |
| **2b 拒绝 replace** | `parseCreateBody` 遇 `replace` 抛 `INVALID_REQUEST` 或降级为 `import_copy` 并 `warnings: ['REPLACE_NOT_IMPLEMENTED']` | 小 |

### 推荐（V1）

**2b + 文档**：扩展与 Playground 暂用 `use_existing` / `import_copy`；`replace` 保留在类型中则必须在 OpenAPI 标 `x-deprecated` 或从 schema 移除。

若选 **2a**，需对齐 `importAssetFromPath` / `patchAsset` 与资料库去重策略（hash、thumb、FTS）。

### 改动

| 文件 | 内容 |
|------|------|
| `pageVideoImportService.ts` | 与决策一致 |
| `pageVideoImportTypes.ts` | 注释或收窄联合类型 |
| `doc/web-api-v1-guide.md` | 明确三策略实际行为 |

### 验收

- [ ] `duplicatePolicy: replace` 行为与文档一字不差，无「静默当 copy」。

---

## PVI-F3：取消 running 与子进程（P0）

### 问题

- `pageVideoImportCancel` 对 running 只设 `cancelRequested`；依赖 stderr 轮询才 `killChild`。
- Windows `taskkill` 异步，取消 API 返回时进程可能仍在写 `.part`。
- 文档写「终止子进程」— 与实现有 gap。

### 改动

| 文件 | 内容 |
|------|------|
| `ytdlpRunner.ts` | `runYtdlpDownload` 返回 `{ promise, cancel: () => void }` 或在 opts 增加 `onChild: (cp) => void`；`killChild` 改为 `await` 可等待的 kill（win: `taskkill` + `child.on('close')` 超时） |
| `pageVideoImportStore.ts` | `PageVideoJobRecord` 增加可选 `abort?: () => void`（仅 running） |
| `pageVideoImportService.ts` | `runJob` 注册 abort；`pageVideoImportCancel` running 分支调用 abort + `removeJobTempDir` |
| `pageVideoImportService.ts` | `failJob` / 终态时清除 abort 引用，防泄漏 |

### 验收

- [ ] DELETE running job → 10s 内 temp 目录无活跃 `.part` 写入（大文件可放宽到 30s）。
- [ ] 取消后 `GET job` → `cancelled`，`filesRemoved: true`（若实现清理）。
- [ ] 连续取消同一 job 幂等。

---

## PVI-F4：错误码与队列语义（P1）

### 改动

| 文件 | 内容 |
|------|------|
| `ytdlpRunner.ts` | `jobTimer` → `reject(new Error('YTDLP_JOB_TIMEOUT'))`；stall 保持 `YTDLP_STALLED` |
| `pageVideoImportService.ts` | `ERROR_MESSAGES` 增加 `YTDLP_JOB_TIMEOUT` |
| `src/main/api/errors.ts` | `mapPageVideoThrown` 映射新码 |
| `pageVideoImportTypes.ts` | 将 `maxQueuedJobs` 重命名为 `maxActiveJobs` **或** 文档说明「含 running」；避免只改常量名破坏扩展（优先 **仅文档 + app/info.limits 注释**） |

### 验收

- [ ] 模拟 stall（mock stderr 无进度）→ `YTDLP_STALLED`。
- [ ] 模拟总超时（测试里 `jobTimeoutMs: 1000`）→ `YTDLP_JOB_TIMEOUT`。

---

## PVI-F5：死代码与类型卫生（P1）

| 文件 | 内容 |
|------|------|
| `pageVideoImportService.ts` | `runYtdlpForJob(jobId)` 去掉未用参数；fallback 分支 `updateJob` 写入 `cookiesFromBrowser: 'none'` 再调 runner（避免 job 记录与实参不一致） |
| `pageVideoImportTypes.ts` | 删除或改用 `defaultCookiesFromBrowser`（与 `parseCreateBody` 默认一致为 `'none'`） |
| `pageVideoImportTypes.ts` | `options.writeSubs` 标 `@deprecated` 直至 F10 |

---

## PVI-F6：文档 / OpenAPI / 能力探测（P1）

| 文件 | 内容 |
|------|------|
| `doc/web-api-v1-guide.md` | 补充 `cookieHeader`、`cookiesFile`、Cookie 优先级、平台 Cookie 回退表（youtube/vimeo/twitter）、B 站需 header |
| `doc/web-api-v1-openapi.yaml` | 同上；`duplicatePolicy` 与 F2 决策一致 |
| `handlers/app.ts` | **可选**：`ensureManagedYtdlpBinary` 成功后 invalidate 缓存 / 二次 `features`；或 guide 写明「首次自动下载后需重启或再 GET info」 |
| `doc/web-api-v1-guide.md` | 库错误：`LIBRARY_NOT_READY` vs `LIBRARY_NOT_OPEN` 触发条件（与 `common.ts` 一致） |

### 验收

- [ ] OpenAPI 与 guide 字段集合 = `parseCreateBody` 实际读取字段。
- [ ] 扩展能力探针 `JOB_NOT_FOUND` 仍可用（不改 jobId 格式）。

---

## PVI-F7：测试与冒烟（P1）

| 交付物 | 内容 |
|--------|------|
| `src/main/services/pageVideoImport/pageVideoImportService.test.ts` | `parseCreateBody`、batch body 合并、Cookie 互斥、`COOKIES_FILE_NOT_FOUND` |
| `src/main/services/pageVideoImport/ytdlpRunner.test.ts` | `classifyStderr`、`parseProgress`、cookie copy / DPAPI 分类 |
| `scripts/page-video-import-smoke.ps1` | 增加 batch + `cookieHeader` 用例；文档指向脚本 |

不强制 E2E 真下 B 站（CI 无 Cookie）；手工清单单独一节。

### 手工验收（联调扩展）

| # | 场景 | 期望 |
|---|------|------|
| M1 | 单条 YouTube，`cookiesFromBrowser: none` | completed + assetId |
| M2 | B 站 + DevTools `cookieHeader` | ≥1080p（有 Cookie 时） |
| M3 | batch 顶层 `cookieHeader`，2 条 BV | 两条均非 412 |
| M4 | `use_existing` 同 `sourceUrl` | skipped，无 yt-dlp 下载 |
| M5 | DELETE running | cancelled + temp 清理 |
| M6 | 重启 Pro 后旧 jobId | `JOB_NOT_FOUND`（已知限制，文档已写） |

---

## PVI-F8：Job 持久化（P2，可选）

### 范围

- SQLite 表 `page_video_jobs`（jobId、status、payload JSON、timestamps）或 JSONL 于 `userData`。
- 启动时：内存队列 + 恢复 `queued`/`running`（running → 标 `failed` + `YTDLP_INTERRUPTED` 更安全）。
- `purgeOrphanYtdlpTempDirs` 与 DB 状态一致。

### 不做则

在 guide 用粗体写：**Job 仅进程内有效**；扩展应在 Pro 退出前轮询终态。

---

## PVI-F9：`importFromURL` 分流（P3，产品）

若做：在 `urlAssetImportService` 或 handler 层检测作品页 URL → 返回 `PAGE_VIDEO_USE_PAGE_VIDEO_IMPORT` 或内部转调 `pageVideoImportCreate`。

需与扩展「直链仍走 importFromURL」契约对齐，避免双入口竞态。

---

## PVI-F10：平台增强（P2–P3）

| 项 | 说明 |
|----|------|
| 字幕 | `options.writeSubs` → `--write-subs` / `--sub-langs` |
| B 站 | 评估 `--extractor-args "bilibili:…"`（如会员清晰度）；依赖 Cookie 质量，需样例 Cookie 回归 |
| `GET .../batch/{batchId}` | 聚合查询；扩展可选实现 |

---

## 实施顺序（推荐甘特）

```text
Week A (联调阻断)
  F1 批量 Cookie/format
  F3 取消子进程
  F7 测试（F1 用例）

Week B (契约清晰)
  F2 replace 决策 + 文档
  F4 超时码
  F5 死代码
  F6 OpenAPI/guide

Backlog
  F8 持久化
  F9 分流
  F10 B 站/字幕/batch GET
```

---

## 跨仓库协调

| 仓库 | 动作 |
|------|------|
| **AssetVault Pro** | 本计划 F1–F7 |
| **AssetVault_Browser_Extension** | F1 后确认 batch 请求体是否传顶层 `cookieHeader`；能力探针不变 |
| **doc** | 每完成一阶段更新 guide + openapi；`DEVELOPMENT_PLAN.md` 可增 §2.x PVI 表 |

---

## 风险与回滚

| 风险 | 缓解 |
|------|------|
| F1 改变 batch 默认 format，旧客户端依赖「全局 best*」 | 无 body.format 时行为变为 per-platform，属 **修复**；在 CHANGELOG 注明 |
| F3 kill 过激误杀其它 yt-dlp | 仅 kill 登记过的 `child.pid` |
| F4 新错误码扩展未识别 | 扩展对未知 code 显示 `message`；文档列映射表 |

回滚：按阶段 revert；Job 无 DB 时无迁移负担。

---

## 完成定义（Definition of Done）

- [x] P0（F1–F3）代码合并 + vitest（`pageVideoImportParse.test.ts`、`ytdlpStderr.test.ts`）
- [x] guide / openapi 与 `parseCreateBody` 一致
- [x] `DEVELOPMENT_PLAN.md` / `doc/README.md` 索引
- [ ] 扩展仓联调记录（YouTube + B 站 batch）— 需本机手工

**已实现（2026-06-03）：** F1–F10（B 站 extractor-args 除外）。**文档同步（同日后）：** [web-api-v1-guide.md](./web-api-v1-guide.md)、[web-api-v1-openapi.yaml](./web-api-v1-openapi.yaml)、[web-api-v1-design.md](./web-api-v1-design.md) 已与实现对齐。

---

*文档版本：2026-06-03 · 实现基线：pageVideoImport + PVI 修复批次*
