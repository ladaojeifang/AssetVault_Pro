import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AssetItem } from '@/shared/types'
import type { FontFaceSummary, FontPreviewRenderRequest } from '@/shared/fontTypes'
import { FONT_PREVIEW_TEMPLATES } from '@/shared/fontSettings'
import { formatFileSize } from '@/shared/types'
import { useApp } from '../../stores/AppContext'
import { useFontPreviewRender } from '../../hooks/useFontPreviewRender'
import {
  defaultPreviewText,
  fontFamilyLabel,
  parseFontMetadataFromAsset
} from '../../utils/fontAssetMeta'
import { notify } from '../Common/notify'
import { canAssetPreview } from '@/shared/assetPreviewRegistry'

interface FontPreviewPageProps {
  assetId: string
}

const PREVIEW_W = 1200
const PREVIEW_H = 720

const FontPreviewPage: React.FC<FontPreviewPageProps> = ({ assetId }) => {
  const { t } = useTranslation('preview')
  const { assets, closeFontPreview, openFontPreview, refreshAssets } = useApp()
  const [asset, setAsset] = useState<AssetItem | null>(() => assets.find((a) => a.id === assetId) ?? null)
  const [loadingAsset, setLoadingAsset] = useState(!asset)
  const [faces, setFaces] = useState<FontFaceSummary[]>([])
  const [ttcIndex, setTtcIndex] = useState(0)
  const [compareAssetId, setCompareAssetId] = useState<string | null>(null)
  const [compareAsset, setCompareAsset] = useState<AssetItem | null>(null)
  const [familyOptions, setFamilyOptions] = useState<AssetItem[]>([])

  const meta = useMemo(() => parseFontMetadataFromAsset(asset), [asset])
  const label = asset ? fontFamilyLabel(asset, meta) : 'Font'

  const [text, setText] = useState('')
  const [fontSize, setFontSize] = useState(48)
  const [lineHeight, setLineHeight] = useState(1.45)
  const [letterSpacing, setLetterSpacing] = useState(0)
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center')
  const [lightBg, setLightBg] = useState(false)

  const bg = lightBg ? '#f8fafc' : '#12141c'
  const fg = lightBg ? '#0f172a' : '#f1f5f9'

  const renderRequest: FontPreviewRenderRequest | null = useMemo(() => {
    if (!asset) return null
    return {
      filePath: asset.filePath,
      sampleText: text,
      ttcIndex,
      canvasWidth: PREVIEW_W,
      canvasHeight: PREVIEW_H,
      fontSizePx: fontSize,
      lineHeight,
      letterSpacingPx: letterSpacing,
      textAlign,
      backgroundColor: bg,
      textColor: fg
    }
  }, [asset, text, ttcIndex, fontSize, lineHeight, letterSpacing, textAlign, bg, fg])

  const compareRequest: FontPreviewRenderRequest | null = useMemo(() => {
    if (!compareAsset) return null
    const cMeta = parseFontMetadataFromAsset(compareAsset)
    return {
      filePath: compareAsset.filePath,
      sampleText: text,
      ttcIndex: cMeta?.ttcIndex ?? 0,
      canvasWidth: PREVIEW_W,
      canvasHeight: PREVIEW_H / 2,
      fontSizePx: fontSize,
      lineHeight,
      letterSpacingPx: letterSpacing,
      textAlign,
      backgroundColor: bg,
      textColor: fg
    }
  }, [compareAsset, text, fontSize, lineHeight, letterSpacing, textAlign, bg, fg])

  const { dataUrl, loading, error } = useFontPreviewRender(renderRequest)
  const comparePreview = useFontPreviewRender(compareRequest)

  useEffect(() => {
    let cancelled = false
    const cached = assets.find((a) => a.id === assetId)
    if (cached) {
      setAsset(cached)
      setLoadingAsset(false)
      return
    }
    setLoadingAsset(true)
    void window.assetVaultAPI.assets
      .getById(assetId)
      .then((row) => {
        if (!cancelled) setAsset(row as AssetItem | null)
      })
      .finally(() => {
        if (!cancelled) setLoadingAsset(false)
      })
    return () => {
      cancelled = true
    }
  }, [assetId, assets])

  useEffect(() => {
    if (!asset) return
    setText(defaultPreviewText(asset, meta))
    setTtcIndex(meta?.ttcIndex ?? 0)
    void window.assetVaultAPI.fonts.listFaces(asset.id).then(setFaces)
    void window.assetVaultAPI.fonts.listFamilyGroups().then((groups) => {
      const g = groups.find((x) =>
        x.assets.some((a) => a.id === asset.id)
      )
      if (!g) return
      const ids = g.assets.map((a) => a.id)
      setFamilyOptions(assets.filter((a) => ids.includes(a.id) && a.id !== asset.id))
    })
  }, [asset?.id])

  useEffect(() => {
    if (!compareAssetId) {
      setCompareAsset(null)
      return
    }
    void window.assetVaultAPI.assets.getById(compareAssetId).then((row) => {
      setCompareAsset(row as AssetItem | null)
    })
  }, [compareAssetId])

  const handleFaceChange = useCallback(
    async (index: number) => {
      if (!asset) return
      setTtcIndex(index)
      const res = await window.assetVaultAPI.fonts.updateFaceIndex(asset.id, index, true)
      if (res.ok) {
        await refreshAssets()
        notify.success(t('fontPreview.ttcSwitched'))
      } else {
        notify.error(res.error)
      }
    },
    [asset, refreshAssets]
  )

  const handleBack = useCallback(() => closeFontPreview(), [closeFontPreview])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleBack])

  const handleInstall = async () => {
    if (!asset) return
    const res = await window.assetVaultAPI.fonts.installToSystem(asset.id)
    if (res.ok) notify.success(t('fontPreview.installedUserDir', { dest: res.dest ? `\n${res.dest}` : '' }))
    else notify.error(res.error)
  }

  const handleExport = async () => {
    if (!asset) return
    const res = await window.assetVaultAPI.fonts.exportCopy(asset.id)
    if (res.ok) notify.success(t('fontPreview.exported'))
    else if (res.error !== 'cancelled') notify.error(res.error)
  }

  if (loadingAsset) {
    return (
      <div className="flex flex-1 items-center justify-center text-av-text-secondary text-sm">
        {t('loadingFont')}
      </div>
    )
  }

  if (!asset || !canAssetPreview(asset, 'font')) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-av-text-secondary">
        <p>{t('notFoundFont')}</p>
        <button type="button" className="btn-secondary text-sm" onClick={handleBack}>
          {t('backToLibrary')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-av-bg-primary">
      <header className="flex items-center gap-3 px-4 h-12 border-b border-av-border bg-av-bg-secondary shrink-0">
        <button type="button" className="btn-ghost p-2 rounded-lg" onClick={handleBack} title={t('backTitle')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold truncate">{label}</h1>
          <p className="text-[11px] text-av-text-muted truncate">
            {asset.filename} · {formatFileSize(asset.fileSize)}
            {meta?.unicodeCoverage
              ? ` · ${meta.unicodeCoverage.totalCodePoints.toLocaleString()} code points`
              : ''}
          </p>
        </div>
        <button type="button" className="btn-secondary text-xs" onClick={() => void handleExport()}>
          {t('export')}
        </button>
        <button type="button" className="btn-secondary text-xs" onClick={() => void handleInstall()}>
          {t('installSystem')}
        </button>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="w-[320px] border-r border-av-border bg-av-bg-secondary overflow-y-auto shrink-0">
          <div className="p-4 space-y-4">
            {faces.length > 1 ? (
              <div>
                <label className="block text-xs font-medium text-av-text-muted mb-2">{t('fontPreview.ttcWeight')}</label>
                <select
                  className="input-base w-full text-xs"
                  value={ttcIndex}
                  onChange={(e) => void handleFaceChange(Number(e.target.value))}
                >
                  {faces.map((f) => (
                    <option key={f.index} value={f.index}>
                      #{f.index + 1} {f.fullName ?? f.subfamilyName ?? f.familyName}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label className="block text-xs font-medium text-av-text-muted mb-2">{t('fontPreview.previewText')}</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                spellCheck={false}
                className="w-full resize-y min-h-[100px] px-3 py-2 rounded-lg bg-av-bg-tertiary border border-av-border text-sm"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-av-text-muted mb-2">{t('fontPreview.sceneTemplates')}</p>
              <div className="flex flex-wrap gap-1.5">
                {FONT_PREVIEW_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    className="px-2 py-1 rounded-md text-[11px] bg-av-bg-elevated border border-av-border hover:bg-av-bg-hover"
                    onClick={() => setText(tpl.text)}
                  >
                    {t(`fontPreview.templates.${tpl.id}`, { defaultValue: tpl.label })}
                  </button>
                ))}
              </div>
            </div>

            <Slider label={t('fontPreview.fontSize')} value={fontSize} min={12} max={160} onChange={setFontSize} suffix="px" />
            <Slider label={t('fontPreview.lineHeight')} value={lineHeight} min={1} max={2.5} step={0.05} onChange={setLineHeight} />
            <Slider label={t('fontPreview.letterSpacing')} value={letterSpacing} min={-2} max={20} step={0.5} onChange={setLetterSpacing} suffix="px" />

            <div>
              <label className="block text-xs font-medium text-av-text-muted mb-2">{t('fontPreview.align')}</label>
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`flex-1 py-1.5 text-xs rounded-md border ${
                      textAlign === a ? 'bg-av-accent-blue/15 border-av-accent-blue/40' : 'border-av-border'
                    }`}
                    onClick={() => setTextAlign(a)}
                  >
                    {a === 'left' ? t('fontPreview.alignLeft') : a === 'center' ? t('fontPreview.alignCenter') : t('fontPreview.alignRight')}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-av-text-secondary cursor-pointer">
              <input type="checkbox" checked={lightBg} onChange={(e) => setLightBg(e.target.checked)} />
              {t('fontPreview.lightBackground')}
            </label>

            {familyOptions.length > 0 ? (
              <div>
                <label className="block text-xs font-medium text-av-text-muted mb-2">{t('fontPreview.compareFont')}</label>
                <select
                  className="input-base w-full text-xs"
                  value={compareAssetId ?? ''}
                  onChange={(e) => setCompareAssetId(e.target.value || null)}
                >
                  <option value="">{t('fontPreview.noCompare')}</option>
                  {familyOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.filename}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {meta?.variationAxes?.length ? (
              <div className="pt-2 border-t border-av-border">
                <p className="text-xs font-medium text-av-text-muted mb-1">{t('fontPreview.variableAxes')}</p>
                {meta.variationAxes.map((ax) => (
                  <p key={ax.tag} className="text-[11px] text-av-text-secondary font-mono">
                    {ax.tag} {ax.min}–{ax.max} ({t('fontPreview.axisDefault', { value: ax.default })})
                  </p>
                ))}
              </div>
            ) : null}

            {meta?.unicodeCoverage ? (
              <div className="pt-2 border-t border-av-border text-[11px] text-av-text-secondary space-y-0.5">
                <p className="text-xs font-medium text-av-text-muted mb-1">{t('fontPreview.charCoverage')}</p>
                <p>Latin: {meta.unicodeCoverage.latinBasic}</p>
                <p>CJK: {meta.unicodeCoverage.cjkUnified}</p>
                <p>Digits: {meta.unicodeCoverage.digits}</p>
              </div>
            ) : null}
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-auto p-6" style={{ backgroundColor: bg }}>
          {loading && !dataUrl ? (
            <div className="h-full flex items-center justify-center text-sm" style={{ color: fg }}>
              {t('fontPreview.rendering')}
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm" style={{ color: fg }}>
                {t('fontPreview.renderFailed')}
              </p>
              <p className="text-xs opacity-70">{error}</p>
              <p className="text-xs opacity-60">{t('fontPreview.renderFailedHint')}</p>
            </div>
          ) : (
            <div className={`mx-auto space-y-4 ${compareAsset ? 'max-w-[1200px]' : 'max-w-[1200px]'}`}>
              {dataUrl ? (
                <img src={dataUrl} alt="" className="w-full h-auto rounded-xl border border-white/10 shadow-lg" />
              ) : null}
              {compareAsset && comparePreview.dataUrl ? (
                <div>
                  <p className="text-xs mb-2 opacity-70" style={{ color: fg }}>
                    {t('fontPreview.compareLabel', { name: compareAsset.filename })}
                  </p>
                  <img
                    src={comparePreview.dataUrl}
                    alt=""
                    className="w-full h-auto rounded-xl border border-white/10 shadow-lg"
                  />
                </div>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <label className="text-xs font-medium text-av-text-muted">{label}</label>
        <span className="text-xs tabular-nums text-av-text-secondary">
          {step < 1 ? value.toFixed(2) : value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-av-accent-blue"
      />
    </div>
  )
}

export default FontPreviewPage
