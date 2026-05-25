import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clampColumnWidth,
  DEFAULT_LIST_COLUMN_WIDTHS,
  loadListColumnWidths,
  saveListColumnWidths
} from '../utils/listViewColumns'

type ResizeSession = {
  columnIndex: number
  startX: number
  startWidth: number
}

export function useListColumnWidths() {
  const [widths, setWidths] = useState<number[]>(() => loadListColumnWidths())
  const sessionRef = useRef<ResizeSession | null>(null)

  const persist = useCallback((next: number[]) => {
    saveListColumnWidths(next)
  }, [])

  const resetWidths = useCallback(() => {
    const defaults = [...DEFAULT_LIST_COLUMN_WIDTHS]
    setWidths(defaults)
    persist(defaults)
  }, [persist])

  const resetColumnWidth = useCallback(
    (columnIndex: number) => {
      setWidths((prev) => {
        const next = [...prev]
        next[columnIndex] = DEFAULT_LIST_COLUMN_WIDTHS[columnIndex] ?? next[columnIndex]
        persist(next)
        return next
      })
    },
    [persist]
  )

  const startResize = useCallback((columnIndex: number, clientX: number) => {
    sessionRef.current = {
      columnIndex,
      startX: clientX,
      startWidth: widths[columnIndex] ?? DEFAULT_LIST_COLUMN_WIDTHS[columnIndex]
    }
  }, [widths])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const s = sessionRef.current
      if (!s) return
      const delta = e.clientX - s.startX
      const nextW = clampColumnWidth(s.columnIndex, s.startWidth + delta)
      setWidths((prev) => {
        const next = [...prev]
        next[s.columnIndex] = nextW
        return next
      })
    }

    const onUp = () => {
      if (!sessionRef.current) return
      sessionRef.current = null
      setWidths((prev) => {
        persist(prev)
        return prev
      })
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [persist])

  const onResizePointerDown = useCallback(
    (columnIndex: number, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      startResize(columnIndex, e.clientX)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      const clear = () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
      window.addEventListener('mouseup', clear, { once: true })
    },
    [startResize]
  )

  return { widths, onResizePointerDown, resetColumnWidth, resetWidths }
}
