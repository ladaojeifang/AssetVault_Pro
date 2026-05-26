/**
 * Runtime guards for IPC payloads — preload only exposes curated API, but
 * corrupted renderer state or bugs should not crash the main process.
 */

export class IpcBadArgsError extends Error {
  readonly code = 'IPC_BAD_ARGS'

  constructor(message: string) {
    super(message)
    this.name = 'IpcBadArgsError'
  }
}

export function assertStringArray(name: string, value: unknown): asserts value is string[] {
  if (!Array.isArray(value)) {
    throw new IpcBadArgsError(`${name} must be an array`)
  }
  for (let i = 0; i < value.length; i++) {
    if (typeof value[i] !== 'string') {
      throw new IpcBadArgsError(`${name}[${i}] must be a string`)
    }
  }
}

export function assertString(name: string, value: unknown): asserts value is string {
  if (typeof value !== 'string') {
    throw new IpcBadArgsError(`${name} must be a string`)
  }
}

export function assertFiniteNumber(name: string, value: unknown): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new IpcBadArgsError(`${name} must be a finite number`)
  }
}

export function assertOptionalBoolean(name: string, value: unknown): asserts value is boolean | undefined | null {
  if (value == null) return
  if (typeof value !== 'boolean') {
    throw new IpcBadArgsError(`${name} must be a boolean or null`)
  }
}

export function assertPlainObject(
  name: string,
  value: unknown
): asserts value is Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new IpcBadArgsError(`${name} must be a plain object`)
  }
}

export function assertOptionalPlainObject(
  name: string,
  value: unknown
): asserts value is Record<string, unknown> | undefined | null {
  if (value == null) return
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new IpcBadArgsError(`${name} must be a plain object or null`)
  }
}

export function assertOptionalStringRecord(
  name: string,
  value: unknown
): asserts value is Record<string, unknown> | undefined | null {
  if (value == null) return
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new IpcBadArgsError(`${name} must be a plain object or null`)
  }
}
