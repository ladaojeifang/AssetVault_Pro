# AssetVault Pro — 智能数字资产管理平台

## PRD 产品需求规格说明书 V1.0

> **版本**: V1.0  
> **日期**: 2026-05-14  
> **状态**: 初稿  
> **作者**: 产品团队  

---

## 目录

- [一、产品概述](#一产品概述)
  - [1.1 产品定位](#11-产品定位)
  - [1.2 产品愿景](#12-产品愿景)
  - [1.3 核心价值主张](#13-核心价值主张)
- [二、目标用户与场景](#二目标用户与场景)
  - [2.1 目标用户画像](#21-目标用户画像)
  - [2.2 使用场景](#22-使用场景)
- [三、核心功能规格](#三核心功能规格)
  - [3.1 功能总览](#31-功能总览)
  - [3.2 M01 资产引擎](#32-m01-资产引擎)
  - [3.3 M02 智能搜索](#33-m02-智能搜索)
  - [3.4 M03 AI 能力](#34-m03-ai-能力)
  - [3.5 M04 浏览器扩展](#35-m04-浏览器扩展)
  - [3.6 M05 设计软件插件](#36-m05-设计软件插件)
  - [3.7 M06 团队协作](#37-m06-团队协作)
  - [3.8 M07 资产市场](#38-m07-资产市场)
- [四、技术架构](#四技术架构)
  - [4.1 技术栈选型](#41-技术栈选型)
  - [4.2 系统架构图](#42-系统架构图)
  - [4.3 数据库设计](#43-数据库设计)
  - [4.4 可搬运库（Library Bundle）](#44-可搬运库library-bundle)
- [五、性能优化策略](#五性能优化策略)
  - [5.1 虚拟滚动引擎](#51-虚拟滚动引擎)
  - [5.2 三级缓存架构](#52-三级缓存架构)
  - [5.3 性能基准目标](#53-性能基准目标)
- [六、UI/UX 设计规范](#六uiux-设计规范)
  - [6.1 设计原则](#61-设计原则)
  - [6.2 界面布局](#62-界面布局)
  - [6.3 Design Token](#63-design-token)
- [七、开发路线图](#七开发路线图)
  - [7.1 版本规划](#71-版本规划)
  - [7.2 Phase 1 任务分解](#72-phase-1-任务分解)
- [八、非功能需求](#八非功能需求)
- [九、商业模式](#九商业模式)
  - [9.1 定价策略](#91-定价策略)
  - [9.2 收入增长策略](#92-收入增长策略)
- [十、风险评估与应对](#十风险评估与应对)
- [附录 A: 竞品对比分析](#附录-a-竞品对比分析)

---

## 一、产品概述

### 1.1 产品定位

**AssetVault Pro** 是一款面向设计师和创意团队的**本地优先智能数字资产管理平台**（Digital Asset Management, DAM），专注于图片/视频/字体/3D模型/设计源文件的统一存储、智能分类、高效检索和团队协作。

### 1.2 产品愿景

> 打造创意工作者的"第二大脑"——让每一份灵感资产都能被快速找到、智能复用、安全共享。

### 1.3 核心价值主张

| 维度 | 承诺 | 对标 |
|------|------|------|
| **极致性能** | 10万+资产秒级检索，流畅如本地文件管理器 | 超越 Eagle/Billfish |
| **隐私安全** | 本地优先架构，数据完全自主可控 | 区分于云端DAM |
| **AI 原生** | 自动标签、以图搜图、相似推荐 | 差异化竞争壁垒 |
| **生态集成** | 浏览器一键采集 + 设计软件原生插件 | 全链路闭环 |
| **跨平台** | Windows / macOS 双端同步体验 | 降低切换成本 |

---

## 二、目标用户与场景

### 2.1 目标用户画像

```
┌─────────────────────────────────────────────────────┐
│                    用户构成分布                        │
│                                                      │
│   ████████████████████████  个人创作者    ~60%        │
│   ██████████████          设计团队      ~30%        │
│   █████                  企业客户      ~10%        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

#### 用户画像 A：自由设计师 "小美"

| 属性 | 描述 |
|------|------|
| **年龄** | 25-32岁 |
| **职业** | UI/平面设计师、插画师 |
| **痛点** | 电脑里几万张素材找不到；从 Pinterest/Dribbble 收藏的图散落各处 |
| **诉求** | 一键采集 + AI自动整理 + 以图搜图 |
| **付费意愿** | 中等（￥200-400/年） |

#### 用户画像 B：设计团队负责人 "老张"

| 属性 | 描述 |
|------|------|
| **年龄** | 30-40岁 |
| **职业** | 设计总监/Team Lead |
| **痛点** | 团队资产版本混乱；新人入职无法快速上手品牌资产库 |
| **诉求** | 权限管理 + 资产评审 + 知识沉淀 |
| **付费意愿** | 高（按人头 ￥500-1000/人/年） |

#### 用户画像 C：中小企业 IT "王工"

| 属性 | 描述 |
|------|------|
| **年龄** | 28-38岁 |
| **职业** | 公司IT/运维，负责内部工具选型 |
| **痛点** | 需要私有化部署；担心云端泄露商业机密 |
| **诉求** | 本地部署 + 数据加密 + 审计日志 |
| **付费意愿** | 高（一次性授权或年费） |

### 2.2 使用场景

#### 场景 1：日常素材采集

```
浏览网页 → 点击扩展图标 → 选择文件夹 → 添加标签 → 一键入库
```

**用户故事**：作为设计师小美，我在浏览 Dribbble 时看到一张优秀的配色参考图，我希望点击浏览器扩展按钮就能将其保存到我的资产库中，并自动识别颜色标签。

**验收标准**：
- 支持右键菜单采集 / 拖拽采集 / 快捷键采集（⌘/Ctrl+Shift+S）
- 采集时可选择目标文件夹和预设标签
- 自动提取页面元信息（标题/来源URL/作者）
- 支持 PNG/JPG/SVG/GIF/WebP/MP4 等主流格式

#### 场景 2：项目资产管理

```
新建项目文件夹 → 导入相关资产 → 团队成员协同打标 → 定期归档
```

**用户故事**：作为设计负责人老张，我需要为"双十一大促项目"建立独立的资产空间，让团队成员可以上传各自的设计稿，并能按"主视觉/详情页/H5"等维度分类检索。

**验收标准**：
- 项目级文件夹结构支持嵌套（最大5层）
- 支持批量导入（拖拽文件夹/粘贴）
- 团队成员可添加/编辑标签（需权限控制）
- 支持资产版本历史记录

#### 场景 3：快速搜索复用

```
打开搜索框 → 输入关键词/颜色/图片 → 秒级返回结果 → 拖拽到设计软件
```

**用户故事**：作为设计师小美，我在做新方案时想找"去年做过的蓝色科技感背景"，我希望输入关键词后能在0.5秒内看到所有相关资产，还能用一张参考图搜出相似的素材。

**验收标准**：
- 关键词搜索响应 < 200ms（10万资产量级）
- 支持多条件组合筛选（类型/颜色/尺寸/日期/标签）
- 以图搜图返回结果 < 2s
- 搜索结果支持拖拽导出到 Figma/Ps/AE 等

---

## 三、核心功能规格

### 3.1 功能总览

| 模块编号 | 模块名称 | P0 核心功能 | P1 重要功能 | P2 锦上添花 |
|---------|----------|------------|------------|-------------|
| **M01** | 资产引擎 | 导入/预览/元数据管理 | 批量操作/格式转换 | 插件系统/API |
| **M02** | 智能搜索 | 关键词/筛选/排序 | 联想搜索/搜索历史 | 自然语言查询 |
| **M03** | AI 能力 | 自动标签(图像识别) | 以图搜图/智能去重 | 相似推荐/AIGC生成 |
| **M04** | 浏览器扩展 | 一键采集/右键保存 | 截图采集/整页保存 | 批量抓取 |
| **M05** | 设计插件 | Ps/Figma面板集成 | AE/Sketch插件 | Blender/ZBrush |
| **M06** | 团队协作 | 共享文件夹/权限RBAC | 评论@提及/活动流 | 审批流程/水印 |
| **M07** | 资产市场 | 浏览/下载免费资源 | 上传分享/积分系统 | 付费交易/授权管理 |

---

### 3.2 M01 资产引擎

#### 功能描述

资产的"心脏模块"，负责文件的导入、解析、存储、预览和管理全生命周期。

#### 核心需求

| 编号 | 需求描述 | 优先级 | 验收标准 |
|------|----------|--------|----------|
| F01-001 | 支持拖拽/粘贴/文件夹导入多种方式导入资产 | P0 | 支持单次导入1000+文件不卡顿 |
| F01-002 | 内置缩略图/视频帧/字体预览/代码高亮等多格式预览 | P0 | 图片<100ms出缩略图；视频取首帧<500ms |
| F01-003 | 自动提取并持久化EXIF/IPTC/色彩/尺寸等元数据 | P0 | 导入时自动提取，支持手动编辑 |
| F01-004 | 文件夹树形结构管理（支持5层嵌套） | P0 | 支持拖拽移动/重命名/新建/删除 |
| F01-005 | 批量操作（选择/移动/删除/打标签/导出） | P1 | 支持全选/范围选/Ctrl点选 |
| F01-006 | 格式转换（PNG↔JPG/WebP, 视频转GIF） | P1 | 后台队列执行，通知结果 |
| F01-007 | 外部存储挂载（NAS/云盘虚拟目录） | P2 | 只读映射，索引不复制 |
| F01-008 | **可搬运库**：库根目录内含索引库 + 每条目子目录及 `meta.json`，整库拷贝即可迁移 | P0 | 见 [4.4 可搬运库（Library Bundle）](#44-可搬运库library-bundle)；`file_path` / `thumbnail_path` 相对库根；关闭应用后复制根目录在新环境可打开 |

#### 支持格式清单

| 类别 | 格式 |
|------|------|
| 图片 | JPG, PNG, GIF, WebP, SVG, BMP, ICO, TIFF, HEIC, RAW (CR2/NEF/ARW) |
| 视频 | MP4, MOV, AVI, MKV, WebM, GIF (动画) |
| 音频 | MP3, WAV, FLAC, AAC, OGG |
| 字体 | TTF, OTF, WOFF, WOFF2 |
| 设计 | PSD, AI, Sketch, Figma (.fig), XD, PDF, EPS |
| 文档 | DOCX, XLSX, PPTX, MD, TXT, CSV |
| 3D | FBX, OBJ, GLB/GLTF, STL |
| 代码 | JS, TS, PY, HTML, CSS, JSON, YAML (语法高亮预览) |
| other | 其它格式 |


---

### 3.3 M02 智能搜索

#### 功能描述

基于全文索引+向量检索+元数据过滤的混合搜索引擎，是产品的核心差异化能力之一。

#### 核心需求

| 编号 | 需求描述 | 优先级 | 验收标准 |
|------|----------|--------|----------|
| F02-001 | 全文模糊搜索（文件名/标签/备注/自定义字段） | P0 | 输入即搜，防抖300ms，结果<200ms |
| F02-002 | 多维筛选器（类型/文件夹/颜色/尺寸/日期/标签） | P0 | 筛选组合即时生效，无刷新 |
| F02-003 | 排序选项（时间/名称/尺寸/颜色/使用频率/随机） | P0 | 切换排序<100ms重绘列表 |
| F02-004 | 搜索联想/历史记录/热门搜索 | P1 | 下拉展示最多8条建议 |
| F02-005 | 保存常用搜索条件为"智能文件夹" | P1 | 条件变更自动更新内容 |
| F02-006 | 自然语言搜索（"上周下载的蓝色渐变背景图大于1920"） | P2 | LLM解析→结构化查询 |

#### 搜索架构

```
用户输入 → 分词器 → ┬─ 全文索引 (FTS5)     → 布尔匹配
                         │
                         ├─ 向量索引 (Embedding) → 语义相似度
                         │
                         └─ 元数据索引 (B-tree)   → 结构化过滤
                            ↓
                      结果融合 (RRF) → 排序 → 分页 → 渲染
```

---

### 3.4 M03 AI 能力

#### 功能描述

利用本地/混合AI模型提供智能标注、以图搜图、相似度计算等增值服务。**隐私优先策略**：默认本地推理，敏感数据不上传。

#### 核心需求

| 编号 | 需求描述 | 优先级 | 验收标准 |
|------|----------|--------|----------|
| F03-001 | 图像自动标签（物体/场景/风格/情绪） | P0 | 准确率>85%，每张<500ms |
| F03-002 | 主色调提取（Top 5 色值 + 占比） | P0 | 与ColorThief误差<5% |
| F03-003 | 以图搜图（上传/粘贴图片找相似资产） | P1 | Top-10召回率>90%，延迟<2s |
| F03-004 | 智能去重（感知哈希 + 特征相似度双重判定） | P1 | 可配置相似度阈值(60%-99%) |
| F03-005 | 相似推荐（"你可能还喜欢…"） | P2 | 基于当前选中资产实时推荐 |

#### AI 技术方案

| 能力 | 模型选择 | 部署方式 | 备注 |
|------|----------|----------|------|
| 图像分类标签 | EfficientNet-Lite / MobileNetV3 | 本地 ONNX Runtime | ~20MB模型，CPU即可 |
| 色彩提取 | K-Means聚类 (OpenCV) | 本地 | 无需ML框架 |
| 图像特征向量 | CLIP-ViT-B/32 | 本地(轻量) 或 API(高质量) | 300MB vs API调用 |
| 感知哈希去重 | pHash + dHash + aHash | 本地纯算法 | 毫秒级 |
| NL2SQL | GPT-4o-mini / Qwen | API调用 | 用户可选启用 |

---

### 3.5 M04 浏览器扩展

#### 功能描述

Chrome/Firefox/Edge 浏览器扩展，实现网页内容的无缝采集。

#### 核心需求

| 编号 | 需求描述 | 优先级 | 验收标准 |
|------|----------|--------|----------|
| F04-001 | 工具栏按钮一键采集当前页面图片/视频 | P0 | 点击弹出采集面板，可勾选媒体 |
| F04-002 | 右键菜单"Save to AssetVault" | P0 | 支持图片/链接/选中区域 |
| F04-003 | 采集预设（默认文件夹+自动标签规则） | P0 | 可按域名配置不同规则 |
| F04-004 | 自动携带来源URL和页面标题为元数据 | P0 | 存入 source_url / page_title 字段 |
| F04-005 | 可视化截图/区域截图采集 | P1 | 类似FireShot的功能 |
| F04-006 | 整页长图/完整网页保存为图片 | P1 | 滚动拼接，保留链接热区 |
| F04-007 | 批量抓取（指定站点的全部图片） | P2 | 需配合规则配置，防滥用 |

#### 支持浏览器

| 浏览器 | 最低版本 | Manifest |
|--------|----------|----------|
| Google Chrome | 88+ | V3 |
| Microsoft Edge | 88+ | V3 |
| Firefox | 109+ | V2/V3 |
| Brave | 88+ | V3 |
| Arc | 最新 | 兼容Chrome |

---

### 3.6 M05 设计软件插件

#### 功能描述

在主流设计工具中嵌入 AssetVault 面板，实现"边设计边调用资产"的无缝工作流。

#### 核心需求

| 编号 | 需求描述 | 优先级 | 验收标准 |
|------|----------|--------|----------|
| F05-001 | Adobe Photoshop 扩展面板 (CEP/UXP) | P0 | 搜索→拖入画布，支持智能对象 |
| F05-002 | Figma 插件 (Figma Plugin API) | P0 | 搜索→插入，支持组件发布 |
| F05-003 | 拖拽资产直接放入画布/时间轴 | P0 | 根据目标格式自动转换 |
| F05-004 | 从设计软件反向入库（选中图层→保存到库） | P1 | 保留图层名/组结构 |
| F05-005 | After Effects 插件 (ScriptUI Panel) | P1 | 搜索素材→拖入合成 |
| F05-006 | Sketch 插件 (sketch/plugin) | P1 | macOS 专属 |

#### 插件适配计划

```
Phase 1 (V1.0)  ─── Photoshop + Figma
Phase 2 (V1.1)  ─── After Effects + Sketch
Phase 3 (V1.2)  ─── Illustrator + Blender + CDN直链API
```

---

### 3.7 M06 团队协作

#### 功能描述

多用户环境下的资产共享、权限管理和协作沟通能力。

#### 核心需求

| 编号 | 需求描述 | 优先级 | 验收标准 |
|------|----------|--------|----------|
| F06-001 | 团队工作区创建与成员邀请 | P0 | 邮箱邀请/链接邀请/二维码 |
| F06-002 | RBAC 权限模型（管理员/编辑者/查看者/访客） | P0 | 细粒度到单个文件夹级别 |
| F06-003 | 共享文件夹（含只读/可编辑模式） | P0 | 实时同步，冲突检测 |
| F06-004 | 资产评论与@提及通知 | P1 | 邮件/应用内双通道通知 |
| F06-005 | 活动日志（谁在什么时候做了什么） | P1 | 可导出审计报告 |
| F06-006 | 审批流程（资产上传需审核后才可见） | P2 | 自定义审批链 |
| F06-007 | 自动水印（预览图叠加用户标识） | P2 | 防止外泄截屏 |

#### RBAC 权限矩阵

| 操作 | 管理员 | 编辑者 | 查看者 | 访客 |
|------|--------|--------|--------|------|
| 查看资产 | ✅ | ✅ | ✅ | 仅公开 |
| 下载原始文件 | ✅ | ✅ | ✅ | ❌ |
| 上传/导入 | ✅ | ✅ | ❌ | ❌ |
| 编辑元数据/标签 | ✅ | ✅ | ❌ | ❌ |
| 删除资产 | ✅ | ❌ | ❌ | ❌ |
| 管理成员 | ✅ | ❌ | ❌ | ❌ |
| 管理文件夹 | ✅ | ❌ | ❌ | ❌ |
| 导出数据 | ✅ | ✅(部分) | ❌ | ❌ |

---

### 3.8 M07 资产市场

#### 功能描述

内置的资源交易与共享社区，连接资产供给方与需求方，形成生态闭环。

#### 核心需求

| 编号 | 需求描述 | 优先级 | 验收标准 |
|------|----------|--------|----------|
| F07-001 | 浏览/搜索/筛选市场资源 | P0 | 分类/关键词/价格/评分筛选 |
| F07-002 | 一键下载到个人资产库 | P0 | 保留原作者署名信息 |
| F07-003 | 用户上传自有资源（设置免费/付费） | P1 | 审核机制 + 版权声明 |
| F07-004 | 积分/虚拟货币体系 | P1 | 上传赚积分，下载花积分 |
| F07-005 | 资源评分与评论系统 | P1 | 5星评分 + 文字评论 |
| F07-006 | 付费资源交易（支付宝/微信支付） | P2 | 平台抽成 15%-30% |
| F07-007 | 商用授权管理（标准/扩展/独家） | P2 | 自动生成授权证书 |

---

## 四、技术架构

### 4.1 技术栈选型

| 层 | 技术选型 | 理由 |
|----|----------|------|
| **桌面壳** | Electron 28+ (Tauri 2.0 as Plan B) | 成熟生态/跨平台/热更新 |
| **前端框架** | React 18 + TypeScript 5 | 组件化/类型安全/生态丰富 |
| **状态管理** | Zustand + React Query | 轻量/异步友好 |
| **UI 库** | TailwindCSS + Radix UI + Arco Design | 原子化/无障碍/企业级 |
| **数据库** | SQLite (better-sqlite3) + FTS5 | 本地零配置/全文检索内置 |
| **ORM** | Drizzle ORM | 类型安全/轻量/SQLite友好 |
| **AI 推理** | ONNX Runtime (本地) + OpenAI API (云端) | 混合部署策略 |
| **图像处理** | Sharp (Node) / @napi-rs/image | 高性能C++底层 |
| **文件监听** | chokidar | 跨平台可靠 |
| **构建工具** | Vite + electron-builder | 极速HMR/打包成熟 |
| **国际化** | i18next | 多语言支持 |
| **测试** | Vitest + Playwright | 单元+E2E全覆盖 |

### 4.2 系统架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Electron Main Process                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ IPC Handler│  │ Auto Updater│  │ File Watcher │  │ Task Queue       │   │
│  └────┬─────┘  └──────────┘  └──────────┘  └──────┬───────────┘   │
│       │                                          │                   │
│  ┌────▼──────────────────────────────────────────▼───────────────┐  │
│  │                    Core Service Layer                          │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │  │
│  │  │Asset Service│  │Search Engine│  │Tag Manager  │  │AI Inference  │  │  │
│  │  └────┬─────┘  └────┬─────┘  └──────────┘  └──────┬───────┘  │  │
│  └───────┼──────────────┼────────────────────────────┼───────────┘  │
│          │              │                            │               │
│  ┌───────▼──────────────▼────────────────────────────▼───────────┐  │
│  │                    Data Access Layer                           │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                   │  │
│  │  │ SQLite + FTS5     │  │ Vector Store ( hnswlib) │            │  │
│  │  └──────────────────┘  └──────────────────┘                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌──────────────┐  ┌──────────────────┐
│ Renderer Process│  │ Browser Ext  │  │ Design Plugins    │
│  (React SPA)    │  │ (Chrome/Fx)  │  │ (Ps/Figma/AE)    │
└─────────────────┘  └──────────────┘  └──────────────────┘
```

### 4.3 数据库设计

#### ER 关系

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   folders    │──1:N──│    assets    │──N:M──│     tags     │
├──────────────┤       ├──────────────┤       ├──────────────┤
│ id (PK)      │       │ id (PK)      │       │ id (PK)      │
│ name         │       │ folder_id(FK)│       │ name         │
│ parent_id    │       │ file_name    │       │ color        │
│ path         │       │ file_path    │       └──────────────┘
│ created_at   │       │ file_size    │              │
│ sort_order   │       │ mime_type    │       ┌──────────────┐
└──────────────┘       │ width        │       │ asset_tags   │
                       │ height       │       ├──────────────┤
                       │ duration     │       │ asset_id (FK)│
                       │ color_hex    │       │ tag_id (FK)  │
                       │ thumbnail    │       │ confidence   │
                       │ source_url   │       │ source (AI/  │
                       │ description  │       │   manual)    │
                       │ created_at   │       └──────────────┘
                       │ updated_at   │
                       └──────────────┘
```

#### SQL Schema (可直接执行)

```sql
-- ============================================================
-- AssetVault Pro Database Schema v1.0
-- ============================================================

-- 文件夹表
CREATE TABLE IF NOT EXISTS folders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL DEFAULT '',
    parent_id   INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    path        TEXT    NOT NULL UNIQUE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    sort_order  INTEGER NOT NULL DEFAULT 0
);

-- 资产主表
CREATE TABLE IF NOT EXISTS assets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id   INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    file_name   TEXT    NOT NULL,
    file_path   TEXT    NOT NULL UNIQUE,
    file_size   INTEGER NOT NULL DEFAULT 0,
    mime_type   TEXT    NOT NULL DEFAULT '',
    width       INTEGER,
    height      INTEGER,
    duration    REAL,           -- 视频/音频时长(秒)
    color_hex   TEXT    DEFAULT '',  -- 主色调 #RRGGBB
    thumbnail   BLOB,            -- 缩略图二进制
    source_url  TEXT    DEFAULT '',  -- 来源URL
    description TEXT    DEFAULT '',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    color       TEXT    NOT NULL DEFAULT '#6C8EBF'
);

-- 资产-标签关联表
CREATE TABLE IF NOT EXISTS asset_tags (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id    INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    confidence  REAL    NOT NULL DEFAULT 1.0,  -- AI标签置信度
    source      TEXT    NOT NULL DEFAULT 'manual',  -- 'ai' | 'manual'
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE(asset_id, tag_id)
);

-- 全文搜索虚拟表 (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS assets_fts USING fts5(
    file_name,
    description,
    source_url,
    content='assets',
    content_rowid='id',
    tokenize='porter unicode61'  -- 英文词干+中文分词
);

-- 触发器：保持FTS与主表同步
CREATE TRIGGER IF NOT EXISTS assets_ai AFTER INSERT ON assets BEGIN
    INSERT INTO assets_fts(rowid, file_name, description, source_url)
    VALUES (new.id, new.file_name, new.description, new.source_url);
END;

CREATE TRIGGER IF NOT EXISTS assets_ad AFTER DELETE ON assets BEGIN
    INSERT INTO assets_fts(assets_fts, rowid, file_name, description, source_url)
    VALUES ('delete', old.id, old.file_name, old.description, old.source_url);
END;

CREATE TRIGGER IF NOT EXISTS assets_au AFTER UPDATE ON assets BEGIN
    INSERT INTO assets_fts(assets_fts, rowid, file_name, description, source_url)
    VALUES ('delete', old.id, old.file_name, old.description, old.source_url);
    INSERT INTO assets_fts(rowid, file_name, description, source_url)
    VALUES (new.id, new.file_name, new.description, new.source_url);
END;

-- ==================== 性能索引 ====================
CREATE INDEX IF NOT EXISTS idx_assets_folder_id   ON assets(folder_id);
CREATE INDEX IF NOT EXISTS idx_assets_created_at   ON assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_mime_type    ON assets(mime_type);
CREATE INDEX IF NOT EXISTS idx_asset_tags_asset_id  ON asset_tags(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_tags_tag_id    ON asset_tags(tag_id);
```

### 4.4 可搬运库（Library Bundle）

对标 Eagle 等工具的「**整库目录拷走即可带走**」体验：库根为唯一数据边界，**不依赖**单文件 `.eaglepack` 亦可完成备份与迁移。本规格采用 **SQLite（权威索引）+ 每条目独立子目录 + `meta.json`（侧车元数据）**。

> **实现说明**：下列 `meta.json` 字段与落地代码中的 Drizzle `schema` 对齐；上文「SQL Schema」示例若与实现有出入，以代码库 `src/main/db/schema.ts` 为准。

#### 4.4.1 设计原则

| 原则 | 说明 |
|------|------|
| 库根即产品边界 | 用户指定的根目录（可选用 `*.library` 风格文件夹名便于识别，本质为普通目录）内包含本库全部用户资产与索引。 |
| SQLite 为查询权威 | 列表、筛选、全文/辅助检索、关系统计以库内 SQLite 为准，保证事务与性能。 |
| `meta.json` 为可搬运侧车 | 每条资产一份可读元数据；支持运维排查；**DB 损坏时**可基于 `items/**/meta.json` + 原始文件做索引重建（恢复策略可分期实现）。 |
| 路径相对库根 | `assets.file_path`、`assets.thumbnail_path` 及 `meta.json` 内文件引用均使用**相对库根**的路径（建议 POSIX 风格 `items/{id}/...`），禁止将「库外绝对路径」作为唯一真相。 |

#### 4.4.2 库根目录结构

```text
{LibraryRoot}/
  manifest.json              # 格式版本、库标识、展示名等
  library.sqlite             # 主索引（固定文件名，便于工具发现）
  library.sqlite-wal         # WAL（存在时：迁移前宜正常退出应用以合并/减少残留）
  library.sqlite-shm
  items/
    {assetId}/               # assetId 与 assets.id 一致（建议 UUID）
      meta.json              # 本条侧车元数据
      original.{ext}         # 磁盘稳定名；ext 小写无点，见下
      thumb.webp             # 或与实现一致的缩略图扩展名
  _staging/                  # 可选：导入原子写临时区
  trash/                     # 可选：软删除隔离区
```

可选：`settings.local.json`（仅本机 UI/开关）若置于库根，须在 manifest 或文档中标明**不属于「可搬运承诺」的必备部分**。

#### 4.4.3 `manifest.json`（库根）

| 字段 | 类型 | 说明 |
|------|------|------|
| `formatVersion` | string | 如 `"1.0"`，用于迁移与兼容分支 |
| `appId` | string | 产品标识，如 `com.assetvault.library` |
| `minAppVersion` | string | 能打开此库的最低应用版本 |
| `libraryId` | string | 库 UUID，创建时生成，**不随目录搬迁而改变** |
| `displayName` | string | 展示名 |
| `createdAt` / `updatedAt` | string | ISO8601 或 unix 毫秒，全库统一一种 |
| `schemaHash` | string | 可选：侧车/schema 兼容性校验 |

#### 4.4.4 条目目录 `items/{assetId}/`

- **目录名**必须与 `assets.id` 完全一致，禁止仅靠重命名文件夹推断 id。
- **原始文件磁盘名**：推荐 `original.{extension}`（`extension` 小写、不含点），避免跨文件系统特殊字符问题；逻辑展示名仍存于 DB / `meta.json` 的 `originalName`、`filename`。
- **缩略图**：固定文件名（如 `thumb.webp`），与 `thumbnail_path` 相对路径一致。

#### 4.4.5 `meta.json` 字段（与 assets 表对应）

| 键 | 说明 |
|----|------|
| `id` | 与目录名、`assets.id` 一致 |
| `metaVersion` | 本侧车格式版本，如 `1` |
| `originalName` / `filename` | 对应 `original_name`、`filename` |
| `extension` / `mimeType` / `fileType` | 对应 `extension`、`mime_type`、`file_type` |
| `folderId` | 对应 `folder_id`，可为 null |
| `fileSize` | 字节 |
| `width` / `height` / `duration` | 与表一致 |
| `dominantColor` / `colors` | 与表一致（`colors` 可为 JSON 数组或表结构约定的序列化形式） |
| `metadata` | EXIF/IPTC 等 JSON 字符串 |
| `notes` | 用户备注 |
| `fileCreatedAt` / `fileModifiedAt` / `importedAt` / `updatedAt` | 与表一致；**时间戳单位全库统一**（秒或毫秒） |
| `tags` | 建议 `{"id","name"}[]` 或仅 `id[]`（以 DB `tags` 为名称权威时） |
| `sourceUrl` | 若业务有来源 URL，建议独立键便于交换与排查 |
| `paths` | 对象：`original`、`thumb` 等键，值为**相对 `LibraryRoot` 的路径** |

不必写入 `meta.json` 的可再生数据：如仅用于检索的派生表内容（实现期按需裁剪）。

#### 4.4.6 文件夹树

文件夹层级仍在 SQLite `folders` 表维护即可；**不必**在每个 `meta.json` 中重复整树。可选提供根级 **`folders.snapshot.json`**（由 DB 导出，**非权威**），供只读浏览或第三方工具使用。

#### 4.4.7 写入顺序与一致性（验收关注点）

1. **创建/导入单条**：推荐顺序为落盘 `original`（及缩略图）→ 写入 `meta.json` → 再提交 SQLite；失败时需清理孤儿文件并明确错误态。若项目统一为「先 DB 后文件」，须在规格与测试中固定该顺序并承担崩溃恢复责任。
2. **更新元数据**（标签、备注等）：以 SQLite 为准；成功后更新或异步重试写入 `meta.json`，避免长期 DB 与侧车不一致。
3. **删除**：软删除可移至 `trash/{id}/`；硬删除须同步删除 `items/{id}/` 与 DB 行，**顺序须在实现中统一并测试**。

#### 4.4.8 打开库与校验

- 合法库根至少包含 `manifest.json` 与 `library.sqlite`。
- 启动或「打开库」时可选用：抽样或全量核对 `items/*/meta.json` 与 DB 中路径、大小、文件存在性。
- **恢复模式**（分期）：DB 缺失或损坏时，扫描 `items/**/meta.json` 触发索引重建向导。

#### 4.4.9 与单文件导出包的关系

| 能力 | 说明 |
|------|------|
| 目录库（本节） | 日常存储与「整文件夹备份/迁移」的主形态。 |
| 单文件包（如未来 `.avpack` / ZIP） | 可选增值：子集分享、社区下载；**不替代**本节可搬运性承诺。 |

---

## 五、性能优化策略

### 5.1 虚拟滚动引擎

面对10万+资产列表，传统 DOM 渲染必然崩溃。采用**虚拟滚动（Virtual Scrolling）**仅渲染可视区域内的元素：

```
传统渲染 (100,000 items):
  DOM节点数 = 100,000  → 内存爆炸 → FPS掉到个位数

虚拟滚动:
  可视区域高度 = 600px
  每项高度 = 180px
  可视项数 ≈ 600/180 + 缓冲(5) ≈ 8-10 个DOM节点
  滚动时动态替换内容 → 内存恒定 → 55+ FPS
```

**实现要点**：

| 技术 | 方案 |
|------|------|
| 滚动库 | `@tanstack/react-virtual` (动态高度支持) |
| 占位估算 | 平均高度预测 + 动态校正 |
| 滚动锚点 | key复用策略避免闪烁 |
| 预加载 | 上下各预渲染3项（缓冲带） |

**性能对比**：

```
资产数量    传统渲染FPS    虚拟滚动FPS    内存占用差异
─────────   ─────────    ──────────    ────────────
1,000       45 FPS       60 FPS        -40%
10,000      15 FPS       60 FPS        -75%
50,000      5 FPS        58 FPS        -88%
100,000     2 FPS        55 FPS        -92%
```

### 5.2 三级缓存架构

```
┌─────────────────────────────────────────────────────────┐
│                     三级缓存架构                          │
│                                                         │
│  Level 1: 内存缓存 (In-Memory)                          │
│  ├── 缩略图 (最近 500 张, LRU淘汰)                       │
│  ├── 搜索结果 (最近 20 组, TTL=5min)                     │
│  └── 标签/文件夹元数据 (全量, 变更时更新)                  │
│    ↑↓ 命中率 ~70%                                       │
│                                                         │
│  Level 2: 磁盘缓存 (Disk Cache)                         │
│  ├── 已处理缩略图 (~AppData/.thumbnails/)                │
│  ├── AI特征向量 (~AppData/.vectors/)                     │
│  └── FTS索引文件 (~SQLite db文件)                        │
│    ↑↓ 命中率 ~25%                                       │
│                                                         │
│  Level 3: 原始文件 (Original Files)                     │
│  ├── 用户磁盘上的实际文件                                 │
│  └── 仅在L1/L2均未命中时读取                             │
│    ↑↓ 命中率 ~5%                                        │
│                                                         │
│  总命中率 >95%, 绝大多数请求无需触碰原始文件              │
└─────────────────────────────────────────────────────────┘
```

### 5.3 其他性能策略

| 策略 | 说明 |
|------|------|
| **异步任务队列** | 导入/转码/AI推理等耗时操作丢入后台 Bull 队列，UI 不阻塞 |
| **图片处理流水线** | 使用 libvips / Sharp 的流水线API，避免多次编解码 |
| **懒加载 + 预取** | 缩略图进入可视区才加载；根据滚动方向预取下一屏 |
| **Web Workers** | 搜索排序/向量计算等 CPU 密集任务移至 Worker 线程 |
| **SQLite WAL模式** | 并发读写不锁库，允许读者和写者同时操作 |
| **增量同步** | 文件变更通过 chokidar 监听，仅重新处理变化的部分 |

### 5.4 性能基准目标

| 指标 | 目标值 | 测量方法 | 优先级 |
|------|--------|----------|--------|
| 冷启动时间 | < 2 秒 | 从双击图标到可用状态 | P0 |
| 资产导入速度 | > 500 文件/秒 | 批量导入1000张JPG计时 | P0 |
| 搜索响应时间 | < 200ms | 10万资产全文搜索 P50 | P0 |
| 缩略图加载 | < 100ms | 已缓存状态下 | P0 |
| 列表滚动帧率 | ≥ 55 FPS | 1万资产网格视图滚动 | P0 |
| 以图搜图 | < 2 秒 | 返回Top-20结果 | P1 |
| AI自动标签 | < 500ms/张 | 单张图片端到端 | P1 |
| 内存占用(@10万资产) | < 512 MB | Windows任务管理器常驻内存 | P1 |
| 安装包大小 | < 150 MB | Electron打包后体积 | P1 |
| 首次索引(1万资产) | < 3 分钟 | 含缩略图生成+元数据提取 | P2 |

---

## 六、UI/UX 设计规范

### 6.1 设计原则

| # | 原则 | 说明 |
|---|------|------|
| 1 | **Content First** | 内容为王，界面尽可能隐形，最大化内容展示面积 |
| 2 | **Speed Perception** | 交互反馈<100ms；Skeleton屏替代Loading圈 |
| 3 | **Keyboard First** | 所有核心操作可通过键盘完成（Vim风格快捷键可选） |
| 4 | **Dark Mode Native** | 深色主题为默认，符合设计师工作习惯 |
| 5 | **Progressive Disclosure** | 信息分层展示，常用功能一步到达，高级功能按需展开 |

### 6.2 界面布局

```
┌──────────────────────────────────────────────────────────────────────┐
│  ┌─ Menu Bar ──────────────────────────────────────────────────────┐ │
│  │  File  Edit  View  Tag  AI  Tools  Window  Help                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─ Toolbar ───────────────────────────────────────────────────────┐ │
│  │  🔍 Search...    [Import] [Folder+] [View:Grid] [Sort]  ⚙️      │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─── Sidebar ───┐  ┌──────── Main Content Area ──────────────────┐  │
│  │                │  │                                              │  │
│  │  📁 Libraries  │  │  ┌─ Filter Bar ──────────────────────────┐  │  │
│  │   📂 My Assets│  │  │ Type ▼ | Color ◉ | Size ▼ | Date ▼   │  │  │
│  │   📂 Team Work│  │  └───────────────────────────────────────┘  │  │
│  │   📂 Archive  │  │                                              │  │
│  │                │  │  ┌─ Asset Grid (Virtual Scroll) ─────────┐  │  │
│  │  🏷️ Tags      │  │  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐         │  │  │
│  │   #ui-design  │  │  │ │ 🖼️ │ │ 🖼️ │ │ 🖼️ │ │ 🖼️ │         │  │  │
│  │   #mockup    │  │  │ │name│ │name│ │name│ │name│         │  │  │
│  │   #branding  │  │  │ └────┘ └────┘ └────┘ └────┘         │  │  │
│  │                │  │  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐         │  │  │
│  │  🔴 Colors    │  │  │ │ 🖼️ │ │ 🖼️ │ │ 🖼️ │ │ 🖼️ │         │  │  │
│  │   ● #3B82F6  │  │  │ └────┘ └────┘ └────┘ └────┘         │  │  │
│  │   ● #10B981  │  │  │         ... more ...                 │  │  │
│  │                │  │  └───────────────────────────────────────┘  │  │
│  │  📅 Dates     │  │                                              │  │
│  │   Today       │  │  1,234 assets · selected: 3                  │  │
│  │   This Week   │  │                                              │  │
│  │                │  └──────────────────────────────────────────────┘  │
│  └────────────────┘                                                    │
│                                                                        │
│  ┌─ Status Bar ─────────────────────────────────────────────────────┐ │
│  │  1,234 assets · 12.3 GB · Synced · AI: 89% tagged  · v1.0.0     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.3 Design Token

```json
{
  "color": {
    "primary": {
      "50": "#EFF6FF",
      "100": "#DBEAFE",
      "500": "#3B82F6",
      "600": "#2563EB",
      "700": "#1D4ED8"
    },
    "bg": {
      "primary": "#0F1117",
      "secondary": "#1A1D26",
      "tertiary": "#242832",
      "elevated": "#2A2F3A"
    },
    "text": {
      "primary": "#F1F5F9",
      "secondary": "#94A3B8",
      "muted": "#64748B"
    },
    "accent": {
      "blue": "#3B82F6",
      "green": "#10B981",
      "amber": "#F59E0B",
      "red": "#EF4444"
    }
  },
  "typography": {
    "fontFamily": {
      "sans": "'Inter', -apple-system, 'Segoe UI', sans-serif",
      "mono": "'JetBrains Mono', 'Fira Code', monospace"
    },
    "fontSize": {
      "xs": "12px",
      "sm": "13px",
      "base": "14px",
      "lg": "16px",
      "xl": "18px",
      "2xl": "24px"
    },
    "lineHeight": {
      "tight": "1.25",
      "normal": "1.5",
      "relaxed": "1.75"
    }
  },
  "spacing": {
    "xs": "4px",
    "sm": "8px",
    "md": "16px",
    "lg": "24px",
    "xl": "32px",
    "2xl": "48px"
  },
  "radius": {
    "sm": "6px",
    "md": "8px",
    "lg": "12px",
    "xl": "16px",
    "full": "9999px"
  },
  "shadow": {
    "sm": "0 1px 2px rgba(0,0,0,0.3)",
    "md": "0 4px 6px rgba(0,0,0,0.4)",
    "lg": "0 10px 15px rgba(0,0,0,0.5)"
  }
}
```

### 6.4 交互规范

| 操作 | 快捷键 (Win) | 快捷键 (Mac) | 说明 |
|------|-------------|-------------|------|
| 全局搜索 | `Ctrl+K` | `⌘+K` | 打开命令面板/搜索框 |
| 快速导入 | `Ctrl+I` | `⌘+I` | 打开文件选择对话框 |
| 新建文件夹 | `Ctrl+Shift+N` | `⌘+Shift+N` | 在当前位置创建 |
| 删除 | `Delete` | `Delete` | 移入回收站 |
| 全选 | `Ctrl+A` | `⌘+A` | 当前视图全选 |
| 复制 | `Ctrl+C` | `⌘+C` | 复制资产（非文件） |
| 网格/列表切换 | `Ctrl+G` | `⌘+G` | 切换视图模式 |
| 详情面板 | `Ctrl+Space` | `⌘+Space` | 显示/隐藏右侧详情 |
| AI打标签 | `Ctrl+Shift+A` | `⌘+Shift+A` | 对选中项运行AI标注 |
| Dark/Light | `Ctrl+Shift+D` | `⌘+Shift+D` | 切换主题 |

---

## 七、开发路线图

### 7.1 版本规划

```
V0.5 Alpha          V1.0 GA             V1.1              V1.2
  │                   │                   │                  │
  ├── MVP核心         ├── 完善+商业化     ├── AI强化         ├── 生态扩张
  │                   │                   │                  │
  · 资产导入/预览      · 浏览器扩展GA      · 以图搜图GA       · AE/Sketch插件
  · 基础搜索          · Ps/Figma插件V1    · 智能去重          · 资产市场Beta
  · 文件夹管理        · 团队协作基础      · 自然语言搜索      · API开放平台
  · 手动标签          · AI自动标签V1      · 性能调优          · 移动端伴侣App
  · 单用户            · Windows/macOS     · 更多格式支持       · 企业SSO
  · Windows only      · 付费版上线        ·                  │
```

#### 详细版本规划表

| 版本 | 时间 | 目标 | 核心功能 | 状态 |
|------|------|------|----------|------|
| **V0.5 Alpha** | M1-M2 | 内部验证 | 单机导入/预览/搜索/标签/Windows | 🔄 规划 |
| **V0.8 Beta** | M3-M4 | 封闭测试 | Mac支持/浏览器扩展/初步AI/小规模试用 | 📋 待定 |
| **V1.0 GA** | M5-M6 | 正式发布 | Ps+Figma插件/团队协作/付费版/双语 | 📋 待定 |
| **V1.1** | M7-M8 | AI升级 | 以图搜图/NL搜索/去重/更多插件 | 📋 待定 |
| **V1.2** | M9-M12 | 生态 | 资产市场/API平台/移动伴侣 | 📋 待定 |

### 7.2 Phase 1 (V0.5) 任务分解

```
Week 1-2:  项目初始化 + 基础设施
  └── Electron脚手架搭建 / SQLite DB初始化 / 基础UI框架 / CI/CD

Week 3-4:  资产引擎 Core
  └── 文件导入pipeline / 缩略图生成 / 元数据提取 / 文件夹CRUD

Week 5-6:  搜索 + 浏览
  └── FTS5全文搜索 / 筛选器 / 排序 / 网格+列表视图 / 虚拟滚动

Week 7-8:  标签系统 + 打磨
  └── 标签CRUD / 批量打标签 / 拖拽排序 / 键盘快捷键 / Alpha测试
```

#### 推荐团队配置 (Phase 1)

| 角色 | 人数 | 职责 |
|------|------|------|
| 产品经理 | 1 | PRD/需求/优先级/用户体验 |
| 全栈工程师 × 2 | 2 | Electron主进程 + React渲染进程 |
| AI工程师 | 1 | 模型选型/训练/推理优化 |
| UI Designer | 1 | 视觉规范/组件库/设计走查 |
| QA Engineer | 1 | 测试用例/自动化/性能测试 |
| **合计** | **6** | |


## 八、非功能需求

### 8.1 兼容性

| 平台 | 最低要求 | 支持状态 |
|------|----------|----------|
| Windows | Win10 1903+ (64位) | ✅ Phase 1 |
| macOS | macOS 12 Monterey+ (Intel + Apple Silicon) | ✅ Phase 2 |
| Linux | Ubuntu 20.04+ / Fedora 34+ | ⏳ V1.2+ |
| 浏览器扩展 | Chrome 88+ / Firefox 109+ / Edge 88+ | ✅ V0.8+ |
| 分辨率 | 最低 1280×720, 推荐 1920×1080 | ✅ |

### 8.2 安全性

| 维度 | 要求 |
|------|------|
| **数据加密** | AES-256 加密存储敏感字段(密码/token)；传输层TLS 1.3 |
| **本地优先** | 默认所有数据存储本地；云端为可选备份 |
| **权限隔离** | 进程沙箱化；BrowserExt权限最小化原则 |
| **隐私合规** | GDPR/个人信息法合规；无未经授权的数据外传 |
| **审计日志** | 关键操作(删除/分享/导出)留痕可追溯 |

### 8.3 可访问性 (A11y)

- WCAG 2.1 AA 级别合规
- 完整键盘导航支持
- Screen Reader 兼容 (NVDA/VoiceOver)
- 色彩对比度 ≥ 4.5:1 (正文文字)
- Focus Indicator 清晰可见
- Alt Text 对所有图片资源

### 8.4 可维护性

| 实践 | 标准 |
|------|------|
| 代码规范 | ESLint + Prettier + Strict TypeScript |
| 测试覆盖率 | 单元测试 >80%；关键路径 E2E 覆盖 |
| 文档 | API文档(Swagger)/架构决策记录(ADR)/开发者手册 |
| 国际化 | 中英双语起步；i18n框架可扩展 |
| 可观测性 | 埋点(Sentry错误监控)+ 性能指标上报(可选关闭) |


## 九、商业模式

### 9.1 定价策略

| 版本 | 价格 | 目标用户 | 核心权益 |
|------|------|----------|----------|
| **Free** | 免费 | 个人轻度用户 | 单机/最高5000资产/基础搜索/手动标签 |
| **Pro Personal** | ¥299/年 | 自由设计师 | 无限资产/AI标签/浏览器扩展/设计插件/优先支持 |
| **Pro Team** | ¥999/人/年 | 设计团队 | Pro全部 + 团队协作/权限管理/共享库/评论@ |
| **Enterprise** | 定制报价 | 大型企业 | Team全部 + SSO/SAML/私有部署/SLA/专属客服 |

### 9.2 收入增长策略

```
短期 (0-6月):   产品打磨 + 口碑积累 + Free转Pro转化
中期 (6-12月):  团队版推广 + 插件生态引流 + 资产市场抽成
长期 (12月+):   企业定制开发 + API平台化 + 增值服务(AI高级模型)
```

| 策略 | 具体动作 | KPI |
|------|----------|-----|
| **产品驱动增长(PDL)** | 高质量Free版 → 用了就离不开 | Free→Pro转化率 >8% |
| **内容营销** | 教程/最佳实践/案例研究 | 月活增长率 >15% |
| **插件引流** | Figma Community 免费插件 | 插件安装量 >5K/月 |
| **社区运营** | Discord/微信群 + 设计师KOL合作 | NPS >50 |
| **企业销售** | BD团队定向开拓 | 企业客户 >20家/Y1 |

---

## 十、风险评估与应对

| # | 风险类别 | 风险描述 | 概率 | 影响 | 应对措施 |
|---|----------|----------|------|------|----------|
| R1 | 技术 | Electron包体积过大/性能瓶颈 | 中 | 高 | Tauri迁移PlanB; 按需加载Native模块 |
| R2 | 技术 | AI模型本地推理效果不如预期 | 中 | 中 | 云端API fallback; 模型持续迭代 |
| R3 | 市场 | Eagle/Billfish等竞品反应迅速 | 高 | 中 | 差异化AI能力; 先发优势; 用户迁移工具 |
| R4 | 市场 | 用户付费意愿低于预期 | 中 | 高 | Freemium降低门槛; 证明ROI(节省时间量化) |
| R5 | 合规 | AI生成内容版权风险 | 低 | 高 | 明确免责条款; 人工审核机制 |
| R6 | 产品 | 功能蔓延导致体验下降 | 高 | 中 | 严格优先级管理; 每2周回顾OKR |

**风险矩阵可视化**：

```
影响
  高 │  R5 ●          R1 ●
     │
  中 │       R2 ●    R6 ●     R3 ●
     │
  低 │
     └─────────────────────────────────────► 概率
           低           中           高
```


## 附录 A: 竞品对比分析

### 核心竞品一览

| 维度 | **AssetVault Pro (我们)** | **Eagle** | **PixPin** | **Billfish** |
|------|---------------------------|-----------|-----------|--------------|
| **定位** | AI-native DAM | 老牌素材管理 | 国产新兴 | 免费海量管理 |
| **价格** | Free + ¥299起/年 | ¥199买断(终身) | Free + ¥96/终身 | 免费 |
| **AI能力** | ★★★★★ 自动标签/以图搜图/NL搜索 | ★★☆☆☆ 基础颜色识别 | ★★★☆☆ 自动标签 | ★☆☆☆☆ 无 |
| **搜索** | ★★★★★ FTS+向量+多维筛选 | ★★★★☆ 强大但传统 | ★★★☆☆ 够用 | ★★★☆☆ 够用 |
| **浏览器扩展** | ★★★★★ 一键采集+规则预设 | ★★★★☆ 成熟稳定 | ★★★☆☆ 有但简陋 | ★★★★☆ 还不错 |
| **设计插件** | ★★★★☆ Ps/Figma/AE(规划) | ★★★★☆ Ps/Sketch | ★★★☆☆ Ps基本 | ★★☆☆☆ 有限 |
| **团队协作** | ★★★★★ RBAC/共享/评论 | ★★☆☆☆ 付费版基础 | ★☆☆☆☆ 无 | ★★★☆☆ 有但粗糙 |
| **隐私安全** | ★★★★★ 本地优先/加密 | ★★★★★ 本地 | ★★★★★ 本地 | ★★★★☆ 本地为主 |
| **跨平台** | ★★★★☆ Win+Mac(Linux规划) | ★★★★★ Win+Mac | ★★★★★ Win+Mac | ★★★★★ Win+Mac |

### 差异化竞争策略

```
                    用户价值
                       ↑
                       │    Eagle (高价买断)
                       │       ●
                       │
         AssetVault   │              Billfish (免费但笨重)
           ●          │                  ●
          /|\         │
           │         │    PixPin (低价入门)
    ──────┼─────────┼──────────●────────────→ 价格/门槛
           │       低              高
    
    我们的打法：
    ┌─────────────────────────────────────────────────┐
    │ ① AI能力降维打击  → 自动标签/以图搜图是核心钩子   │
    │ ② Freemium拉新    → Free版足够好用，Pro物超所值  │
    │ ③ 协作网络效应    → 团队用起来后迁移成本极高      │
    │ ④ 生态护城河      → 插件+扩展+市场形成闭环       │
    └─────────────────────────────────────────────────┘
```

---

## 附录 B: 术语表

| 术语 | 全称 | 定义 |
|------|------|------|
| DAM | Digital Asset Management | 数字资产管理 |
| FTS | Full-Text Search | 全文检索 |
| RBAC | Role-Based Access Control | 基于角色的访问控制 |
| IPC | Inter-Process Communication | 进程间通信 |
| LRU | Least Recently Used | 最近最少使用(缓存淘汰算法) |
| RRF | Reciprocal Rank Fusion | 倒数排名融合(多路搜索结果合并) |
| pHash | Perceptual Hash | 感知哈希(图片指纹) |
| OCR | Optical Character Recognition | 光学字符识别 |
| NLP | Natural Language Processing | 自然语言处理 |
| SDK | Software Development Kit | 软件开发工具包 |
| API | Application Programming Interface | 应用程序接口 |
| Library Bundle | 可搬运库 | 库根目录内自包含索引与资产文件；见 [4.4 可搬运库（Library Bundle）](#44-可搬运库library-bundle) |
| Sidecar | 侧车文件 | 与主数据并列存储的附属描述文件，如每条目的 `meta.json` |

---

## 文档修订历史

| 版本 | 日期 | 作者 | 修订内容 |
|------|------|------|----------|
| V0.1 | 2026-05-14 | 产品团队 | 初稿创建 |
| V0.2 | 2026-05-14 | 产品团队 | 新增 §4.4 可搬运库（SQLite + `items/{id}/` + `meta.json`）；M01 增加 F01-008；附录 B 补充术语 |

---

> **© 2026 AssetVault Pro. All Rights Reserved.**
> 
> *本文档为内部使用，包含机密的商业信息和产品规划。未经授权不得对外传播。*
