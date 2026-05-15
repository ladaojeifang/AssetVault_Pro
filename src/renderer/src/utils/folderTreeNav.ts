import type { FolderItem } from '@/shared/types'

export function findFolderInTree(tree: FolderItem[], id: string): FolderItem | null {
  for (const n of tree) {
    if (n.id === id) return n
    if (n.children?.length) {
      const hit = findFolderInTree(n.children, id)
      if (hit) return hit
    }
  }
  return null
}

/** `parentId === null` → roots of the tree. */
export function getChildFolders(tree: FolderItem[], parentId: string | null): FolderItem[] {
  if (!parentId) return tree
  const p = findFolderInTree(tree, parentId)
  return p?.children ?? []
}
