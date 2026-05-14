import React, { useState, useCallback, useEffect } from 'react'
import { useApp } from '../../stores/AppContext'
import { resolveDroppedFilePaths } from '../../utils/resolveDroppedFilePaths'

function dataTransferHasFiles(dt: DataTransfer | null): boolean {
  if (!dt?.types) return false
  return Array.from(dt.types).some((t) => t === 'Files' || t === 'application/x-moz-file')
}

/**
 * Global drag/drop import. Uses capture-phase window listeners so drops work
 * even when a full-screen wrapper uses pointer-events-none (events hit children first).
 */
const DropZone: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false)
  const [dragFileCount, setDragFileCount] = useState(0)
  const { startImport, stopImport, refreshAssets, currentFolderId } = useApp()

  const runImportFromDataTransfer = useCallback(
    async (dt: DataTransfer) => {
      const files = Array.from(dt.files)
      if (files.length === 0) return

      const paths = resolveDroppedFilePaths(files)
      if (paths.length === 0) {
        console.warn('[DropZone] No file paths resolved from drop (sandbox needs getPathForFile)')
        return
      }

      const filePaths: string[] = []
      const folderPaths: string[] = []

      for (const p of paths) {
        const kind = await window.assetVaultAPI.fs.pathKind(p)
        if (kind === 'directory') folderPaths.push(p)
        else if (kind === 'file') filePaths.push(p)
      }

      try {
        startImport()
        for (const folder of folderPaths) {
          await window.assetVaultAPI.assets.importFolder(folder)
        }
        if (filePaths.length > 0) {
          await window.assetVaultAPI.assets.import(filePaths, currentFolderId || undefined)
        }
        await refreshAssets()
      } catch (error) {
        console.error('Drop import error:', error)
      } finally {
        stopImport()
      }
    },
    [startImport, stopImport, refreshAssets, currentFolderId]
  )

  useEffect(() => {
    const clearOverlay = () => {
      setIsDragging(false)
      setDragFileCount(0)
    }

    const onDragEnter = (e: DragEvent) => {
      if (!dataTransferHasFiles(e.dataTransfer)) return
      e.preventDefault()
      setIsDragging(true)
      const n = e.dataTransfer?.items?.length ?? e.dataTransfer?.files?.length ?? 0
      if (n > 0) setDragFileCount(n)
    }

    const onDragOver = (e: DragEvent) => {
      if (!dataTransferHasFiles(e.dataTransfer)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }

    const onDrop = (e: DragEvent) => {
      if (!dataTransferHasFiles(e.dataTransfer)) return
      e.preventDefault()
      clearOverlay()
      if (e.dataTransfer) void runImportFromDataTransfer(e.dataTransfer)
    }

    const onDragEnd = () => {
      clearOverlay()
    }

    window.addEventListener('dragenter', onDragEnter, true)
    window.addEventListener('dragover', onDragOver, true)
    window.addEventListener('drop', onDrop, true)
    window.addEventListener('dragend', onDragEnd, true)

    return () => {
      window.removeEventListener('dragenter', onDragEnter, true)
      window.removeEventListener('dragover', onDragOver, true)
      window.removeEventListener('drop', onDrop, true)
      window.removeEventListener('dragend', onDragEnd, true)
    }
  }, [runImportFromDataTransfer])

  return (
    <>
      {isDragging && (
        <div
          id="drop-overlay"
          className="fixed inset-0 z-[9999] bg-av-accent-blue/10 border-2 border-dashed border-av-accent-blue/50 backdrop-blur-sm flex items-center justify-center pointer-events-none transition-opacity duration-150"
          aria-hidden
        >
          <div className="text-center space-y-4 pointer-events-none">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-av-accent-blue/20 border-2 border-dashed border-av-accent-blue/40 flex items-center justify-center">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-av-accent-blue animate-pulse"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </div>
            <div>
              <p className="text-xl font-semibold text-av-text-primary">松开以导入</p>
              <p className="text-sm text-av-text-secondary mt-1">
                {dragFileCount > 0
                  ? `${dragFileCount} 个条目将加入资源库`
                  : '将文件或文件夹拖入窗口'}
              </p>
            </div>
            <div className="flex items-center justify-center gap-4 text-xs text-av-text-muted">
              <span>图片</span>
              <span>视频</span>
              <span>音频</span>
              <span>字体</span>
              <span>文档</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default DropZone
