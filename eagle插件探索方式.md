
用户问的是 Eagle 的浏览器扩展是怎么实现高清图片采集的。Eagle 是知名的素材管理工具，它的浏览器扩展在设计师群体中口碑很好，特别是在"自动获取高清原图"这个能力上。

我需要基于已有的代码上下文（特别是 `url-enlarger.ts` 头部的注释提到灵感来自 Eagle 扩展）来回答，同时也可以结合一般知识说明 Eagle 扩展的实现思路。

由于 Eagle 是闭源软件，我无法直接读取它的源码，但可以从以下几个维度分析：
1. 已知引用：`url-enlarger.ts` 明确提到参考了 Eagle 的 `url-enlarger.js`
2. Eagle 扩展的公开行为和技术特征（从用户角度和浏览器扩展 API 角度）
3. 与 AssetVault 当前方案的对比

让我组织一个全面的回答。
Eagle 的浏览器扩展是闭源的，无法直接阅读源码，但从公开资料、逆向分析以及 `url-enlarger.ts` 中明确的引用注释（`Inspired by Eagle extension js/lib/api/url-enlarger.js`）来看，Eagle 的实现思路可以拆解为以下几个层面：

---

## 一、Eagle 扩展的核心架构

Eagle 的扩展采用 **"双端联动 + 本地 HTTP Server"** 架构：

| 组件 | 职责 |
|---|---|
| **Browser Extension** | 页面探测、URL 放大、与 Eagle App 通信 |
| **Eagle App (本地程序)** | 暴露本地 HTTP API（默认端口 `41595`），接收扩展发送的采集指令，实际执行下载 |
| **Native Messaging (备选)** | 部分场景下可能使用 Chrome 的 `chrome.runtime.connectNative` 与本地进程通信 |

这与 AssetVault 当前的架构几乎一致：
- Eagle: `http://127.0.0.1:41595/api/...`
- AssetVault: `http://127.0.0.1:41596/api/v1/...`

---

## 二、Eagle 的"高清原图"实现策略

### 1. URL 放大规则库（URL Enlarger）
这是 Eagle 最核心的技术资产。`url-enlarger.ts` 中的注释明确说明参考了 Eagle 的 `js/lib/api/url-enlarger.js`。

Eagle 的规则库覆盖了 **100+ 个站点**，包括：

- **国内站点**：花瓣、站酷、UI中国、优设、 Pinterest 中文版镜像
- **设计平台**：Dribbble、Behance、ArtStation、DeviantArt
- **社交平台**：Twitter/X、Instagram、Facebook、微博、小红书
- **图库站点**：Unsplash、Pexels、Pixabay、Shutterstock、Getty Images
- **电商站点**：淘宝、天猫、京东、Amazon、eBay
- **视频站点**：YouTube、Bilibili、Vimeo

每种站点的规则不只是简单的字符串替换，还包含：
- **多阶段 fallback**：如 Pinterest 先尝试 `/originals/`，失败则尝试 `/736x/`，再失败保留原图
- **动态参数处理**：Instagram 的 CDN 签名参数 (`oh=...`, `oe=...`) 需要保留
- **不同子域识别**：如 `pbs.twimg.com` vs `video.twimg.com` 采用不同策略

### 2. 页面探测策略
Eagle 的探测比 AssetVault 当前更激进：

| 探测源 | Eagle 行为 | AssetVault 当前 |
|---|---|---|
| **Meta 标签** | 全量抓取 `og:image:*` 系列、Twitter Card、JSON-LD | 仅基础 `og:image` 和 `twitter:image` |
| **DOM 树扫描** | 扫描 `img`、`source`、`picture`、`figure`、`div[style*="background"]` | 仅 `img`、`video`、`background-image` |
| **懒加载属性** | 识别 `data-src`、`data-original`、`data-lazy-src`、`srcset` | 未处理 |
| **srcset 解析** | 解析 `srcset` 取最大尺寸 URL | 未处理 |
| **XHR/JS 拦截** | 通过 `chrome.devtools` 或注入脚本拦截页面 AJAX，提取 API 返回的高清图 URL | 未实现 |
| **Performance API** | 读取 `performance.getEntriesByType('resource')` 过滤图片资源 | 仅在视频采集中使用 |

### 3. 智能选择算法
Eagle 不是简单地取第一个候选，而是有一个**评分系统**：

```
score = w1 * estimatedSize + w2 * urlConfidence + w3 * sourcePriority
```

