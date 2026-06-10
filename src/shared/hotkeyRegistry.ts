/**
 * 快捷键运行时 API：按键解析、IPC 映射、设置页列表。
 */

import { HOTKEY_CATALOG, type HotkeyChord, type HotkeyDefinition, type HotkeyId } from './hotkeyCatalog'

export type { HotkeyChord, HotkeyDefinition, HotkeyId }
export { HOTKEY_CATALOG } from './hotkeyCatalog'

const HOTKEY_BY_ID = new Map<HotkeyId, HotkeyDefinition>(
  HOTKEY_CATALOG.map((def) => [def.id, def])
)

export const IPC_CHANNEL_TO_HOTKEY: Record<string, HotkeyId> = Object.fromEntries(
  HOTKEY_CATALOG.filter((d) => d.ipcChannel).map((d) => [d.ipcChannel!, d.id])
) as Record<string, HotkeyId>

export function getHotkeyDefinition(id: HotkeyId): HotkeyDefinition | undefined {
  return HOTKEY_BY_ID.get(id)
}

export function getHotkeyAccelerator(id: HotkeyId): string {
  return HOTKEY_BY_ID.get(id)?.accelerator ?? id
}

export function listSettingsHotkeys(): HotkeyDefinition[] {
  return HOTKEY_CATALOG.filter((d) => d.showInSettings)
}

export function formatAcceleratorForDisplay(accelerator: string): string {
  return accelerator
    .replace(/CommandOrCtrl/g, 'Ctrl')
    .replace(/\+/g, ' + ')
}

function chordMatches(
  chord: HotkeyChord,
  state: { ctrl: boolean; shift: boolean; alt: boolean; key: string }
): boolean {
  const wantCtrl = chord.ctrl === true
  const wantShift = chord.shift === true
  const wantAlt = chord.alt === true
  if (wantCtrl !== state.ctrl) return false
  if (wantShift !== state.shift) return false
  if (wantAlt !== state.alt) return false
  return chord.key.toLowerCase() === state.key
}

/**
 * Map a keydown event to a hotkey id.
 * `screen` is the current app screen id (e.g. `library`, `ai-canvas-editor`).
 */
export function resolveHotkeyId(e: KeyboardEvent, screen: string): HotkeyId | null {
  const state = {
    ctrl: e.ctrlKey || e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey,
    key: e.key.toLowerCase()
  }

  // Ctrl+R refresh (in addition to F5)
  if (state.ctrl && !state.shift && !state.alt && state.key === 'r') {
    return 'refresh'
  }

  // Backspace delete when not editing
  if (
    state.key === 'backspace' &&
    !(e.target instanceof HTMLElement && e.target.isContentEditable)
  ) {
    const def = HOTKEY_BY_ID.get('delete-selected')
    if (def && !def.blockedScreens?.includes(screen)) return 'delete-selected'
  }

  for (const def of HOTKEY_CATALOG) {
    if (def.blockedScreens?.includes(screen)) continue
    if (chordMatches(def.chord, state)) return def.id
  }

  return null
}
