/**
 * 键盘快捷键配置（单一数据源）
 *
 * `chord` 用于解析按键；`accelerator` 用于 UI 展示；`i18nKey` 对应 settings:shortcuts.items.*
 */

export type HotkeyId =
  | 'search'
  | 'import-files'
  | 'import-folder'
  | 'toggle-sidebar'
  | 'toggle-detail'
  | 'view-grid'
  | 'view-list'
  | 'select-all'
  | 'delete-selected'
  | 'refresh'
  | 'preview'
  | 'open-settings'
  | 'focus-library-switcher'
  | 'custom-thumb-file'
  | 'custom-thumb-clipboard'
  | 'refresh-thumbnail'

export interface HotkeyChord {
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  key: string
}

export interface HotkeyDefinition {
  id: HotkeyId
  chord: HotkeyChord
  /** Human-readable label, e.g. Ctrl+K */
  accelerator: string
  /** settings.json → shortcuts.items.<key> */
  i18nKey: string
  ipcChannel?: string
  showInSettings?: boolean
  /** Skip on these app screens (e.g. ai-canvas-editor) */
  blockedScreens?: readonly string[]
}

export const HOTKEY_CATALOG: readonly HotkeyDefinition[] = [
  {
    id: 'search',
    chord: { ctrl: true, key: 'k' },
    accelerator: 'Ctrl+K',
    i18nKey: 'search',
    ipcChannel: 'hotkey:focus-search',
    showInSettings: true
  },
  {
    id: 'import-files',
    chord: { ctrl: true, key: 'i' },
    accelerator: 'Ctrl+I',
    i18nKey: 'importFiles',
    ipcChannel: 'hotkey:import-files',
    showInSettings: true
  },
  {
    id: 'import-folder',
    chord: { ctrl: true, shift: true, key: 'o' },
    accelerator: 'Ctrl+Shift+O',
    i18nKey: 'importFolder',
    ipcChannel: 'hotkey:import-folder',
    showInSettings: true
  },
  {
    id: 'toggle-sidebar',
    chord: { ctrl: true, key: 'b' },
    accelerator: 'Ctrl+B',
    i18nKey: 'toggleSidebar',
    ipcChannel: 'hotkey:toggle-sidebar',
    showInSettings: true
  },
  {
    id: 'toggle-detail',
    chord: { ctrl: true, key: 'd' },
    accelerator: 'Ctrl+D',
    i18nKey: 'toggleDetail',
    ipcChannel: 'hotkey:toggle-detail',
    showInSettings: true
  },
  {
    id: 'focus-library-switcher',
    chord: { ctrl: true, key: 'l' },
    accelerator: 'Ctrl+L',
    i18nKey: 'librarySwitcher',
    showInSettings: true
  },
  {
    id: 'view-grid',
    chord: { ctrl: true, key: 'g' },
    accelerator: 'Ctrl+G',
    i18nKey: 'viewGrid',
    ipcChannel: 'hotkey:view-grid'
  },
  {
    id: 'view-list',
    chord: { ctrl: true, shift: true, key: 'g' },
    accelerator: 'Ctrl+Shift+G',
    i18nKey: 'viewList',
    ipcChannel: 'hotkey:view-list'
  },
  {
    id: 'select-all',
    chord: { ctrl: true, key: 'a' },
    accelerator: 'Ctrl+A',
    i18nKey: 'selectAll',
    ipcChannel: 'hotkey:select-all'
  },
  {
    id: 'delete-selected',
    chord: { key: 'delete' },
    accelerator: 'Delete',
    i18nKey: 'deleteSelected',
    ipcChannel: 'hotkey:delete-selected',
    showInSettings: true,
    blockedScreens: ['ai-canvas-editor']
  },
  {
    id: 'refresh',
    chord: { key: 'f5' },
    accelerator: 'F5',
    i18nKey: 'refresh',
    ipcChannel: 'hotkey:refresh',
    showInSettings: true
  },
  {
    id: 'preview',
    chord: { key: ' ' },
    accelerator: 'Space',
    i18nKey: 'preview',
    ipcChannel: 'hotkey:preview'
  },
  {
    id: 'open-settings',
    chord: { ctrl: true, key: ',' },
    accelerator: 'Ctrl+,',
    i18nKey: 'openSettings',
    ipcChannel: 'hotkey:open-settings'
  },
  {
    id: 'custom-thumb-file',
    chord: { ctrl: true, alt: true, key: 't' },
    accelerator: 'Ctrl+Alt+T',
    i18nKey: 'customThumbFile'
  },
  {
    id: 'custom-thumb-clipboard',
    chord: { ctrl: true, alt: true, shift: true, key: 't' },
    accelerator: 'Ctrl+Shift+Alt+T',
    i18nKey: 'customThumbClipboard'
  },
  {
    id: 'refresh-thumbnail',
    chord: { ctrl: true, alt: true, key: 'r' },
    accelerator: 'Ctrl+Alt+R',
    i18nKey: 'refreshThumbnail'
  }
]
