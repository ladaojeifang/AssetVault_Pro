# 冒烟清单：切库 + 索引库导入

目标：覆盖 **切库成功/失败回滚**、`sessionLibraryMode` 一致性，以及 **catalog 导入不拷贝源文件**。Windows 上约 3–5 分钟。

## 预置

- 资料库 A（现有）、B（新建空目录，catalog）
- 测试文件：图片、视频、字体、3D（含子文件夹）

## 切库与回滚

- 创建索引库 B → `libraryMode: catalog`
- 切回 A → mode 与 manifest 一致
- 故意失败切库 → 保持原库，`sessionLibraryMode` 不漂移

## catalog 导入

- 单文件导入 → `resolvedFilePath` 指向源文件，非 `items/.../content`
- 导入文件夹 → 进度与数量正确
- 本地化 → 拷贝/硬链接后缺失状态更新

## 自动化辅助

整库合并冒烟脚本（本机路径，不公开）：

```bash
# 位于 doc-internal/scripts/test_catalog_merge.py（init 后）
```
