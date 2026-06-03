import type { ApiRequestContext } from '../request'
import { handleAppInfo } from '../handlers/app'
import { handleLibraryInfo, handleLibraryState, handleLibrarySwitch, handleLibraryImportFromLibrary } from '../handlers/library'
import {
  handleAssetDelete,
  handleAssetGet,
  handleAssetImport,
  handleAssetImportFromUrl,
  handleAssetImportBatch,
  handleAssetImportFolder,
  handleAssetImportFromUrlBatch,
  handleAssetImportFromDataUrl,
  handleAssetInfo,
  handleAssetLocalize,
  handleAssetRelink,
  handleAssetRename,
  handleAssetUpdate
} from '../handlers/asset'
import {
  handleFullPageSessionAbort,
  handleFullPageSessionAppend,
  handleFullPageSessionFinish,
  handleFullPageSessionGet,
  handleFullPageSessionStart
} from '../handlers/fullPageSession'
import {
  handleArticleBundleSessionAbort,
  handleArticleBundleSessionAppend,
  handleArticleBundleSessionFinish,
  handleArticleBundleSessionGet,
  handleArticleBundleSessionStart
} from '../handlers/articleBundleSession'
import {
  handleFolderCreate,
  handleFolderDelete,
  handleFolderGet,
  handleFolderInfo,
  handleFolderMove,
  handleFolderTree,
  handleFolderUpdate
} from '../handlers/folder'
import {
  handleTagAssign,
  handleTagCreate,
  handleTagDelete,
  handleTagGet,
  handleTagInfo,
  handleTagRemove,
  handleTagUpdate
} from '../handlers/tag'

type RouteHandler = (ctx: ApiRequestContext) => Promise<unknown>

type RouteDef = {
  method: string
  path: string
  handler: RouteHandler
}

const API_PREFIX = '/api/v1'

