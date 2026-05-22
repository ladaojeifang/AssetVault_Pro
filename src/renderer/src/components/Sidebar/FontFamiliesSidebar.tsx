import React, { useEffect, useState } from 'react'
import type { FontFamilyGroup } from '@/shared/fontTypes'
import { useApp } from '../../stores/AppContext'

export function FontFamiliesSidebar(): React.ReactElement | null {
  const { fileTypeFilter, openFontPreview, setFileTypeFilter } = useApp()
  const [groups, setGroups] = useState<FontFamilyGroup[]>([])
  const [open, setOpen] = useState(true)

  useEffect(() => {
    if (fileTypeFilter !== 'font') {
      setGroups([])
      return
    }
    void window.assetVaultAPI.fonts.listFamilyGroups().then(setGroups)
  }, [fileTypeFilter])

  if (fileTypeFilter !== 'font' || groups.length === 0) return null

  return (
    <div className="px-3 pb-3 border-b border-av-border/50">
      <button
        type="button"
        className="w-full flex items-center justify-between text-[11px] font-semibold text-av-text-muted uppercase tracking-wider py-1"
        onClick={() => setOpen((v) => !v)}
      >
        字体族
        <span className="text-[10px] normal-case">{groups.length}</span>
      </button>
      {open ? (
        <div className="mt-1 max-h-48 overflow-y-auto space-y-1 scrollbar-hide">
          {groups.map((g) => (
            <div key={g.familyKey} className="rounded-md bg-av-bg-primary/40 px-2 py-1.5">
              <p className="text-xs font-medium text-av-text-primary truncate">{g.familyName}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {g.assets.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    title={a.filename}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-av-bg-elevated hover:bg-av-bg-hover text-av-text-secondary truncate max-w-full"
                    onClick={() => {
                      setFileTypeFilter('font')
                      openFontPreview(a.id)
                    }}
                  >
                    {a.subfamilyName ?? a.filename.replace(/\.[^.]+$/, '')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
