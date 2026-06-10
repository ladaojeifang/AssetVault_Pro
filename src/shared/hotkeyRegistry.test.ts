import { describe, expect, it } from 'vitest'
import { getHotkeyAccelerator, resolveHotkeyId } from './hotkeyRegistry'

function keyEvent(init: {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  target?: EventTarget | null
}): KeyboardEvent {
  return {
    key: init.key,
    ctrlKey: init.ctrlKey ?? false,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
    metaKey: init.ctrlKey ?? false,
    target: init.target ?? null
  } as KeyboardEvent
}

describe('hotkeyRegistry', () => {
  it('resolves Ctrl+K to search', () => {
    expect(resolveHotkeyId(keyEvent({ key: 'k', ctrlKey: true }), 'library')).toBe('search')
  })

  it('blocks delete on ai canvas editor', () => {
    expect(resolveHotkeyId(keyEvent({ key: 'Delete' }), 'ai-canvas-editor')).toBeNull()
    expect(resolveHotkeyId(keyEvent({ key: 'Delete' }), 'library')).toBe('delete-selected')
  })

  it('exposes accelerators for context menus', () => {
    expect(getHotkeyAccelerator('custom-thumb-file')).toBe('Ctrl+Alt+T')
  })
})
