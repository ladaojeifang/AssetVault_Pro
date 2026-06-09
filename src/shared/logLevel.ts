/**
 * Log level definitions shared between main & renderer.
 *
 * Priority: error > warn > info > debug
 * Setting a level shows that level AND all higher-priority levels.
 *
 *   "error"  → only console.error
 *   "warn"   → console.error + console.warn
 *   "info"   → console.error + console.warn + console.log        (production default)
 *   "debug"  → console.error + console.warn + console.log + console.debug  (dev default)
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export const LOG_LEVELS: readonly LogLevel[] = ['error', 'warn', 'info', 'debug'] as const

/** Numeric severity (lower = more permissive / shows more). */
const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

/**
 * Returns true when `messageLevel` SHOULD be shown given the current `configuredLevel`.
 */
export function shouldLog(messageLevel: LogLevel, configuredLevel: LogLevel): boolean {
  return LEVEL_SEVERITY[messageLevel] >= LEVEL_SEVERITY[configuredLevel]
}

/**
 * Default log level per environment (before user preferences override it).
 *   - dev  → "debug" (show everything in terminal)
 *   - prod → "info"  (hide noisy debug, keep lifecycle & warnings)
 */
export function defaultLogLevel(isDev: boolean): LogLevel {
  return isDev ? 'debug' : 'info'
}

/**
 * Parse a raw string into a valid LogLevel, falling back to `fallback`.
 */
export function parseLogLevel(raw: unknown, fallback: LogLevel): LogLevel {
  if (typeof raw !== 'string') return fallback
  const lower = raw.toLowerCase().trim()
  if (LOG_LEVELS.includes(lower as LogLevel)) return lower as LogLevel
  return fallback
}
