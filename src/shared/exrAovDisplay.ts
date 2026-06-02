/** How to map float AOV samples to 8-bit preview pixels. */

export type ExrAovDisplayMode = 'hdr' | 'vector' | 'data' | 'crypto'

const VECTOR_LAYER_NAMES = new Set([
  'n',
  'normal',
  'normals',
  'motionvector',
  'motion_vector',
  'mv',
  'velocity'
])

/** Matched as whole layer name or `_keyword` / `keyword_` segment — not substring. */
const DATA_LAYER_KEYWORDS = [
  'depth',
  'opacity',
  'alpha',
  'mask',
  'shadow',
  'ao',
  'raycount',
  'cputime',
  'highlight',
  'id',
  'volume_z',
  'volume_opacity'
]

/** Sample range outside this ⇒ not a unit normal / motion vector. */
export const VECTOR_SAMPLE_RANGE = { min: -1.5, max: 1.5 }

/** Layer name equals keyword or contains it as a `.` / `_` delimited segment. */
export function layerNameMatchesDataKeyword(layerName: string, keyword: string): boolean {
  const name = layerName.trim().toLowerCase()
  const key = keyword.toLowerCase()
  if (name === key) return true
  return (
    name.startsWith(`${key}_`) ||
    name.startsWith(`${key}.`) ||
    name.endsWith(`_${key}`) ||
    name.endsWith(`.${key}`) ||
    name.includes(`_${key}_`) ||
    name.includes(`_${key}.`) ||
    name.includes(`.${key}_`) ||
    name.includes(`.${key}.`)
  )
}

/** Layer name equals keyword or contains it as a `.` / `_` delimited segment. */
export function layerNameMatchesSegmentKeyword(layerName: string, keyword: string): boolean {
  return layerNameMatchesDataKeyword(layerName, keyword)
}

function isCryptoLayerName(name: string): boolean {
  return (
    layerNameMatchesSegmentKeyword(name, 'crypto') ||
    name.includes('cryptomatte') ||
    name.includes('crypto_')
  )
}

function isNormalVectorLayerName(name: string): boolean {
  if (name.includes('albedo')) return false
  return (
    VECTOR_LAYER_NAMES.has(name) ||
    name === 'n' ||
    name.endsWith('_n') ||
    layerNameMatchesSegmentKeyword(name, 'normal') ||
    layerNameMatchesSegmentKeyword(name, 'normals')
  )
}

export function detectExrAovDisplayMode(
  layerName: string,
  channelSuffixes: readonly string[]
): ExrAovDisplayMode {
  const name = layerName.trim().toLowerCase()
  const suffixes = new Set(channelSuffixes.map((c) => c.toUpperCase()))

  if (isCryptoLayerName(name)) return 'crypto'

  if (isNormalVectorLayerName(name)) return 'vector'
  if (name.includes('motionvector') || name.includes('motion_vector')) return 'vector'

  if (name === 'p' || name === 'position') return 'vector'

  if (
    name === 'z' ||
    DATA_LAYER_KEYWORDS.some((k) => layerNameMatchesDataKeyword(name, k))
  ) {
    return 'data'
  }

  const vectorLike =
    suffixes.has('X') && suffixes.has('Y') && suffixes.has('Z') && !suffixes.has('R')

  if (vectorLike && (name === 'n' || name.endsWith('_n'))) return 'vector'

  if (suffixes.size === 1 || (suffixes.has('R') && !suffixes.has('G') && !suffixes.has('B'))) {
    return 'data'
  }

  return 'hdr'
}

/** Downgrade vector → data when samples look like world position / depth, not [-1,1] vectors. */
export function refineExrAovDisplayMode(
  mode: ExrAovDisplayMode,
  sampleMin: number,
  sampleMax: number
): ExrAovDisplayMode {
  if (mode !== 'vector') return mode
  if (sampleMin < VECTOR_SAMPLE_RANGE.min || sampleMax > VECTOR_SAMPLE_RANGE.max) {
    return 'data'
  }
  return mode
}

export function tonemapHdrSample(value: number, exposure: number): number {
  const v = Math.max(0, value * exposure)
  const mapped = v / (1 + v)
  return Math.round(Math.min(1, mapped) * 255)
}

/** Map unit-vector components in roughly [-1, 1] to RGB. */
export function mapVectorSample(value: number): number {
  return Math.round(Math.min(255, Math.max(0, (value * 0.5 + 0.5) * 255)))
}

/** Crypto mattes: display hash RGB directly (typically already 0–1). */
export function mapCryptoSample(value: number): number {
  if (value >= 0 && value <= 1) {
    return Math.round(value * 255)
  }
  return mapVectorSample(value)
}

export function mapDataSampleNormalized(value: number): number {
  return Math.round(Math.min(255, Math.max(0, value * 255)))
}

export function isVectorBackgroundZero(r: number, g: number, b: number, epsilon = 1e-4): boolean {
  return Math.abs(r) < epsilon && Math.abs(g) < epsilon && Math.abs(b) < epsilon
}

export function exposureAppliesToDisplayMode(mode: ExrAovDisplayMode): boolean {
  return mode === 'hdr'
}
