import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AssetItem } from '@/shared/types'
import { formatFileSize } from '@/shared/types'
import { useApp } from '../../stores/AppContext'
import { notify } from '../Common/notify'
import {
  isMarkdownPreviewAsset,
  loadMarkdownImageObjectUrl,
  markdownContentPath,
  revokeMarkdownImageObjectUrl
} from '../../utils/markdownPreview'
interface MarkdownPreviewPageProps {
  assetId: string
}

type ViewMode = 'split' | 'edit' | 'preview'

const MarkdownPreviewPage: React.FC<MarkdownPreviewPageProps> = ({ assetId }) => {
  const { t } = useTranslation('preview')
  const { assets, closeMarkdownPreview, refreshAssets, registerMarkdownPreviewCloser } = useApp()
  const [asset, setAsset] = useState<AssetItem | null>(() => assets.find((a) => a.id === assetId) ?? null)
  const [loadingAsset, setLoadingAsset] = useState(!asset)
  const [loadingText, setLoadingText] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('split')

  const contentPath = asset ? markdownContentPath(asset) : ''
  const dirty = draft !== saved

  useEffect(() => {
    let cancelled = false
    const cached = assets.find((a) => a.id === assetId)
    if (cached) {
      setAsset(cached)
      setLoadingAsset(false)
    } else {
      setLoadingAsset(true)
      void window.assetVaultAPI.assets
        .getById(assetId)
        .then((row) => {
          if (!cancelled) setAsset(row as AssetItem | null)
        })
        .finally(() => {
          if (!cancelled) setLoadingAsset(false)
        })
    }
    return () => {
      cancelled = true
    }
  }, [assetId, assets])

  useEffect(() => {
    if (!asset || !isMarkdownPreviewAsset(asset)) return
    const path = markdownContentPath(asset)
    if (!path) {
      setLoadError(t('pathResolveFailed'))
      setLoadingText(false)
      return
    }

    let cancelled = false
    setLoadingText(true)
    setLoadError(null)
    void window.assetVaultAPI.fs
      .readTextFile(path)
      .then((text) => {
        if (cancelled) return
        setDraft(text)
        setSaved(text)
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : String(e))
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingText(false)
      })

    return () => {
      cancelled = true
    }
  }, [asset?.id, asset?.filePath, asset?.resolvedFilePath])

  const handleBack = useCallback(() => {
    if (dirty && !confirm(t('unsavedLeave'))) return
    closeMarkdownPreview()
  }, [closeMarkdownPreview, dirty])

  const handleSave = useCallback(async () => {
    if (!asset || !contentPath || !dirty) return
    setSaving(true)
    try {
      const { bytes } = await window.assetVaultAPI.fs.writeTextFile(contentPath, draft, asset.id)
      setSaved(draft)
      notify.success(t('saved'))
      if (bytes !== asset.fileSize) {
        await refreshAssets()
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [asset, contentPath, dirty, draft, refreshAssets])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleBack()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        void handleSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleBack, handleSave])

  useEffect(() => {
    registerMarkdownPreviewCloser(handleBack)
    return () => registerMarkdownPreviewCloser(null)
  }, [handleBack, registerMarkdownPreviewCloser])

  const markdownComponents = useMemo(
    () => ({
      img: ({ src, alt, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) => (
        <MarkdownImage contentPath={contentPath} src={src} alt={alt} {...rest} />
      ),
      a: ({ href, children, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
          {children}
        </a>
      )
    }),
    [contentPath]
  )

  if (loadingAsset) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-av-text-muted">
        {t('loadingAsset')}
      </div>
    )
  }

  if (!asset || !isMarkdownPreviewAsset(asset)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-av-text-secondary">
        <p>{t('notFoundMarkdown')}</p>
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
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-medium text-av-text-primary truncate">{asset.filename}</span>
          <span className="text-[11px] text-av-text-muted truncate">
            Markdown · {formatFileSize(asset.fileSize)}
            {dirty ? t('unsaved') : ''}
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-av-border p-0.5 bg-av-bg-primary">
          {(['edit', 'split', 'preview'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                viewMode === mode
                  ? 'bg-av-accent-blue/20 text-av-accent-blue'
                  : 'text-av-text-muted hover:text-av-text-secondary'
              }`}
              onClick={() => setViewMode(mode)}
            >
              {mode === 'edit' ? t('edit') : mode === 'split' ? t('split') : t('preview')}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-primary text-sm py-1.5 px-3 disabled:opacity-40"
          disabled={!dirty || saving || loadingText}
          onClick={() => void handleSave()}
        >
          {saving ? t('saving') : t('save')}
        </button>
      </header>

      {loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-av-text-secondary">
          <p>{loadError}</p>
          <button type="button" className="btn-secondary text-sm" onClick={handleBack}>
            {t('back')}
          </button>
        </div>
      ) : loadingText ? (
        <div className="flex flex-1 items-center justify-center text-sm text-av-text-muted">{t('loadingFile')}</div>
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {(viewMode === 'edit' || viewMode === 'split') && (
            <section
              className={`flex flex-col min-h-0 border-av-border ${
                viewMode === 'split' ? 'flex-1 min-w-0 border-r' : 'flex-1 w-full'
              }`}
            >
              <div className="px-3 py-1.5 text-[11px] text-av-text-muted border-b border-av-border shrink-0">
                {t('editHint')}
              </div>
              <textarea
                className="flex-1 min-h-0 w-full resize-none bg-transparent px-4 py-3 text-sm text-av-text-primary font-mono leading-relaxed outline-none"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
                placeholder={t('markdownPlaceholder')}
              />
            </section>
          )}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <section
              className={`flex flex-col min-h-0 ${
                viewMode === 'split' ? 'flex-1 min-w-0' : 'flex-1 w-full'
              }`}
            >
              <div className="px-3 py-1.5 text-[11px] text-av-text-muted border-b border-av-border shrink-0">
                {t('preview')}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 av-markdown-body">
                {draft.trim() ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                    urlTransform={(url, key) => {
                      if (
                        key === 'src' &&
                        (url.startsWith('./') ||
                          url.startsWith('../') ||
                          (!url.includes('://') && !url.startsWith('data:')))
                      ) {
                        return url
                      }
                      return defaultUrlTransform(url)
                    }}
                  >
                    {draft}
                  </ReactMarkdown>
                ) : (
                  <p className="text-sm text-av-text-muted">{t('noContent')}</p>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

function MarkdownImage({
  contentPath,
  src,
  alt,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement> & { contentPath: string }) {
  const { t } = useTranslation('preview')
  const [objectUrl, setObjectUrl] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const srcStr = typeof src === 'string' ? src : undefined

  useEffect(() => {
    let cancelled = false
    let createdUrl: string | undefined
    setStatus(srcStr ? 'loading' : 'idle')
    setObjectUrl(undefined)

    if (!srcStr) return

    void loadMarkdownImageObjectUrl(contentPath, srcStr).then((url) => {
      if (cancelled) {
        revokeMarkdownImageObjectUrl(url)
        return
      }
      createdUrl = url
      if (url) {
        setObjectUrl(url)
        setStatus('ready')
      } else {
        setStatus('error')
      }
    })

    return () => {
      cancelled = true
      revokeMarkdownImageObjectUrl(createdUrl)
    }
  }, [contentPath, srcStr])

  if (!srcStr) return null

  if (status === 'loading') {
    return (
      <span className="inline-block my-2 px-2 py-1 text-xs text-av-text-muted">{t('loadingImage')}</span>
    )
  }

  if (status === 'error' || !objectUrl) {
    return (
      <span
        className="inline-flex items-center gap-1 my-2 px-2 py-1 text-xs text-av-text-muted bg-av-bg-secondary rounded border border-av-border"
        title={srcStr}
      >
        {t('imageLoadFailed', { src: srcStr })}
      </span>
    )
  }

  return (
    <img
      {...rest}
      src={objectUrl}
      alt={alt ?? ''}
      className="max-w-full h-auto rounded-md my-2"
      loading="lazy"
      onError={() => setStatus('error')}
    />
  )
}

export default MarkdownPreviewPage
