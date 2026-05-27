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