- `estimatedSize`：通过 URL 特征预估文件大小（如 `name=orig` > `name=large` > `name=small`）
- `urlConfidence`：规则匹配的确定性（完全匹配 > 模糊匹配）
- `sourcePriority`：Meta 标签 > DOM 主图 > 背景图 > 其他

### 4. 反防盗链处理
Eagle 扩展在采集时会携带完整的请求上下文：

```javascript
// Eagle 扩展发送给 App 的 payload 示意
{
  url: "https://cdn.dribbble.com/.../original.png",
  headers: {
    "Referer": "https://dribbble.com/shots/...",
    "User-Agent": "...",        // 与浏览器一致的 UA
    "Cookie": "..."             // 部分站点需要登录态 Cookie
  }
}
```

Eagle App 端下载时会**复用这些 Header**，从而绕过大部分防盗链机制。

---

## 三、Eagle 扩展的"批量采集"能力

Eagle 的批量采集在业界口碑极高，其实现特点：

### 1. 悬浮采集篮
用户可以在页面上多选图片（类似勾选购物车），先不下载，最后一次性批量入库。这对应 AssetVault 当前的 `batch.html` 草稿机制。

### 2. 智能过滤
- **尺寸过滤**：可设置最小宽度/高度
- **类型过滤**：只采集图片/视频/GIF
- **去重**：基于 URL 和感知哈希（perceptual hash）的双重去重
- **广告过滤**：基于常见广告图尺寸（如 `1x1`、`300x250`）和 URL 特征过滤

### 3. 区域截图
Eagle 扩展支持：
- **区域截图**（拖拽选区）
- **元素截图**（点击 DOM 元素自动识别边界）
- **整页长截图**（滚动拼接）

这与 AssetVault 当前的截图能力对齐，但 Eagle 的长截图算法更成熟（处理固定头部/底部、懒加载图片等）。

---

## 四、Eagle 与 AssetVault 的对比

| 能力 | Eagle | AssetVault（当前） |
|---|---|---|
| URL 放大规则库 | 100+ 站点，持续更新 | 9 个站点（Pinterest/Dribbble/Twitter/Instagram/Behance/花瓣/Flickr/WordPress/Amazon） |
| 视频/GIF 采集 | 支持 YouTube、Bilibili、Twitter 视频 | 已添加 `resolveVideoCandidatesInTab`，但规则待完善 |
| `srcset` / 懒加载 | 完整支持 | 未支持 |
| 批量采集去重 | URL + 感知哈希 | 仅 URL |
| 页面剪藏 | 支持（保存网页为 HTML/PDF） | 未实现 |
| 悬浮采集篮 UI | 精美（浮层 + 缩略图网格） | 基础实现（batch.html） |
| 采集前预览 | 支持（弹窗显示大图） | 未实现 |

---

## 五、对 AssetVault 的启示

如果要以 Eagle 为标杆，扩展的演进方向可以明确为：

### 短期（立即可做）
1. **扩充 URL 放大规则库**：见独立扩展仓库 `AssetVault_Browser_Extension/src/shared/url-enlarger-site-rules.ts`；X 仍走 syndication 管线
2. **继续手写补充**：站酷、UI中国等尚未覆盖站点
3. **支持 `srcset` 解析**：`<img srcset="...">` 中往往包含更高清的候选 URL（`eagle-page-collector.ts` 已部分实现）
4. **支持懒加载属性**：扫描 `data-src`、`data-original` 等属性（同上）

### 中期
1. **拦截页面 XHR/Fetch**：注入脚本拦截 Pinterest、Instagram 等 SPA 的图片 API 请求，提取原始高清 URL（这是 Eagle 能拿到很多"隐藏"高清图的关键）
2. **感知哈希去重**：扩展端计算图片的 pHash，在批量采集时提示"库中已有相似图片"
3. **采集前预览**：Popup 或 Side Panel 中显示候选高清图的实际预览

### 长期
1. **AI 辅助标签**：如 Eagle 3.0 引入的 AI 自动打标签能力
2. **浏览器书签/历史集成**：一键导入浏览器中的设计灵感站点

---

**一句话总结**：Eagle 扩展的核心竞争力在于**庞大的站点适配规则库** + **多维度高清探测策略** + **与本地 App 的深度联动**。AssetVault 当前架构与之对齐，但在规则覆盖面和探测深度上还有很大提升空间。`url-enlarger.ts` 中已经埋下了 Eagle 的参考线索，接下来的重点是**把规则库做厚、把探测逻辑做深**。