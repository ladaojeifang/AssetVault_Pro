export class ApiError extends Error {
  readonly code: string
  readonly httpStatus: number
  readonly details?: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    httpStatus = 400,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.httpStatus = httpStatus
    this.details = details
  }
}

export function invalidRequest(message: string, details?: Record<string, unknown>): ApiError {
  return new ApiError('INVALID_REQUEST', message, 400, details)
}

export function assetNotFound(id?: string): ApiError {
  return new ApiError('ASSET_NOT_FOUND', id ? `资产不存在: ${id}` : '资产不存在', 404)
}

export function folderNotFound(id?: string): ApiError {
  return new ApiError('FOLDER_NOT_FOUND', id ? `文件夹不存在: ${id}` : '文件夹不存在', 404)
}

export function tagNotFound(id?: string): ApiError {
  return new ApiError('TAG_NOT_FOUND', id ? `标签不存在: ${id}` : '标签不存在', 404)
}

export function libraryNotReady(): ApiError {
  return new ApiError('LIBRARY_NOT_READY', '资料库未初始化', 503)
}

export function fileNotFound(path?: string): ApiError {
  return new ApiError('FILE_NOT_FOUND', path ? `路径不存在: ${path}` : '路径不存在', 400)
}

export function fileNotFile(path?: string): ApiError {
  return new ApiError('FILE_NOT_FILE', path ? `不是文件: ${path}` : '不是文件', 400)
}

export function fileNotDirectory(path?: string): ApiError {
  return new ApiError('FILE_NOT_DIRECTORY', path ? `不是目录: ${path}` : '不是目录', 400)
}

export function unauthorized(): ApiError {
  return new ApiError('UNAUTHORIZED', '需要有效的 API token', 401)
}

export function internalError(message = '内部错误'): ApiError {
  return new ApiError('INTERNAL_ERROR', message, 500)
}

export function libraryNotOpen(): ApiError {
  return new ApiError('LIBRARY_NOT_OPEN', '资料库未打开', 503)
}

export function fullPageApiError(code: string, message?: string): ApiError {
  const status =
    code === 'FULLPAGE_SESSION_NOT_FOUND' || code === 'FULLPAGE_SESSION_EXPIRED'
      ? 404
      : code === 'FULLPAGE_SESSION_LIMIT' || code === 'FULLPAGE_SESSION_BUSY'
        ? 409
        : code === 'FULLPAGE_STITCH_FAILED' || code === 'IMPORT_FAILED'
          ? 500
          : 400
  const defaults: Record<string, string> = {
    FULLPAGE_SESSION_NOT_FOUND: '整页截图会话不存在或已结束',
    FULLPAGE_SESSION_EXPIRED: '整页截图会话已过期',
    FULLPAGE_SESSION_BUSY: '会话正在合成中',
    FULLPAGE_SESSION_LIMIT: '活跃整页截图会话过多',
    FULLPAGE_SESSION_EMPTY: '尚未登记任何条带',
    FULLPAGE_STRIP_ORDER: '条带序号必须连续递增',
    FULLPAGE_STRIP_PATH_DENIED: '条带路径不在会话目录内',
    FULLPAGE_STRIP_TOO_LARGE: '条带或会话总大小超限',
    FULLPAGE_STRIP_DECODE_FAILED: '条带图片无法解码',
    FULLPAGE_STRIP_DIMENSION_MISMATCH: '条带尺寸与会话布局不一致',
    FULLPAGE_STITCH_FAILED: '纵向拼接失败',
    FULLPAGE_DIMENSION_LIMIT: '合成图超过像素或体积上限',
    IMPORT_FAILED: '拼接成功但入库失败',
    INVALID_REQUEST: '请求参数无效'
  }
  return new ApiError(code, message ?? defaults[code] ?? code, status)
}

export function mapFullPageThrown(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  const code = err instanceof Error ? err.message : String(err)
  if (code.startsWith('FULLPAGE_') || code === 'IMPORT_FAILED' || code === 'INVALID_REQUEST') {
    return fullPageApiError(code)
  }
  return internalError(err instanceof Error ? err.message : String(err))
}

export function articleBundleApiError(code: string, message?: string): ApiError {
  const status =
    code === 'ARTICLE_BUNDLE_SESSION_NOT_FOUND' || code === 'ARTICLE_BUNDLE_SESSION_EXPIRED'
      ? 404
      : code === 'ARTICLE_BUNDLE_SESSION_LIMIT' || code === 'ARTICLE_BUNDLE_SESSION_BUSY'
        ? 409
        : code === 'IMPORT_FAILED'
          ? 500
          : 400
  const defaults: Record<string, string> = {
    ARTICLE_BUNDLE_SESSION_NOT_FOUND: 'Markdown 资料包会话不存在或已结束',
    ARTICLE_BUNDLE_SESSION_EXPIRED: 'Markdown 资料包会话已过期',
    ARTICLE_BUNDLE_SESSION_BUSY: '会话正在处理中',
    ARTICLE_BUNDLE_SESSION_LIMIT: '活跃会话过多',
    ARTICLE_BUNDLE_PATH_DENIED: '文件路径不在会话目录内或扩展名非法',
    ARTICLE_BUNDLE_FILE_NOT_FOUND: '文件不存在',
    ARTICLE_BUNDLE_FILE_TOO_LARGE: '单文件大小超限',
    ARTICLE_BUNDLE_SESSION_TOO_LARGE: '会话总大小超限',
    ARTICLE_BUNDLE_TOO_MANY_FILES: '文件数量超限',
    ARTICLE_BUNDLE_INCOMPLETE: '缺少必填文件 (Markdown 或缩略图)',
    IMPORT_FAILED: '入库失败',
    INVALID_REQUEST: '请求参数无效'
  }
  return new ApiError(code, message ?? defaults[code] ?? code, status)
}

export function mapArticleBundleThrown(err: unknown): ApiError {
  if (err instanceof ApiError) return err
  const code = err instanceof Error ? err.message : String(err)
  if (code.startsWith('ARTICLE_BUNDLE_') || code === 'IMPORT_FAILED' || code === 'INVALID_REQUEST') {
    return articleBundleApiError(code)
  }
  return internalError(err instanceof Error ? err.message : String(err))
}
