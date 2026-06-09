# AssetVault Hub — 团队集中管理与联邦 Worker 平台

## PRD 产品需求规格说明书 V1.0

> **版本**: V1.0  
> **日期**: 2026-06-05  
> **状态**: 草案（待评审）  
> **关联文档**: [AssetVault_Pro_PRD_V1.0.md](./AssetVault_Pro_PRD_V1.0.md)（单机桌面）、[web-api-v1-design.md](./web-api-v1-design.md)（本机 API）、[asset-types-and-import.md](./asset-types-and-import.md)（入库类型）  
> **代号**: **Hub**（控制面）+ **Worker**（执行面）；单机 **Pro 桌面**永久保留，可作为胖 Worker 接入 Hub。

---

## 目录

- [一、产品概述](#一产品概述)
- [二、目标用户与场景](#二目标用户与场景)
- [三、产品边界与原则](#三产品边界与原则)
- [四、系统角色与部署形态](#四系统角色与部署形态)
- [五、功能需求（FRD）](#五功能需求frd)
- [六、模块规格详述](#六模块规格详述)
- [七、数据与资料库模型](#七数据与资料库模型)
- [八、API 与协议（v2 概要）](#八api-与协议v2-概要)
- [九、非功能需求（NFR）](#九非功能需求nfr)
- [十、UI/UX 要求](#十uiux-要求)
- [十一、版本路线图与里程碑](#十一版本路线图与里程碑)
- [十二、验收标准](#十二验收标准)
- [十三、风险与依赖](#十三风险与依赖)
- [附录 A：Worker 能力矩阵](#附录-aworker-能力矩阵)
- [附录 B：与单机 Pro 功能对照](#附录-b与单机-pro-功能对照)
- [附录 C：术语表](#附录-c术语表)

---

## 一、产品概述

### 1.1 产品定位

**AssetVault Hub** 是 AssetVault 产品线的 **团队控制面**：提供 HTTPS Web 控制台、用户与权限、多资料库登记、任务调度与审计；**不替代**单机 **AssetVault Pro 桌面**。

执行面采用 **联邦 Worker** 模型：

| 执行节点 | 角色 |
|----------|------|
| **Pro 桌面（胖 Worker）** | 用户本机常驻，承担本机路径导入、yt-dlp、EXR/3D、catalog、批量扫描等全量能力 |
| **Web 瘦客户端** | 浏览器/PWA：浏览、打标签、上传、轻量导入；重活由 Hub 派发给在线 Pro/云端 Worker |
| **云端 Worker（可选）** | Hub 同机房进程池，服务 **集中库**（对象存储）上的重活队列 |

### 1.2 产品愿景

> 个人用 Pro 桌面离线也能完整工作；团队用 Hub 统一看见、标注、调度资产——**算力在边缘，索引在中心，文件按库策略落地**。

### 1.3 核心价值主张

| 维度 | 承诺 |
|------|------|
| **单机永不弃用** | Pro 桌面可永久离线；连接 Hub 为可选增强 |
| **边缘算力** | 每人装 Pro 即可成为 Worker，无需把所有文件上云 |
| **集中可见** | Web 控制台统一浏览、标签、权限、审计 |
| **任务可追溯** | 导入/缩略图/视频下载一律 Job 化，可查询、可重试 |
| **渐进部署** | 小团队 Docker Compose；大企业 K8s + 对象存储 |

### 1.4 与现有产品的关系

```text
AssetVault Pro 桌面（V1 已实现）
  ├── 模式 A：单机资料库（现状，默认）
  └── 模式 B：Hub Worker Agent（本 PRD 新增）

AssetVault Hub（本 PRD）
  ├── Web Console（新 SPA）
  ├── API Gateway + Auth + Job Scheduler
  └── 可选 Cloud Worker Pool

AssetVault 浏览器扩展
  └── 目标：本机 Pro / Hub v2 / 用户 Desktop Worker（经 Hub 签发令牌）
```

---

## 二、目标用户与场景

### 2.1 用户画像

#### 画像 D：个人创作者「小美」（延续 V1）

| 属性 | 描述 |
|------|------|
| **诉求** | 继续只用 Pro 桌面，不强制注册 Hub |
| **Hub 价值** | 可选：把精选集同步到团队库；笔记本关机前用 Web 只读浏览 |

#### 画像 E：团队负责人「老张」

| 属性 | 描述 |
|------|------|
| **诉求** | 成员各自本机素材 + 团队共享成品库；权限分级 |
| **Hub 价值** | Web 控制台、RBAC、审计；成品入 **集中库**， WIP 留 **边缘库** |

#### 画像 F：运维「王工」

| 属性 | 描述 |
|------|------|
| **诉求** | 内网 HTTPS、OIDC、备份、Worker 可审计 |
| **Hub 价值** | 私有化部署 Hub；Pro Worker 仅出站连接 Hub，无需每台开端口 |

### 2.2 核心场景（User Stories）

| ID | 作为 | 我想要 | 以便 |
|----|------|--------|------|
| US-01 | 个人用户 | 不登录 Hub 使用 Pro 桌面 | 数据完全本地、离线可用 |
| US-02 | 个人用户 | 在 Pro 设置里「连接团队 Hub」并勾选本机库 | 团队能在 Web 上看见我授权的库（缩略图/元数据） |
| US-03 | 编辑 | 在 Web 上给共享库资产打标签、移文件夹 | 不用装 Pro 也能整理团队成品 |
| US-04 | 编辑 | 在 Web 上传 PNG/ZIP | 文件进入集中库并自动生成缩略图 |
| US-05 | 采集员 | 用浏览器扩展保存到 Hub 集中库 | 扩展指向 `https://hub/api/v2` |
| US-06 | 采集员 | 扩展把整页截图/作品页视频 job 派给我的 Pro Worker | 重活在有 yt-dlp/ffmpeg 的本机执行 |
| US-07 | 设计师 | catalog 库只登记路径，文件仍在 NAS | 仅 NAS 旁的 Pro Worker 能导入/预览原文件 |
| US-08 | 管理员 | 为库分配 viewer/editor/admin | 控制谁能删资产、谁能管成员 |
| US-09 | 管理员 | 查看谁导入/删除了某资产 | 合规审计 |
| US-10 | 运维 | Hub 双机 + PG 主从 + MinIO | 控制面高可用；边缘 Worker 离线时任务排队 |

---

## 三、产品边界与原则

### 3.1 必须遵守（In Scope 原则）

1. **单机 Pro 功能不回退**：现有导入、预览、资料库模式、本机 Web API v1 保持可用。
2. **Hub 与 Pro 共用入库语义**：扩展名矩阵、`file_type`、OBJ+MTL、article bundle 等与 [asset-types-and-import.md](./asset-types-and-import.md) 一致。
3. **Worker 仅出站连 Hub**：Pro Worker 不默认监听公网端口；NAT/家庭网络友好。
4. **权限默认最小化**：viewer 不能写；editor 不能删库；admin 不能改计费（若有）。

### 3.2 明确不做（V1 Hub 非目标）

| 非目标 | 说明 |
|--------|------|
| 用 Web 完全替代 Pro 安装包 | Web 不承担本机路径导入、yt-dlp、catalog 扫描 |
| 公网无 TLS 部署 | 生产必须 HTTPS |
| 多 Hub 联邦（跨组织） | V1 单 Organization 单 Hub 实例 |
| 实时协同编辑（OT/CRDT） | V1 仅「最后写入胜出」+ 乐观锁版本号 |
| 替代专业 DCC 插件生态 | Ps/Figma 插件仍走 Pro 或后续 Hub 适配层 |
| Web 端完整 EXR 客户端解码 | 依赖 Worker 预渲染/按需渲染 + 缓存 |

### 3.3 架构原则

```text
控制面（Hub）     ：人、权限、元数据索引、任务状态、Web UI
数据面（Storage） ：集中库→对象存储；边缘库→Pro 本机/NAS
执行面（Worker）  ：Pro 胖 Worker / 云端 Worker / Web 瘦 Worker（上传）
```

---

## 四、系统角色与部署形态

### 4.1 逻辑组件

| 组件 | 职责 |
|------|------|
| **API Gateway** | TLS、JWT/OIDC、RBAC、限流、路由 |
| **Metadata Service** | 资产/文件夹/标签/成员/库 CRUD（PostgreSQL） |
| **Job Service** | 创建、调度、重试、取消、进度 |
| **Object Storage** | 集中库文件（S3/MinIO） |
| **Web Console** | React SPA |
| **Pro Worker Agent** | Pro 主进程内模块：注册、心跳、claim job、回写 |
| **Cloud Worker** | 可选容器池，消费集中库任务 |
| **Notification** | WebSocket：job 进度、Worker 上下线 |

### 4.2 部署拓扑（参考）

**小团队（≤20 人）**

```text
Docker Compose：traefik + hub-api×2 + hub-worker×2 + postgres + redis + minio + web-static
认证：Authentik / Keycloak 同机
Pro：成员各自安装，Worker Agent 出站连 Hub
```

**企业（HA）**

```text
K8s：Gateway Deployment、PG 主从、Redis Sentinel、MinIO 分布式
监控：Prometheus + 日志聚合
Pro Worker：办公网/NAS 旁多台
```

### 4.3 Pro 桌面双模式

| 模式 | 元数据 | 文件 | 网络 |
|------|--------|------|------|
| **A 单机** | 本机 SQLite | 本机 | 可选本机 API v1 |
| **B 已连接 Hub** | 边缘库索引同步 Hub；可同时打开本地库 | 本机/NAS | Worker Agent + 可选同步 thumb |

用户可在设置中 **随时断开 Hub**，回到模式 A，本地库不受影响。

---

## 五、功能需求（FRD）

需求编号：`HUB-FR-{模块}-{序号}`。优先级：**P0** 首发阻塞 / **P1** 首发应含 / **P2** 后续版本。

### 5.1 认证与组织（AUTH）

| ID | 优先级 | 需求描述 | 验收要点 |
|----|--------|----------|----------|
| HUB-FR-AUTH-01 | P0 | Hub 支持 OIDC 登录（Authorization Code + PKCE） | Web Console 可登录/登出/刷新令牌 |
| HUB-FR-AUTH-02 | P0 | 支持本地账号（邮箱+密码）作为 OIDC 备选 | 内网无外网 IdP 时可创建管理员 |
| HUB-FR-AUTH-03 | P0 | Pro Worker 使用 **设备授权流**（Device Code）绑定用户 | Pro 显示码，用户在 Web 确认后下发 device token |
| HUB-FR-AUTH-04 | P0 | 所有 Hub API（除登录/健康检查）必须 HTTPS + Bearer JWT | HTTP 明文拒绝 |
| HUB-FR-AUTH-05 | P1 | Device token 可吊销、可列表「我的设备」 | 丢设备后可一键下线 |
| HUB-FR-AUTH-06 | P1 | API Key（服务账号）供 CI/脚本 | 绑定 library 范围与 role 上限 |
| HUB-FR-AUTH-07 | P2 | 组织（Organization）多租户隔离 | 不同 org 库与成员不可见 |

### 5.2 权限与成员（RBAC）

| ID | 优先级 | 需求描述 | 验收要点 |
|----|--------|----------|----------|
| HUB-FR-RBAC-01 | P0 | 库级角色：owner / admin / editor / viewer | 权限表见 §6.2 |
| HUB-FR-RBAC-02 | P0 | 邀请成员（邮件链接或管理员直接添加） | viewer 不能邀请 |
| HUB-FR-RBAC-03 | P0 | 所有写操作记录 `actorUserId` | 审计日志可查询 |
| HUB-FR-RBAC-04 | P1 | 文件夹级继承权限（可选只读子树） | 子文件夹默认继承库角色 |
| HUB-FR-RBAC-05 | P1 | Worker 绑定库：仅 claim 被授权的 `libraryId` | 跨库 job 返回 403 |
| HUB-FR-RBAC-06 | P2 | 资产级 ACL（单资产分享链接） | 只读外链带过期 |

### 5.3 资料库管理（LIB）

| ID | 优先级 | 需求描述 | 验收要点 |
|----|--------|----------|----------|
| HUB-FR-LIB-01 | P0 | 创建库：名称、描述、`storageClass` | 见 §7.1 |
| HUB-FR-LIB-02 | P0 | **集中库**（cloud）：文件存对象存储 | Web 上传直达 MinIO |
| HUB-FR-LIB-03 | P0 | **边缘库**（edge）：元数据在 Hub，文件在 Pro 本机/NAS | 必须绑定 ≥1 Pro Worker |
| HUB-FR-LIB-04 | P0 | 库状态：active / readonly / archived | readonly 拒绝写 job |
| HUB-FR-LIB-05 | P1 | 库配额：最大资产数、最大存储 GB | 超配额拒绝导入 |
| HUB-FR-LIB-06 | P1 | 从单机 Pro 库「注册到 Hub」（边缘库） | 选择本机库路径，上传索引+thumb 策略 |
| HUB-FR-LIB-07 | P2 | 库迁移：edge→cloud 后台复制 | 进度 job + 可暂停 |
| HUB-FR-LIB-08 | P2 | 跨库导入（延续 LIM 语义） | Hub 侧跨 prefix 复制 |

### 5.4 Pro 桌面 Worker（DWORK）

| ID | 优先级 | 需求描述 | 验收要点 |
|----|--------|----------|----------|
| HUB-FR-DWORK-01 | P0 | Pro 设置：连接 Hub URL、设备登录、启用 Worker | 单机模式可关闭，默认关闭 |
| HUB-FR-DWORK-02 | P0 | 上报 **capabilities** 清单 | 见附录 A |
| HUB-FR-DWORK-03 | P0 | 心跳间隔 ≤30s；离线 >90s 标记 offline | Web 显示 Worker 状态 |
| HUB-FR-DWORK-04 | P0 | WebSocket 长连接 claim job；断线重连续传 | job 不丢 |
| HUB-FR-DWORK-05 | P0 | 执行 `import_path`：本机绝对路径导入边缘库 | 与单机 import 行为一致 |
| HUB-FR-DWORK-06 | P0 | 执行 `ytdlp_import`、`fullpage_stitch`、`article_bundle` | 复用现有 service |
| HUB-FR-DWORK-07 | P0 | 执行 `thumb_generate`（image/video/exr/3d/font） | 完成后上传 thumb 或通知 Hub |
| HUB-FR-DWORK-08 | P1 | 绑定多个边缘库路径（catalog/archive） | Worker 列表展示绑定关系 |
| HUB-FR-DWORK-09 | P1 | 「仅同步元数据/缩略图」计划任务 | 减少 Web 浏览延迟 |
| HUB-FR-DWORK-10 | P1 | Worker 资源上报：CPU、磁盘、队列深度 | 调度可参考负载 |
| HUB-FR-DWORK-11 | P2 | 无 UI 托盘模式：仅 Worker Agent | 开机自启 |
| HUB-FR-DWORK-12 | P2 | 同一 `libraryId` 多 Worker 主备 | 主离线时备机 claim |

### 5.5 Web 瘦 Worker / 控制台（WEB）

| ID | 优先级 | 需求描述 | 验收要点 |
|----|--------|----------|----------|
| HUB-FR-WEB-01 | P0 | 资产网格/列表：分页、排序、按文件夹/标签筛选 | 1 万条分页 <2s（Hub 侧） |
| HUB-FR-WEB-02 | P0 | 缩略图展示：集中库直链；边缘库走 Hub 缓存或 Worker 代理 | 无 Worker 在线时显示占位+提示 |
| HUB-FR-WEB-03 | P0 | 标签：创建、分配、批量分配 | editor+ |
| HUB-FR-WEB-04 | P0 | 文件夹树：创建、移动资产 | editor+ |
| HUB-FR-WEB-05 | P0 | 分片上传（≥50MB）到集中库 | 断点续传 |
| HUB-FR-WEB-06 | P0 | `import_from_url` 提交 job | 由 Cloud/Pro Worker 执行 |
| HUB-FR-WEB-07 | P1 | 预览：图片、视频、SVG、Markdown | 与 Pro 预览语义对齐 |
| HUB-FR-WEB-08 | P1 | 预览：3D（glb/gltf/obj 等）流式加载 | 鉴权 URL |
| HUB-FR-WEB-09 | P1 | 预览：EXR 默认层 + 曝光；多层需预渲染缓存 | Worker 生成缓存 |
| HUB-FR-WEB-10 | P1 | 详情面板：metadata、hash、来源 URL、导入管道 | 读 Hub 元数据 |
| HUB-FR-WEB-11 | P1 | Job 中心：查看我的任务、团队任务（admin） | WebSocket 进度条 |
| HUB-FR-WEB-12 | P2 | 字体全屏预览 | 依赖 font 资产流 |
| HUB-FR-WEB-13 | P2 | PWA 离线：仅缓存已浏览缩略图 | 不承诺离线写 |

### 5.6 任务系统（JOB）

| ID | 优先级 | 需求描述 | 验收要点 |
|----|--------|----------|----------|
| HUB-FR-JOB-01 | P0 | 统一 Job 模型：`id, type, libraryId, status, progress, error, createdBy` | 状态机见 §6.4 |
| HUB-FR-JOB-02 | P0 | 调度：按 capability + library 绑定选择 Worker | 无 Worker 则 `queued` |
| HUB-FR-JOB-03 | P0 | 幂等：`idempotencyKey` 或 contentHash 去重 | 重复提交返回已有 job/asset |
| HUB-FR-JOB-04 | P0 | 取消：queued/running 可取消 | running 时 Worker 中止子进程 |
| HUB-FR-JOB-05 | P1 | 重试：失败 job 可手动/自动重试（最多 N 次） | 审计记录 |
| HUB-FR-JOB-06 | P1 | 优先级：用户手动导入 > 批量后台 | 可配置 |
| HUB-FR-JOB-07 | P2 | 定时 job：库自检、hash 扫描、缩略图重建 | 仅 admin |

### 5.7 资产与搜索（ASSET）

| ID | 优先级 | 需求描述 | 验收要点 |
|----|--------|----------|----------|
| HUB-FR-ASSET-01 | P0 | 资产 CRUD 与单机字段对齐：`fileType, extension, dimensions, duration, metadata` | 见 asset-types 文档 |
| HUB-FR-ASSET-02 | P0 | 软删除 + 回收站（30 天） | admin 可永久删 |
| HUB-FR-ASSET-03 | P1 | 全文搜索：文件名、标签 | PG tsvector 或 Meilisearch |
| HUB-FR-ASSET-04 | P1 | 按 fileType / 扩展名 / 颜色 / 尺寸筛选 | Web 筛选器 |
| HUB-FR-ASSET-05 | P2 | 以图搜图 | 独立向量服务 |
| HUB-FR-ASSET-06 | P2 | 重复资产检测（hash）跨库报告 | 仅 admin |

### 5.8 浏览器扩展集成（EXT）

| ID | 优先级 | 需求描述 | 验收要点 |
|----|--------|----------|----------|
| HUB-FR-EXT-01 | P1 | 扩展配置 Hub `apiBaseUrl` + OAuth/API Key | 保存到 `chrome.storage` |
| HUB-FR-EXT-02 | P1 | 图片批量/拖拽保存到指定集中库 | job 或同步 API |
| HUB-FR-EXT-03 | P1 | 整页截图/文章 bundle/作品页视频会话 API v2 | 路径带 `libraryId` |
| HUB-FR-EXT-04 | P2 | 扩展选择「执行 Worker」：自动 / 我的 Pro / 云端 | Hub 路由 |

### 5.9 审计与运维（OPS）

| ID | 优先级 | 需求描述 | 验收要点 |
|----|--------|----------|----------|
| HUB-FR-OPS-01 | P0 | 审计日志：登录、导入、删除、权限变更 | 保留 180 天可配置 |
| HUB-FR-OPS-02 | P0 | 健康检查：`/health`、`/ready` | K8s 探针 |
| HUB-FR-OPS-03 | P1 | 指标：job 吞吐、Worker 在线数、API P95 | Prometheus |
| HUB-FR-OPS-04 | P1 | 备份：PG 日备、MinIO 生命周期 | 文档化恢复流程 |
| HUB-FR-OPS-05 | P2 | 多 Hub 只读灾备 | 冷备 |

### 5.10 单机 Pro 兼容（PRO）

| ID | 优先级 | 需求描述 | 验收要点 |
|----|--------|----------|----------|
| HUB-FR-PRO-01 | P0 | 未连接 Hub 时 Pro 行为与当前版本一致 | 回归测试集通过 |
| HUB-FR-PRO-02 | P0 | 本机 Web API v1 保留；与 Hub v2 并存 | v1 不强制 token（本机） |
| HUB-FR-PRO-03 | P1 | Pro 内嵌「在 Web 中打开此库」深链接 | 已连接边缘库 |
| HUB-FR-PRO-04 | P1 | 从 Hub 拉取的集中库只读缓存（可选） | 离线浏览最近浏览 |

---

## 六、模块规格详述

### 6.1 Web Console 信息架构

```text
/login
/libraries                    # 库列表（我有权限的）
/libraries/:id/assets         # 主网格
/libraries/:id/folders
/libraries/:id/tags
/libraries/:id/jobs
/libraries/:id/settings         # admin：成员、配额、Worker 绑定
/workers                      # 我的设备 / admin 看全部
/admin/audit                  # admin
/settings/profile
```

### 6.2 库级 RBAC 权限矩阵

| 操作 | viewer | editor | admin | owner |
|------|--------|--------|-------|-------|
| 浏览资产/预览 | ✓ | ✓ | ✓ | ✓ |
| 下载原文件 | △ 可配置 | ✓ | ✓ | ✓ |
| 上传/导入 | ✗ | ✓ | ✓ | ✓ |
| 打标签/移文件夹 | ✗ | ✓ | ✓ | ✓ |
| 删除资产 | ✗ | ✗ | ✓ | ✓ |
| 管理成员 | ✗ | ✗ | ✓ | ✓ |
| 改库设置/删库 | ✗ | ✗ | ✗ | ✓ |
| 管理 Worker 绑定 | ✗ | ✗ | ✓ | ✓ |

### 6.3 边缘库浏览数据流

```text
Web 请求资产列表
  → Hub PG 返回元数据 + thumbStatus

thumb 命中 Hub 缓存（Pro 已同步）
  → 302 签名 URL

thumb 未命中 && Worker 在线
  → Hub 下发 sync_thumb job（异步）或同步代理（小图，超时 3s）

thumb 未命中 && Worker 离线
  → 占位图 + UI「执行节点离线」
```

### 6.4 Job 状态机

```text
pending → queued → claimed → running → succeeded
                              ↘ failed → (retry) → queued
                              ↘ cancelled
```

| 状态 | 说明 |
|------|------|
| pending | 已创建，待校验配额 |
| queued | 无可用 Worker |
| claimed | Worker 已领取 |
| running | 执行中（含 progress 0–100） |
| succeeded | 产出 assetId 或附加 metadata |
| failed | 带 `errorCode` / `message` |
| cancelled | 用户或 admin 取消 |

### 6.5 Job 类型（V1 最小集）

| type | 执行者 | 说明 |
|------|--------|------|
| `asset.import.upload` | Web→存储→Cloud Worker | 上传完成后入库 |
| `asset.import.url` | Cloud / Pro | URL 下载 |
| `asset.import.path` | Pro only | 本机路径 |
| `asset.import.fullpage` | Pro | 整页会话 finish |
| `asset.import.article_bundle` | Pro | 文章包 finish |
| `asset.import.page_video` | Pro | yt-dlp |
| `asset.thumb.generate` | Pro / Cloud | 各类缩略图 |
| `asset.exr.preview_cache` | Pro / Cloud | EXR 分层预览缓存 |
| `library.edge.sync_meta` | Pro | 边缘库元数据/缩略图同步 |
| `library.migrate.edge_to_cloud` | Cloud + Pro | P2 |

### 6.6 Pro Worker Agent 进程模型

- **位置**：`src/main/hubWorker/`（新模块），与现有 `api/server.ts` 并列。
- **生命周期**：用户启用「连接 Hub」且应用运行时维持 WSS；退出应用暂停 claim（job 回 queued）。
- **资源隔离**：同一时刻运行 job 数可配置（默认 2），避免拖垮 UI。
- **与单机库关系**：Worker 处理的边缘库可与「当前打开的本机库」是同一目录；Hub 只多写索引副本。

### 6.7 抽取共享核心（assetvault-core）

| 模块 | 来源（Pro 现状） | Hub/Worker 共用 |
|------|------------------|-----------------|
| 格式分类 | `supportedFormats.ts`, `fileUtils.ts` | ✓ |
| 入库 | `importSingleAsset.ts` | ✓ |
| 缩略图 | `ThumbnailService.ts` | ✓ |
| 侧车语义 | `assetSidecar` / `meta.json` | 边缘保留；集中库转 PG+json 列 |

---

## 七、数据与资料库模型

### 7.1 Library.storageClass

| storageClass | 文件位置 | 元数据 | Worker 要求 |
|--------------|----------|--------|-------------|
| `cloud` | MinIO `libraries/{libId}/items/{assetId}/` | PostgreSQL | Cloud Worker 或任意 Pro |
| `edge` | Pro 本机 `libraryRoot/items/...` | Hub PG + 可选本机 SQLite 双写 | 绑定 Pro Worker |
| `local_only` | 仅 Pro 本机 | 仅本机 SQLite | **不登记 Hub**（模式 A） |

### 7.2 核心实体（PostgreSQL 逻辑模型）

```text
organizations
users
organization_members
libraries (id, org_id, storage_class, status, quota...)
library_members (library_id, user_id, role)
workers (id, user_id, device_name, capabilities[], status, last_seen)
worker_library_bindings (worker_id, library_id, paths[])
assets (id, library_id, file_type, content_hash, storage_key OR edge_uri, ...)
folders, tags, asset_tags, asset_folders
jobs (id, library_id, type, payload_json, status, worker_id, ...)
audit_logs
thumb_cache (asset_id, variant, storage_key, expires_at)  -- 边缘库缓存
```

### 7.3 资产文件引用

| 库类型 | `storage_key` / `edge_uri` |
|--------|----------------------------|
| cloud | `s3://bucket/libraries/{libId}/items/{id}/{filename}` |
| edge | `edge://{workerId}/{absolutePath}` 或注册时的 `libraryRoot` 相对路径 |

Web **永不**直接暴露 edge 绝对路径给浏览器；通过 Hub 鉴权代理或缓存对象。

### 7.4 与单机 `meta.json` 映射

集中库：Hub PG 为权威；可选导出 `meta.json` 兼容 LIM 整包导入。  
边缘库：本机 `meta.json` 与 Hub 定期 sync（`library.edge.sync_meta`），冲突以 Hub `updatedAt` + 操作者为准。

---

## 八、API 与协议（v2 概要）

Base：`https://{hub}/api/v2`

### 8.1 认证

```http
Authorization: Bearer <access_token>        # Web 用户
Authorization: Bearer <device_token>        # Pro Worker
X-Worker-Id: <uuid>                         # Worker 请求必填
```

### 8.2 代表性端点（非完整 OpenAPI）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/app/info` | 版本、特性开关 |
| POST | `/auth/device/start` | 设备码流程 |
| POST | `/workers/register` | 注册能力与绑定 |
| WSS | `/workers/{id}/stream` | claim / progress / complete |
| GET | `/libraries` | 我有权限的库 |
| POST | `/libraries` | 创建库 |
| GET | `/libraries/{id}/assets` | 分页列表 |
| POST | `/libraries/{id}/jobs` | 创建任务 |
| GET | `/libraries/{id}/jobs/{jobId}` | 状态 |
| POST | `/libraries/{id}/assets/upload/init` | 分片上传初始化 |
| GET | `/assets/{id}/thumb` | 缩略图（签名重定向） |
| GET | `/assets/{id}/content` | 原文件流（鉴权） |

完整 OpenAPI 在 **Hub MVP 启动前** 单独维护 `doc/hub-api-v2-openapi.yaml`（本 PRD 不展开每个字段）。

### 8.3 与 Web API v1 关系

| 项 | v1（Pro 本机） | v2（Hub） |
|----|----------------|-----------|
| 监听 | 127.0.0.1 / 可选 0.0.0.0 | Hub 域名 HTTPS |
| 鉴权 | 远程单 token | JWT + RBAC |
| libraryId | 隐式当前库 | 显式路径参数 |
| 任务 | 部分有 job | 全部 job 化 |

Pro 桌面未来可提供 **v1→v2 适配层**（仅本机代理到 Hub），非 V1 Hub 阻塞项。

---

## 九、非功能需求（NFR）

### 9.1 性能

| 指标 | 目标 |
|------|------|
| Web 资产列表 API P95 | ≤ 500ms（1 万资产库，50 条分页） |
| 缩略图 CDN/缓存命中 | ≤ 200ms |
| Job 创建到 claimed | ≤ 5s（Worker 在线时） |
| 单 Pro Worker 并行 job | 默认 2（可配置 1–4） |
| 边缘库 sync_meta 全量 | 10 万资产 ≤ 30min（可增量） |

### 9.2 可用性

| 组件 | 目标 |
|------|------|
| Hub API | 99.5% / 月（小团队单机可接受 99%） |
| 边缘库浏览 | 依赖 Worker 在线；离线可浏览已缓存 thumb |
| RPO/RTO（PG+MinIO） | RPO ≤ 24h，RTO ≤ 4h（文档化流程） |

### 9.3 安全

- TLS 1.2+；HSTS 可选  
- JWT 短期 access + refresh rotation  
- Device token 哈希存储  
- 上传扩展名白名单 = `ALL_SUPPORTED_IMPORT_EXTENSIONS`  
- 速率限制：登录 5/min/IP；上传 100/h/user  
- 作品页视频：禁止浏览器 Origin 直 POST（延续 `pageVideoSecurity` 语义）

### 9.4 兼容性

- Pro 桌面：Windows 10+ 先交付 Worker Agent；macOS 跟随  
- 浏览器：Chrome/Edge 最近两版；Safari P2  
- 扩展：Manifest host 改为 Hub 域名 + 可选 `private_network` 声明

### 9.5 可观测性

- 结构化日志：`jobId`, `libraryId`, `workerId`, `userId`  
- 指标：`hub_jobs_total`, `hub_worker_online`, `hub_api_latency`  
- 告警：队列深度 >1000、PG 连接耗尽、MinIO 不可用

---

## 十、UI/UX 要求

### 10.1 设计原则

1. **Web Console 与 Pro 桌面视觉同源**：复用 Design Token（`av-*`），降低学习成本。  
2. **Worker 状态可见**：库设置页展示绑定 Worker、在线/离线、最后同步时间。  
3. **离线预期管理**：边缘库资产卡片离线时显示明确文案，而非空白裂图。  
4. **Job 反馈**：长时间操作（视频下载、大上传）必须显示进度与可取消。

### 10.2 关键页面线框要求

| 页面 | 必备元素 |
|------|----------|
| 库首页 | 网格/列表切换、筛选、搜索、当前 Worker 状态条 |
| 资产详情 | 预览区、标签、文件夹、metadata JSON、来源、job 历史 |
| 上传 | 拖拽、分片进度、重复策略（skip/copy） |
| Pro 连接向导 | Hub URL → 设备码 → 选择托管库 → 能力确认 |
| 管理后台 | 成员、角色、审计表、配额 |

### 10.3 国际化

- Web Console：zh-CN / en-US 与 Pro 渲染器共用文案键规范（`hub:*` 命名空间）  
- Hub API 错误 `message`：支持 `Accept-Language`

---

## 十一、版本路线图与里程碑

### 11.1 总览

```text
Hub 0.1 (P0 基础)  →  Hub 0.5 (P1 团队)  →  Hub 1.0 (P2 企业)
   12–16 周              10–14 周               12+ 周
```

### 11.2 Hub 0.1 — 控制面 + 集中库 MVP

**目标**：能登录、建集中库、Web 浏览上传、Cloud Worker 入库缩略图；Pro 仍可单机。

| 里程碑 | 交付 |
|--------|------|
| M0.1-1 | PostgreSQL schema、OIDC、Gateway 骨架 |
| M0.1-2 | Web Console：库列表、资产网格、标签、文件夹 |
| M0.1-3 | 分片上传 + `asset.import.upload` + thumb |
| M0.1-4 | Docker Compose 一键部署文档 |
| M0.1-5 | Pro 回归：未连接 Hub 零影响 |

**不含**：Pro Worker、边缘库、扩展连 Hub。

### 11.3 Hub 0.5 — Pro Worker + 边缘库

**目标**：团队混合库（成品 cloud + WIP edge）；扩展可指向 Hub。

| 里程碑 | 交付 |
|--------|------|
| M0.5-1 | 设备授权 + Worker 注册/WSS |
| M0.5-2 | Pro Worker：import_path、ytdlp、fullpage、article_bundle |
| M0.5-3 | 边缘库注册 + sync_meta + thumb 缓存 |
| M0.5-4 | Web 预览：图/视频/3D；EXR 预渲染档 A |
| M0.5-5 | 扩展 v2 配置 + 批量图保存 |
| M0.5-6 | 审计日志、Job 中心 |

### 11.4 Hub 1.0 — 企业化

| 里程碑 | 交付 |
|--------|------|
| M1.0-1 | HA 部署指南（K8s）、PG 主从、监控告警 |
| M1.0-2 | API Key、配额、库迁移 edge→cloud |
| M1.0-3 | 搜索增强（Meilisearch）、回收站、hash 跨库报告 |
| M1.0-4 | EXR 按需渲染池、多 Worker 主备 |
| M1.0-5 | Pro 托盘 Worker、无 UI 模式 |

### 11.5 与单机 Pro 版本关系

| Pro 版本 | Hub 版本 | 关系 |
|----------|----------|------|
| Pro 1.x（当前） | — | 无依赖 |
| Pro 1.5 | Hub 0.5 | 可选安装 Worker Agent 模块 |
| Pro 2.x | Hub 1.0 | core 包抽取完成；双模式设置成熟 |

---

## 十二、验收标准

### 12.1 Hub 0.1 发布门槛

- [ ] 至少 1 个集中库，Web 上传 100 张 PNG，全部有 thumb 且可筛选标签  
- [ ] OIDC 登录成功；未授权返回 401  
- [ ] viewer 无法删除资产；editor 无法管理成员  
- [ ] Pro 在未连接 Hub 时全量回归通过（导入/预览/本机 API v1）  
- [ ] `docker compose up` 30 分钟内可完成演示环境搭建（文档）

### 12.2 Hub 0.5 发布门槛

- [ ] Pro Worker 设备授权后，扩展保存图片到 Hub 集中库成功  
- [ ] 边缘库 catalog 资产在 Worker 在线时可 Web 预览原图；离线显示占位  
- [ ] 作品页视频 job 在 Pro Worker 执行，Web 可见进度与最终 video 资产  
- [ ] 同一 contentHash 重复导入遵守 duplicatePolicy  
- [ ] 审计日志可查到导入者与时间  

### 12.3 Hub 1.0 发布门槛

- [ ] K8s 双副本 Gateway 滚动升级无中断（<30s）  
- [ ] PG 备份恢复演练通过  
- [ ] 10 万资产集中库列表 P95 ≤ 500ms（压测报告）  

---

## 十三、风险与依赖

| 风险 | 影响 | 缓解 |
|------|------|------|
| 边缘库 Worker 长期离线 | Web 无法预览原文件 | thumb 同步策略 + 离线 UI |
| catalog 路径在多 Worker 间不一致 | 导入失败 | 绑定 NAS 旁唯一 Worker；路径校验 |
| EXR/3D Web 预览成本 | CPU/带宽 | 预渲染 + 缓存；限制并发 |
| Pro 与 Hub 双份逻辑 | 维护成本 | assetvault-core 抽取；CI 契约测试 |
| 扩展 Manifest 主机权限 | 无法连 Hub | 发布带 hub 域名的扩展包 |
| 团队期望「完全云端」 | 与边缘模型冲突 | PRD 明确 storageClass 选型指南 |

**外部依赖**：PostgreSQL、Redis、MinIO、OIDC IdP、（可选）Meilisearch、现有 ffmpeg/yt-dlp 运行时。

---

## 附录 A：Worker 能力矩阵

| capability | Pro Worker | Cloud Worker | Web 瘦客户端 |
|------------|:------------:|:--------------:|:--------------:|
| `import.upload` | ✓ | ✓ | ✓（发起） |
| `import.url` | ✓ | ✓ | ✓（发起） |
| `import.path` | ✓ | ✗ | ✗ |
| `import.fullpage` | ✓ | ✗ | ✗ |
| `import.article_bundle` | ✓ | ✗ | ✗ |
| `import.page_video` | ✓ | △ 可选 | ✗ |
| `thumb.image` | ✓ | ✓ | ✗ |
| `thumb.video` | ✓ | ✓ | ✗ |
| `thumb.exr` | ✓ | ✓ | ✗ |
| `thumb.3d` | ✓ | △ | ✗ |
| `thumb.font` | ✓ | ✓ | ✗ |
| `preview.exr.cache` | ✓ | ✓ | ✗ |
| `library.edge.sync` | ✓ | ✗ | ✗ |
| `catalog.read` | ✓ | ✗ | ✗ |

---

## 附录 B：与单机 Pro 功能对照

| 单机 Pro 功能 | Hub 0.1 | Hub 0.5 | 说明 |
|---------------|---------|---------|------|
| 文件夹/标签 | 集中库 ✓ | +边缘库 | |
| 本机路径导入 | Pro 本机 | Pro Worker | Web 不替代 |
| 本机 API v1 | 保留 | 保留 | 不冲突 |
| 整页截图会话 | Pro 本机 | Pro Worker job | |
| 作品页视频 | Pro 本机 | Pro Worker job | |
| EXR 全屏预览 | Pro 本机 | Web 缓存档 + Pro | |
| 3D 预览 | Pro 本机 | Web + 流式 URL | |
| AI Canvas | Pro 本机 | 不纳入 Hub V1 | 独立模块 |
| 资料库整库导入 LIM | Pro 本机 | Hub P2 | |
| allowRemote 单 token | 保留 | Hub 替代团队场景 | 单机远程仍可用 |

---

## 附录 C：术语表

| 术语 | 定义 |
|------|------|
| **Hub** | 团队控制面服务（API + Web Console + 调度） |
| **Pro 桌面** | Electron 单机产品，可离线 |
| **胖 Worker** | Pro 桌面 Worker Agent，全能力执行节点 |
| **瘦 Worker** | 浏览器侧上传与轻量操作，不跑重管线 |
| **集中库（cloud）** | 文件在 Hub 对象存储 |
| **边缘库（edge）** | 文件在 Pro/NAS，Hub 存索引 |
| **Job** | 异步任务单元，可查询进度 |
| **Worker 绑定** | Worker 与 edge 库的路径/权限关联 |

---

*文档版本：2026-06-05 · 评审后请更新状态为「已定稿」并拆分 OpenAPI / 开发计划子文档。*
