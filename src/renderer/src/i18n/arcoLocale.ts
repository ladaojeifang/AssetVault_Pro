import zhCN from '@arco-design/web-react/es/locale/zh-CN'
import enUS from '@arco-design/web-react/es/locale/en-US'
import type { AppLocale } from '@/shared/appLocale'

export function getArcoLocalePack(locale: AppLocale) {
  return locale === 'en-US' ? enUS : zhCN
}
