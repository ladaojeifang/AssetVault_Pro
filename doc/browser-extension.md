# 浏览器扩展（独立仓库）

Chrome / Edge 扩展已从本仓库迁出，单独维护。

## 源码位置

默认与桌面端**并列**放在同一父目录：

| 项目 | 路径 |
|------|------|
| AssetVault Pro（本仓库） | `AssetVault_Pro/` |
| 浏览器扩展 | `AssetVault_Browser_Extension/` |

扩展 README、构建与打包说明见扩展仓库根目录 `README.md`。

## 构建

```bash
cd ../AssetVault_Browser_Extension
pnpm install
pnpm run build
# 或发布 zip
pnpm run package
```

在浏览器加载 **`AssetVault_Browser_Extension/dist`**。

## API

扩展仅调用本机 Web API，实现与文档仍在**本仓库**：

- [web-api-v1-guide.md](./web-api-v1-guide.md)（URL 导入等）
- [web-api-v1-openapi.yaml](./web-api-v1-openapi.yaml)

扩展侧摘要：[AssetVault_Browser_Extension/docs/WEB_API.md](../AssetVault_Browser_Extension/docs/WEB_API.md)（并列克隆时）。

## 契约同步（防两端漂移）

1. 在本仓库修改 API 时，同步 `doc/web-api-v1-guide.md` 与 `doc/web-api-v1-openapi.yaml`。
2. 在扩展仓库执行：

```bash
cd ../AssetVault_Browser_Extension
pnpm run contract:sync    # 复制 OpenAPI → contracts/
pnpm run contract:check   # 校验扩展调用的路径仍在 OpenAPI 中
```

扩展维护 `contracts/extension-api-surface.json`（实际 `apiRequest` 路径列表）。详见扩展 [docs/cross-repo-workflow.md](../AssetVault_Browser_Extension/docs/cross-repo-workflow.md)。

可选：父目录 [AssetVault.code-workspace](../AssetVault.code-workspace) 多根打开两个仓库。

## 迁移说明

若仍看到 `AssetVault_Pro/AssetVault_extension/`，为迁出前的残留目录；关闭占用进程后可删除，以扩展独立仓库为准。
