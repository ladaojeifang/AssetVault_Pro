import type { ExrChannelToggle } from './exrTypes'
import { EXR_DEFAULT_LAYER_NAME } from './exrTypes'

export type ExrLayerGroup = {
  /** Raw OpenEXR layer key; empty string = default RGBA layer. */
  layerKey: string
  /** UI label (`RGBA` when layerKey is empty). */
  displayName: string
  /** Channel suffixes sorted R/X, G/Y, B/Z, A, … */
  channelSuffixes: string[]
  /** Full channel names as stored in EXR / exrs. */
  fullChannelNames: string[]
}

export function parseExrChannelFullName(fullName: string): { layerKey: string; suffix: string } {
  const dot = fullName.lastIndexOf('.')
  if (dot >= 0) {
    return { layerKey: fullName.slice(0, dot), suffix: fullName.slice(dot + 1) }
  }
  return { layerKey: '', suffix: fullName }
}

export function sortExrChannelSuffixes(channels: string[]): string[] {
  const rank = (c: string) => {
    const u = c.toUpperCase()
    if (u === 'R' || u === 'X') return 0
    if (u === 'G' || u === 'Y') return 1
    if (u === 'B' || u === 'Z') return 2
    if (u === 'A') return 3
    return 4
  }
  return [...channels].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

/** True when any channel uses `layer.suffix` naming (Arnold flat AOV or single data pass like `depth.Z`). */
export function isFlatMultiAovChannelLayout(fullNames: readonly string[]): boolean {
  for (const ch of fullNames) {
    if (ch.includes('.')) return true
  }
  return false
}

export function isExrStandardChannelSuffix(suffix: string): boolean {
  const u = suffix.toUpperCase()
  return u === 'R' || u === 'X' || u === 'G' || u === 'Y' || u === 'B' || u === 'Z' || u === 'A'
}

export function exrChannelKeyForSuffix(suffix: string): keyof ExrChannelToggle | null {
  const u = suffix.toUpperCase()
  if (u === 'R' || u === 'X') return 'r'
  if (u === 'G' || u === 'Y') return 'g'
  if (u === 'B' || u === 'Z') return 'b'
  if (u === 'A') return 'a'
  return null
}

export function partitionExrLayerChannelSuffixes(suffixes: readonly string[]): {
  toggleable: Array<{ suffix: string; key: keyof ExrChannelToggle }>
  custom: string[]
} {
  const toggleable: Array<{ suffix: string; key: keyof ExrChannelToggle }> = []
  const custom: string[] = []
  for (const suffix of suffixes) {
    const key = exrChannelKeyForSuffix(suffix)
    if (key) toggleable.push({ suffix, key })
    else custom.push(suffix)
  }
  return { toggleable, custom }
}

/** Group dotted channel names (`albedo.R`) or bare names (`R`) into layers. */
export function groupExrChannelFullNames(fullNames: readonly string[]): ExrLayerGroup[] {
  const suffixMap = new Map<string, Map<string, string>>()

  for (const fullName of fullNames) {
    const { layerKey, suffix } = parseExrChannelFullName(fullName)
    if (!suffixMap.has(layerKey)) suffixMap.set(layerKey, new Map())
    suffixMap.get(layerKey)!.set(suffix, fullName)
  }

  const groups: ExrLayerGroup[] = []
  for (const [layerKey, suffixToFull] of suffixMap) {
    const channelSuffixes = sortExrChannelSuffixes([...suffixToFull.keys()])
    const displayName = layerKey || EXR_DEFAULT_LAYER_NAME
    const fullChannelNames = channelSuffixes.map((s) => suffixToFull.get(s)!)
    groups.push({ layerKey, displayName, channelSuffixes, fullChannelNames })
  }

  groups.sort((a, b) => {
    if (a.displayName === EXR_DEFAULT_LAYER_NAME) return -1
    if (b.displayName === EXR_DEFAULT_LAYER_NAME) return 1
    return a.displayName.localeCompare(b.displayName)
  })

  return groups
}

export function groupExrHeaderChannelNames(channelNames: readonly string[]): ExrLayerGroup[] {
  return groupExrChannelFullNames(channelNames)
}
