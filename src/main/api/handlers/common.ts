import { getDatabase } from '../../db'
import { invalidRequest, libraryNotReady } from '../errors'

export function assertLibraryReady(): void {
  try {
    getDatabase()
  } catch {
    throw libraryNotReady()
  }
}

export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw invalidRequest(`缺少或无效: ${field}`)
  }
  return value.trim()
}

export function requireStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalidRequest(`缺少非空数组: ${field}`)
  }
  const out = value.filter((v): v is string => typeof v === 'string' && v.length > 0)
  if (out.length === 0) throw invalidRequest(`缺少非空数组: ${field}`)
  return out
}

export function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') throw invalidRequest('期望字符串参数')
  return value
}

export function optionalNullableString(value: unknown): string | null | undefined {
  if (value === null) return null
  return optionalString(value)
}
