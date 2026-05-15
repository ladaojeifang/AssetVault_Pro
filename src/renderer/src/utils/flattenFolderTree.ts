import type { FolderItem } from '@/shared/types'

export type FlatFolderRow = {
  id: string
  name: string
  depth: number
  color: string
  icon: string | null | undefined
}

export function flattenFolderTree(nodes: FolderItem[], depth = 0): FlatFolderRow[] {
  const out: FlatFolderRow[] = []
  for (const n of nodes) {
    out.push({
      id: n.id,
      name: n.name,
      depth,
      color: n.color ?? '#64748b',
      icon: n.icon
    })
    if (n.children?.length) {
      out.push(...flattenFolderTree(n.children, depth + 1))
    }
  }
  return out
}

export function folderNameMap(tree: FolderItem[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const row of flattenFolderTree(tree)) {
    m.set(row.id, row.name)
  }
  return m
}