const routes: RouteDef[] = [
  { method: 'GET', path: `${API_PREFIX}/app/info`, handler: () => handleAppInfo() },
  { method: 'GET', path: `${API_PREFIX}/library/info`, handler: () => handleLibraryInfo() },
  { method: 'GET', path: `${API_PREFIX}/library/state`, handler: () => handleLibraryState() },
  {
    method: 'POST',
    path: `${API_PREFIX}/library/switch`,
    handler: (ctx) => handleLibrarySwitch(ctx.body)
  },
  {
    method: 'POST',
    path: `${API_PREFIX}/library/importFromLibrary`,
    handler: (ctx) => handleLibraryImportFromLibrary(ctx.body)
  },

  { method: 'GET', path: `${API_PREFIX}/asset/get`, handler: (ctx) => handleAssetGet({ ...ctx.query }) },
  { method: 'POST', path: `${API_PREFIX}/asset/get`, handler: (ctx) => handleAssetGet(ctx.body) },
  { method: 'GET', path: `${API_PREFIX}/asset/info`, handler: (ctx) => handleAssetInfo(ctx.query.id) },
  { method: 'POST', path: `${API_PREFIX}/asset/import`, handler: (ctx) => handleAssetImport(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/asset/importFromURL`, handler: (ctx) => handleAssetImportFromUrl(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/asset/importFromDataUrl`, handler: (ctx) => handleAssetImportFromDataUrl(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/asset/importBatch`, handler: (ctx) => handleAssetImportBatch(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/asset/importFolder`, handler: (ctx) => handleAssetImportFolder(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/asset/importFromURLBatch`, handler: (ctx) => handleAssetImportFromUrlBatch(ctx.body) },
  { method: 'DELETE', path: `${API_PREFIX}/asset/delete`, handler: (ctx) => handleAssetDelete(ctx.body) },
  { method: 'PATCH', path: `${API_PREFIX}/asset/update`, handler: (ctx) => handleAssetUpdate(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/asset/rename`, handler: (ctx) => handleAssetRename(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/asset/relink`, handler: (ctx) => handleAssetRelink(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/asset/localize`, handler: (ctx) => handleAssetLocalize(ctx.body) },

  { method: 'POST', path: `${API_PREFIX}/asset/fullPageSession/start`, handler: (ctx) => handleFullPageSessionStart(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/asset/fullPageSession/append`, handler: (ctx) => handleFullPageSessionAppend(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/asset/fullPageSession/finish`, handler: (ctx) => handleFullPageSessionFinish(ctx.body) },

  { method: 'POST', path: `${API_PREFIX}/asset/articleBundleSession/start`, handler: (ctx) => handleArticleBundleSessionStart(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/asset/articleBundleSession/append`, handler: (ctx) => handleArticleBundleSessionAppend(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/asset/articleBundleSession/finish`, handler: (ctx) => handleArticleBundleSessionFinish(ctx.body) },

  { method: 'GET', path: `${API_PREFIX}/folder/get`, handler: () => handleFolderGet() },
  { method: 'GET', path: `${API_PREFIX}/folder/tree`, handler: () => handleFolderTree() },
  { method: 'GET', path: `${API_PREFIX}/folder/info`, handler: (ctx) => handleFolderInfo(ctx.query.id) },
  { method: 'POST', path: `${API_PREFIX}/folder/create`, handler: (ctx) => handleFolderCreate(ctx.body) },
  { method: 'PATCH', path: `${API_PREFIX}/folder/update`, handler: (ctx) => handleFolderUpdate(ctx.body) },
  { method: 'DELETE', path: `${API_PREFIX}/folder/delete`, handler: (ctx) => handleFolderDelete(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/folder/move`, handler: (ctx) => handleFolderMove(ctx.body) },

  { method: 'GET', path: `${API_PREFIX}/tag/get`, handler: () => handleTagGet() },
  { method: 'GET', path: `${API_PREFIX}/tag/info`, handler: (ctx) => handleTagInfo(ctx.query.id) },
  { method: 'POST', path: `${API_PREFIX}/tag/create`, handler: (ctx) => handleTagCreate(ctx.body) },
  { method: 'PATCH', path: `${API_PREFIX}/tag/update`, handler: (ctx) => handleTagUpdate(ctx.body) },
  { method: 'DELETE', path: `${API_PREFIX}/tag/delete`, handler: (ctx) => handleTagDelete(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/tag/assign`, handler: (ctx) => handleTagAssign(ctx.body) },
  { method: 'POST', path: `${API_PREFIX}/tag/remove`, handler: (ctx) => handleTagRemove(ctx.body) }
]

const FULLPAGE_SESSION_ID_RE = /^\/api\/v1\/asset\/fullPageSession\/([^/]+)$/
const ARTICLE_BUNDLE_SESSION_ID_RE = /^\/api\/v1\/asset\/articleBundleSession\/([^/]+)$/

export function matchRoute(ctx: ApiRequestContext): RouteHandler | null {
  const hit = routes.find((r) => r.method === ctx.method && r.path === ctx.pathname)
  if (hit) return hit.handler

  const m = ctx.pathname.match(FULLPAGE_SESSION_ID_RE)
  if (m) {
    const sessionId = decodeURIComponent(m[1]!)
    if (ctx.method === 'DELETE') return () => handleFullPageSessionAbort(sessionId)
    if (ctx.method === 'GET') return () => handleFullPageSessionGet(sessionId)
  }

  const m2 = ctx.pathname.match(ARTICLE_BUNDLE_SESSION_ID_RE)
  if (m2) {
    const sessionId = decodeURIComponent(m2[1]!)
    if (ctx.method === 'DELETE') return () => handleArticleBundleSessionAbort(sessionId)
    if (ctx.method === 'GET') return () => handleArticleBundleSessionGet(sessionId)
  }

  return null
}

export function listApiRoutes(): Array<{ method: string; path: string }> {
  return routes.map((r) => ({ method: r.method, path: r.path }))
}
