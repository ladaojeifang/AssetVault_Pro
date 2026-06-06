import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { DEFAULT_APP_LOCALE, type AppLocale } from '@/shared/appLocale'

import zhCommon from './locales/zh-CN/common.json'
import zhLayout from './locales/zh-CN/layout.json'
import zhSettings from './locales/zh-CN/settings.json'
import zhToolbar from './locales/zh-CN/toolbar.json'
import zhImport from './locales/zh-CN/import.json'
import zhSidebar from './locales/zh-CN/sidebar.json'
import zhErrors from './locales/zh-CN/errors.json'
import zhAssets from './locales/zh-CN/assets.json'
import zhDetail from './locales/zh-CN/detail.json'
import zhLibrary from './locales/zh-CN/library.json'
import zhPreview from './locales/zh-CN/preview.json'

import enCommon from './locales/en-US/common.json'
import enLayout from './locales/en-US/layout.json'
import enSettings from './locales/en-US/settings.json'
import enToolbar from './locales/en-US/toolbar.json'
import enImport from './locales/en-US/import.json'
import enSidebar from './locales/en-US/sidebar.json'
import enErrors from './locales/en-US/errors.json'
import enAssets from './locales/en-US/assets.json'
import enDetail from './locales/en-US/detail.json'
import enLibrary from './locales/en-US/library.json'
import enPreview from './locales/en-US/preview.json'

const resources = {
  'zh-CN': {
    common: zhCommon,
    layout: zhLayout,
    settings: zhSettings,
    toolbar: zhToolbar,
    import: zhImport,
    sidebar: zhSidebar,
    errors: zhErrors,
    assets: zhAssets,
    detail: zhDetail,
    library: zhLibrary,
    preview: zhPreview
  },
  'en-US': {
    common: enCommon,
    layout: enLayout,
    settings: enSettings,
    toolbar: enToolbar,
    import: enImport,
    sidebar: enSidebar,
    errors: enErrors,
    assets: enAssets,
    detail: enDetail,
    library: enLibrary,
    preview: enPreview
  }
} as const

let initialized = false

export function initI18n(locale: AppLocale = DEFAULT_APP_LOCALE): typeof i18n {
  if (initialized) {
    void i18n.changeLanguage(locale)
    return i18n
  }
  initialized = true
  void i18n.use(initReactI18next).init({
    resources,
    lng: locale,
    fallbackLng: DEFAULT_APP_LOCALE,
    defaultNS: 'common',
    ns: [
      'common',
      'layout',
      'settings',
      'toolbar',
      'import',
      'sidebar',
      'errors',
      'assets',
      'detail',
      'library',
      'preview'
    ],
    interpolation: { escapeValue: false },
    returnEmptyString: false
  })
  return i18n
}

export { i18n }
