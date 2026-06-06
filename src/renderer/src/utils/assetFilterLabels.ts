import type { TFunction } from 'i18next'
import type { DatePreset, SizePreset } from '@/shared/assetFilters'
import { DATE_PRESET_OPTIONS, SIZE_PRESET_OPTIONS } from '@/shared/assetFilters'

export function translateSizePresetLabel(t: TFunction<'assets'>, id: SizePreset): string {
  return t(`sizePresets.${id}`)
}

export function translateDatePresetLabel(t: TFunction<'assets'>, id: DatePreset): string {
  return t(`datePresets.${id}`)
}

export function getTranslatedSizePresetOptions(t: TFunction<'assets'>) {
  return SIZE_PRESET_OPTIONS.map((o) => ({
    id: o.id,
    label: translateSizePresetLabel(t, o.id)
  }))
}

export function getTranslatedDatePresetOptions(t: TFunction<'assets'>) {
  return DATE_PRESET_OPTIONS.map((o) => ({
    id: o.id,
    label: translateDatePresetLabel(t, o.id)
  }))
}
