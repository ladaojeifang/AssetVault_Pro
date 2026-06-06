import type { TFunction } from 'i18next'
import type { ColorBucket } from '@/shared/colorBucket'
import { COLOR_BUCKET_OPTIONS } from '@/shared/colorBucket'

export function colorBucketLabel(t: TFunction<'assets'>, id: ColorBucket): string {
  return t(`colorBuckets.${id}`)
}

export function getColorBucketOptions(t: TFunction<'assets'>) {
  return COLOR_BUCKET_OPTIONS.map((opt) => ({
    ...opt,
    label: colorBucketLabel(t, opt.id)
  }))
}
