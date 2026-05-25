import { useEffect, useMemo, useState, type RefObject } from 'react'
import {
  buildGridTemplateColumns,
  listHeaderRowClass,
  listRowGridClass,
  listTableMinWidth
} from '../utils/listViewColumns'

/** 随窗口变宽时，由该列吸收剩余空间（名称） */
export function useListTableLayout(
  measureRef: RefObject<HTMLElement | null>,
  columnWidths: number[],
  enabled: boolean
) {
  const [viewportWidth, setViewportWidth] = useState(0)

  useEffect(() => {
    if (!enabled) {
      setViewportWidth(0)
      return
    }
    const el = measureRef.current
    if (!el) return

    const update = () => {
      setViewportWidth(Math.round(el.clientWidth))
    }
    update()

    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [measureRef, enabled])

  const minTableWidth = useMemo(() => listTableMinWidth(columnWidths), [columnWidths])

  const stretched = enabled && viewportWidth > 0 && viewportWidth >= minTableWidth

  const gridTemplateColumns = useMemo(
    () => buildGridTemplateColumns(columnWidths, stretched),
    [columnWidths, stretched]
  )

  const headerGridClass = useMemo(() => listHeaderRowClass(stretched), [stretched])
  const rowGridClass = useMemo(() => listRowGridClass(stretched), [stretched])

  return {
    stretched,
    gridTemplateColumns,
    minTableWidth,
    headerGridClass,
    rowGridClass
  }
}
