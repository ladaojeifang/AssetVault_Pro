# Web API 与浏览器扩展

AssetVault Pro 内置 HTTP API，供脚本、自动化工具与 [浏览器扩展](../browser-extension.md) 操作**当前活动资料库**。

完整契约见 [web-api-v1-guide.md](../web-api-v1-guide.md) 与 [web-api-v1-openapi.yaml](../web-api-v1-openapi.yaml)。

---

## 概述

| 配置项 | 默认值 |
|--------|--------|
| Base URL | `http://127.0.0.1:41596/api/v1/` |
| 协议 | HTTP |
| 规范 | OpenAPI 3.1 |
| 默认启用 | **是**（可在设置中关闭） |

路由实现见 `src/main/api/routes/index.ts`，静态 + 动态路由合计 **40+** 个操作。

---

## 鉴权

| 访问方式 | 要求 |
|----------|------|
| 本机（`allowRemote=false`） | **无需** Bearer Token |
| 远程（`allowRemote=true`） | 须 `Authorization: Bearer <token>` 或 Query `?token=` |

远程访问默认关闭。开启后绑定地址变为 `0.0.0.0`，务必设置强 Token。

---

## 启用与配置

1. 打开 **设置 → 高级 → Web API**
2. 确认「启用」已勾选（默认已开启）
3. 按需修改端口、远程访问、Token
4. 点击「保存」

可在此复制 Base URL 或打开 Playground。

---

## API Playground

交互式 Swagger UI，用于浏览和调试全部接口。

打开方式：

1. 设置 → 高级 → **打开 Playground**
2. 浏览器访问 `http://127.0.0.1:41596/api/v1/playground/`（端口以设置为准）

Playground 需加载 CDN 上的 Swagger UI；离线环境请直接阅读 OpenAPI 或使用 curl。

---

## 路由分组

### 应用 `app`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/app/info` | 应用信息 |

### 资料库 `library`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/library/info` | 当前库信息与统计 |
| GET | `/api/v1/library/state` | 活动库路径、最近列表等 |
| POST | `/api/v1/library/switch` | 切换资料库 |
| POST | `/api/v1/library/importFromLibrary` | 从其他资料库合并导入 |

### 资产 `asset`

| 方法 | 路径 | 说明 |
|------|------|------|
| GET / POST | `/api/v1/asset/get` | 查询资产列表 |
| GET | `/api/v1/asset/info` | 单个资产详情 |
| POST | `/api/v1/asset/import` | 从本地路径导入 |
| POST | `/api/v1/asset/importFromURL` | 从 URL 下载导入 |
| POST | `/api/v1/asset/importFromDataUrl` | 从 Data URL 导入（截图等） |
| POST | `/api/v1/asset/importBatch` | 批量本地导入 |
| POST | `/api/v1/asset/importFolder` | 导入文件夹 |
| POST | `/api/v1/asset/importFromURLBatch` | 批量 URL 导入 |
| POST | `/api/v1/asset/fetchRemoteBody` | 拉取远程正文 |
| DELETE | `/api/v1/asset/delete` | 删除 |
| PATCH | `/api/v1/asset/update` | 更新元数据 |
| POST | `/api/v1/asset/rename` | 重命名 |
| POST | `/api/v1/asset/relink` | 重新链接源文件 |
| POST | `/api/v1/asset/localize` | 本地化引用资产 |

**会话式导入**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/asset/fullPageSession/start` | 开始整页长截图会话 |
| POST | `/api/v1/asset/fullPageSession/append` | 追加分段 |
| POST | `/api/v1/asset/fullPageSession/finish` | 完成入库 |
| GET / DELETE | `/api/v1/asset/fullPageSession/{sessionId}` | 查询 / 中止 |

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/asset/articleBundleSession/start` | Markdown 资料包会话 |
| POST | `/api/v1/asset/articleBundleSession/append` | 追加资源 |
| POST | `/api/v1/asset/articleBundleSession/finish` | 完成入库 |
| GET / DELETE | `/api/v1/asset/articleBundleSession/{sessionId}` | 查询 / 中止 |

**作品页视频（yt-dlp）**

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/asset/pageVideoImport` | 创建下载任务 |
| POST | `/api/v1/asset/pageVideoImport/batch` | 批量创建 |
| GET | `/api/v1/asset/pageVideoImport/batch/{batchId}` | 批次状态 |
| GET / DELETE | `/api/v1/asset/pageVideoImport/jobs/{jobId}` | 任务状态 / 取消 |

### 文件夹 `folder`

| 方法 | 路径 |
|------|------|
| GET | `/api/v1/folder/get` · `/tree` · `/info` |
| POST | `/api/v1/folder/create` · `/move` |
| PATCH | `/api/v1/folder/update` |
| DELETE | `/api/v1/folder/delete` |

### 标签 `tag`

| 方法 | 路径 |
|------|------|
| GET | `/api/v1/tag/get` · `/info` |
| POST | `/api/v1/tag/create` · `/assign` · `/remove` |
| PATCH | `/api/v1/tag/update` |
| DELETE | `/api/v1/tag/delete` |

---

## 浏览器扩展

扩展源码在独立仓库 [AssetVault_Browser_Extension](https://github.com/ladaojeifang/AssetVault_Browser_Extension)，通过本机 Web API 与 Pro 通信。

### 前置条件

1. AssetVault Pro 已启动，Web API 已启用
2. 已安装并加载扩展（Chrome / Edge，`dist` 目录）
3. 扩展配置的 API 地址与 Pro 端口一致（默认 `http://127.0.0.1:41596/api/v1`）

### 典型能力

| 功能 | 说明 |
|------|------|
| 区域截图 | 截取网页区域，经 Data URL API 入库 |
| 整页截图 | 滚动拼接长图，经 fullPageSession 入库 |
| Markdown 资料包 | 页面转 Markdown + 图片，经 articleBundleSession 入库 |
| 作品页视频 | 检测视频页，经 pageVideoImport + yt-dlp 下载 |

扩展功能以扩展仓库实现为准；API 契约以本仓库 OpenAPI 为准。

---

## 集成示例

```python
import requests

BASE = "http://127.0.0.1:41596/api/v1"

# 导入本地文件
r = requests.post(f"{BASE}/asset/import", json={
    "path": "C:/Users/example/image.png"
})
print(r.json())

# 从 URL 导入
r = requests.post(f"{BASE}/asset/importFromURL", json={
    "url": "https://example.com/photo.jpg"
})
print(r.json())
```

远程访问时须在请求头添加 `Authorization: Bearer <your-token>`。

---

## 契约同步

修改 API 时请同步更新 `doc/web-api-v1-guide.md` 与 OpenAPI；扩展侧执行 `pnpm run contract:check` 防止漂移。详见 [browser-extension.md](../browser-extension.md)。
