# 架构风险（维护参考）

按 **数据受损风险** 排序。发版前对照排障。

| 优先级 | 模块 | 典型症状 | 主要位置 |
|--------|------|----------|----------|
| P0 | DB 与 Drizzle 定义漂移 | 旧库打开报错、写入丢列 | `src/main/db/sqliteSchema.ts`、`schema.ts` |
| P0 | 库模式会话状态 | 切库失败后 catalog/archive 错乱 | `libraryManifest.ts`、`librarySwitch.ts` |
| P1 | 索引库路径与缺失 | 预览失败、误标缺失/引用 | `assetPathResolver.ts`、`importSingleAsset.ts` |
| P1 | IPC 入参未校验 | 异常入参导致主进程抛错 | `src/main/ipc/handlers/*.ts` |
| P1 | 渲染层列表/筛选竞态 | 快速切文件夹后闪旧数据 | `AppContext.tsx` |
| P2 | 动态 `import()` | 重构后功能静默失败 | `libraryUpgrade.ts`、`assets.ts` |

## P0：数据库

- `runLibrarySchemaMigrations()` + `_av_schema_meta.schema_version`（forward-only）。
- better-sqlite3 WAL；切库/退出前 `wal_checkpoint`。

## P0：`sessionLibraryMode`

- 全主进程单例；切库成功/失败回滚均调用 `loadLibraryModeFromManifest`。
- 单窗口单库设计；多窗口各开不同库时需重构。

## P1：IPC 与前端状态

- 搜索为 `assets_search` + `LIKE`（非 FTS5）；导入后需维护搜索表。
