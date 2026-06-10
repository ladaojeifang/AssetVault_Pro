import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, Input } from '@arco-design/web-react'
import { notify } from '../Common/notify'
import { useApp } from '../../stores/AppContext'
import type { FolderItem, TagItem } from '@/shared/types'
import { LibrarySwitcherBar } from './LibrarySwitcher'
import { FolderIconDisplay } from '../Common/FolderIconDisplay'
import { findFolderInTree } from '../../utils/folderTreeNav'
import {
  FolderContextMenu,
  type FolderContextMenuState
} from './FolderContextMenu'
import { addDraggedAssetsToFolder } from '../../utils/addAssetsToFolder'
import { MAX_FOLDER_PARENT_LEVEL_FOR_CHILD } from '@/shared/folderLimits'
import { extensionsForDialog } from '@/shared/assetFormatRegistry'

function collectSubtreeFolderIds(folder: FolderItem): string[] {
  const ids = [folder.id]
  for (const c of folder.children ?? []) {
    ids.push(...collectSubtreeFolderIds(c))
  }
  return ids
}

const Sidebar: React.FC = () => {
  const { t } = useTranslation(['sidebar', 'common'])
  const {
    folderTree,
    tags,
    currentFolderId,
    tagFilters,
    setCurrentFolder,
    setTagFilters,
    refreshFolders,
    refreshAssets
  } = useApp()

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [createBusy, setCreateBusy] = useState(false)
  const [newFolderColor, setNewFolderColor] = useState('#64748b')
  const [newFolderIconEmoji, setNewFolderIconEmoji] = useState('')
  const [newFolderIconRel, setNewFolderIconRel] = useState('')
  const [newFolderIconPreview, setNewFolderIconPreview] = useState<string | null>(null)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameFolderId, setRenameFolderId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameBusy, setRenameBusy] = useState(false)

  const [colorEditOpen, setColorEditOpen] = useState(false)
  const [colorEditFolderId, setColorEditFolderId] = useState<string | null>(null)
  const [colorEditValue, setColorEditValue] = useState('#64748b')
  const [colorEditBusy, setColorEditBusy] = useState(false)

  const [iconEditOpen, setIconEditOpen] = useState(false)
  const [iconEditFolderId, setIconEditFolderId] = useState<string | null>(null)
  const [iconEditEmoji, setIconEditEmoji] = useState('')
  const [iconEditRel, setIconEditRel] = useState('')
  const [iconEditPreview, setIconEditPreview] = useState<string | null>(null)
  const [iconEditBaselineRel, setIconEditBaselineRel] = useState<string | null>(null)
  const [iconEditBusy, setIconEditBusy] = useState(false)

  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState>(null)

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const processFolderDrop = useCallback(
    async (e: React.DragEvent, folderId: string) => {
      try {
        const result = await addDraggedAssetsToFolder(e, folderId, { requireAlt: true })
        if (result.skippedAltHint) {
          notify.info(t('dragAltHint'))
          return
        }
        if (!result.ok) return
        notify.success(t('addedToFolder', { count: result.count }))
        await refreshFolders()
        await refreshAssets()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        notify.error(msg || t('addToFolderFailed'))
      }
    },
    [refreshFolders, refreshAssets]
  )

  const openCreateFolderModal = useCallback(() => {
    setNewFolderName(t('newFolderDefault'))
    setNewFolderColor('#64748b')
    setNewFolderIconEmoji('')
    setNewFolderIconRel('')
    setNewFolderIconPreview(null)
    setNewFolderParentId(currentFolderId)
    setCreateFolderOpen(true)
  }, [currentFolderId])

  const openCreateSubfolderModal = useCallback((parent: FolderItem) => {
    if (parent.level >= MAX_FOLDER_PARENT_LEVEL_FOR_CHILD) {
      notify.warning(t('sidebar:maxDepth'))
      return
    }
    setNewFolderName(t('newFolderDefault'))
    setNewFolderColor(parent.color?.trim() || '#64748b')
    setNewFolderIconEmoji('')
    setNewFolderIconRel('')
    setNewFolderIconPreview(null)
    setNewFolderParentId(parent.id)
    setExpandedFolders((prev) => new Set(prev).add(parent.id))
    setCreateFolderOpen(true)
  }, [])

  const clearLocalFolderIcon = useCallback(async () => {
    if (newFolderIconRel) {
      try {
        await window.assetVaultAPI.folders.deleteStoredIcon(newFolderIconRel)
      } catch {
        /* ignore */
      }
    }
    setNewFolderIconRel('')
    setNewFolderIconPreview(null)
  }, [newFolderIconRel])

  const pickFolderIconFromDisk = useCallback(async () => {
    const paths = (await window.assetVaultAPI.fs.selectDialog({
      filters: [{ name: 'Images', extensions: extensionsForDialog('sidebarImage') }]
    })) as string[]
    const first = paths?.[0]
    if (!first) return
    const prev = newFolderIconRel
    try {
      const { relativePath, previewDataUrl } = await window.assetVaultAPI.folders.importIconFromFile(first)
      if (prev && prev !== relativePath) {
        try {
          await window.assetVaultAPI.folders.deleteStoredIcon(prev)
        } catch {
          /* ignore */
        }
      }
      setNewFolderIconRel(relativePath)
      setNewFolderIconPreview(previewDataUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      notify.error(msg || t('sidebar:importIconFailed'))
    }
  }, [newFolderIconRel])

  const closeCreateFolderModal = useCallback(() => {
    void (async () => {
      if (newFolderIconRel) {
        try {
          await window.assetVaultAPI.folders.deleteStoredIcon(newFolderIconRel)
        } catch {
          /* ignore */
        }
      }
      setNewFolderIconRel('')
      setNewFolderIconEmoji('')
      setNewFolderIconPreview(null)
      setNewFolderParentId(null)
      setCreateFolderOpen(false)
    })()
  }, [newFolderIconRel])

  const submitCreateFolder = useCallback(async () => {
    const name = newFolderName.trim()
    if (!name) {
      notify.warning(t('sidebar:enterFolderName'))
      return
    }
    if (/[/\\]/.test(name)) {
      notify.warning(t('sidebar:invalidFolderName'))
      return
    }
    const iconForCreate = newFolderIconRel || (newFolderIconEmoji.trim() || null)
    setCreateBusy(true)
    try {
      const created = (await window.assetVaultAPI.folders.create({
        name,
        parentId: newFolderParentId || undefined,
        color: newFolderColor,
        icon: iconForCreate
      })) as { id: string }
      await refreshFolders()
      if (newFolderParentId) {
        setExpandedFolders((prev) => new Set(prev).add(newFolderParentId))
      }
      setNewFolderIconRel('')
      setNewFolderIconEmoji('')
      setNewFolderIconPreview(null)
      setNewFolderParentId(null)
      setCreateFolderOpen(false)
      notify.success(t('sidebar:folderCreated'))
      await setCurrentFolder(created.id)
    } catch (e) {
      if (iconForCreate && iconForCreate.startsWith('folder-icons/')) {
        try {
          await window.assetVaultAPI.folders.deleteStoredIcon(iconForCreate)
        } catch {
          /* ignore */
        }
      }
      const msg = e instanceof Error ? e.message : String(e)
      notify.error(msg || t('sidebar:createFailed'))
    } finally {
      setCreateBusy(false)
    }
  }, [
    newFolderName,
    newFolderColor,
    newFolderIconEmoji,
    newFolderIconRel,
    newFolderParentId,
    refreshFolders,
    setCurrentFolder
  ])

  const clearIconEditLocal = useCallback(async () => {
    if (
      iconEditRel &&
      iconEditRel.startsWith('folder-icons/') &&
      iconEditRel !== iconEditBaselineRel
    ) {
      try {
        await window.assetVaultAPI.folders.deleteStoredIcon(iconEditRel)
      } catch {
        /* ignore */
      }
    }
    setIconEditRel('')
    setIconEditPreview(null)
  }, [iconEditRel, iconEditBaselineRel])

  const pickIconEditFromDisk = useCallback(async () => {
    const paths = (await window.assetVaultAPI.fs.selectDialog({
      filters: [{ name: 'Images', extensions: extensionsForDialog('sidebarImage') }]
    })) as string[]
    const first = paths?.[0]
    if (!first) return
    const prev = iconEditRel
    try {
      const { relativePath, previewDataUrl } = await window.assetVaultAPI.folders.importIconFromFile(first)
      if (
        prev &&
        prev !== relativePath &&
        prev.startsWith('folder-icons/') &&
        prev !== iconEditBaselineRel
      ) {
        try {
          await window.assetVaultAPI.folders.deleteStoredIcon(prev)
        } catch {
          /* ignore */
        }
      }
      setIconEditRel(relativePath)
      setIconEditPreview(previewDataUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      notify.error(msg || t('sidebar:importIconFailed'))
    }
  }, [iconEditRel, iconEditBaselineRel])

  const openIconEditModal = useCallback(async (folder: FolderItem) => {
    const icon = folder.icon ?? null
    const baseline = icon && icon.startsWith('folder-icons/') ? icon : null
    setIconEditFolderId(folder.id)
    setIconEditBaselineRel(baseline)
    if (baseline) {
      setIconEditRel(baseline)
      setIconEditEmoji('')
      try {
        const u = await window.assetVaultAPI.folders.getIconDataUrl(baseline)
        setIconEditPreview(u)
      } catch {
        setIconEditPreview(null)
      }
    } else {
      setIconEditRel('')
      setIconEditEmoji(icon?.trim() || '')
      setIconEditPreview(null)
    }
    setIconEditOpen(true)
  }, [])

  const closeIconEditModal = useCallback(() => {
    void (async () => {
      if (
        iconEditRel &&
        iconEditRel.startsWith('folder-icons/') &&
        iconEditRel !== iconEditBaselineRel
      ) {
        try {
          await window.assetVaultAPI.folders.deleteStoredIcon(iconEditRel)
        } catch {
          /* ignore */
        }
      }
      setIconEditOpen(false)
      setIconEditFolderId(null)
      setIconEditEmoji('')
      setIconEditRel('')
      setIconEditPreview(null)
      setIconEditBaselineRel(null)
    })()
  }, [iconEditRel, iconEditBaselineRel])

  const submitIconEdit = useCallback(async () => {
    if (!iconEditFolderId) return
    const newIcon = iconEditRel || (iconEditEmoji.trim() || null)
    const baseline = iconEditBaselineRel
    setIconEditBusy(true)
    try {
      await window.assetVaultAPI.folders.update(iconEditFolderId, { icon: newIcon })
      await refreshFolders()
      setIconEditOpen(false)
      setIconEditFolderId(null)
      setIconEditEmoji('')
      setIconEditRel('')
      setIconEditPreview(null)
      setIconEditBaselineRel(null)
      notify.success(t('sidebar:iconUpdated'))
    } catch (e) {
      if (newIcon && newIcon.startsWith('folder-icons/') && newIcon !== baseline) {
        try {
          await window.assetVaultAPI.folders.deleteStoredIcon(newIcon)
        } catch {
          /* ignore */
        }
      }
      const msg = e instanceof Error ? e.message : String(e)
      notify.error(msg || t('sidebar:updateFailed'))
    } finally {
      setIconEditBusy(false)
    }
  }, [iconEditFolderId, iconEditRel, iconEditEmoji, iconEditBaselineRel, refreshFolders])

  const submitRenameFolder = useCallback(async () => {
    if (!renameFolderId) return
    const name = renameValue.trim()
    if (!name) {
      notify.warning(t('sidebar:enterFolderName'))
      return
    }
    if (/[/\\]/.test(name)) {
      notify.warning(t('sidebar:invalidFolderName'))
      return
    }
    const existing = findFolderInTree(folderTree, renameFolderId)
    if (existing && existing.name === name) {
      setRenameOpen(false)
      setRenameFolderId(null)
      return
    }
    setRenameBusy(true)
    try {
      await window.assetVaultAPI.folders.update(renameFolderId, { name })
      await refreshFolders()
      await refreshAssets()
      setRenameOpen(false)
      setRenameFolderId(null)
      notify.success(t('sidebar:folderRenamed'))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      notify.error(msg || t('sidebar:renameFailed'))
    } finally {
      setRenameBusy(false)
    }
  }, [renameFolderId, renameValue, folderTree, refreshFolders, refreshAssets])

  const submitColorEdit = useCallback(async () => {
    if (!colorEditFolderId) return
    setColorEditBusy(true)
    try {
      await window.assetVaultAPI.folders.update(colorEditFolderId, { color: colorEditValue })
      await refreshFolders()
      setColorEditOpen(false)
      setColorEditFolderId(null)
      notify.success(t('sidebar:colorUpdated'))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      notify.error(msg || t('sidebar:updateFailed'))
    } finally {
      setColorEditBusy(false)
    }
  }, [colorEditFolderId, colorEditValue, refreshFolders])

  const confirmDeleteFolder = useCallback(
    (folder: FolderItem) => {
      const subtree = new Set(collectSubtreeFolderIds(folder))
      Modal.confirm({
        title: t('deleteFolderTitle'),
        content: t('sidebar:deleteFolderContentLong', { name: folder.name }),
        okText: t('common:delete'),
        cancelText: t('common:cancel'),
        okButtonProps: { status: 'danger' as const },
        async onOk() {
          try {
            await window.assetVaultAPI.folders.delete(folder.id)
            await refreshFolders()
            await refreshAssets()
            if (currentFolderId && subtree.has(currentFolderId)) {
              await setCurrentFolder(folder.parentId)
            }
            notify.success(t('sidebar:deleteFolderSuccess'))
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            notify.error(msg || t('sidebar:deleteFailed'))
            throw e
          }
        }
      })
    },
    [currentFolderId, refreshFolders, refreshAssets, setCurrentFolder]
  )

  const handleFolderContextAction = useCallback(
    (key: string, folder: FolderItem) => {
      switch (key) {
        case 'subfolder':
          openCreateSubfolderModal(folder)
          break
        case 'rename':
          setRenameFolderId(folder.id)
          setRenameValue(folder.name)
          setRenameOpen(true)
          break
        case 'icon':
          void openIconEditModal(folder)
          break
        case 'color':
          setColorEditFolderId(folder.id)
          setColorEditValue(folder.color?.trim() || '#64748b')
          setColorEditOpen(true)
          break
        case 'delete':
          confirmDeleteFolder(folder)
          break
        default:
          break
      }
    },
    [openCreateSubfolderModal, openIconEditModal, confirmDeleteFolder]
  )

  const openFolderContextMenu = useCallback((folder: FolderItem, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setFolderContextMenu({ folder, x: e.clientX, y: e.clientY })
  }, [])

  return (
    <div className="h-full flex flex-col bg-av-bg-secondary overflow-y-auto scrollbar-hide">
      {/* 资料库 / 全部资产 / 文件夹树 */}
      <SidebarSection title={t('sidebar:librarySection')}>
        <LibrarySwitcherBar />
      </SidebarSection>

      <div className="px-3 py-2 border-b border-av-border/50">
        <SidebarItem
          icon="🗂"
          label={t('sidebar:allAssets')}
          active={!currentFolderId}
          onClick={() => void setCurrentFolder(null)}
          count={null}
        />
      </div>

      <SidebarSection title={t('sidebar:folders')}>
        <div className="space-y-0.5 mt-0.5">
          <FolderTreeItem
            folders={folderTree}
            level={0}
            currentId={currentFolderId}
            expandedIds={expandedFolders}
            onToggle={toggleFolder}
            onSelect={setCurrentFolder}
            onFolderDrop={processFolderDrop}
            onFolderContextMenu={openFolderContextMenu}
          />
        </div>
        <button
          type="button"
          onClick={openCreateFolderModal}
          className="w-full mt-2 px-2 py-1.5 text-xs text-av-text-muted hover:text-av-accent-blue hover:bg-av-bg-hover rounded flex items-center gap-1.5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 6v12M6 12h12" />
          </svg>
          {t('sidebar:newFolder')}
        </button>
      </SidebarSection>

      <Modal
        title={t('sidebar:createFolderTitle')}
        visible={createFolderOpen}
        onOk={() => void submitCreateFolder()}
        onCancel={() => closeCreateFolderModal()}
        okText={t('sidebar:create')}
        cancelText={t('common:cancel')}
        confirmLoading={createBusy}
        mountOnEnter={false}
      >
        <p className="text-xs text-av-text-muted mb-2">
          {newFolderParentId
            ? t('sidebar:createChildHint', {
                name: findFolderInTree(folderTree, newFolderParentId)?.name ?? '…'
              })
            : t('sidebar:createRootHint')}
        </p>
        <Input
          value={newFolderName}
          onChange={(v) => setNewFolderName(v)}
          placeholder={t('sidebar:folderName')}
          onPressEnter={() => void submitCreateFolder()}
        />
        <div className="flex gap-3 mt-3 items-center">
          <label className="text-xs text-av-text-muted shrink-0">{t('sidebar:color')}</label>
          <input
            type="color"
            value={newFolderColor}
            onChange={(e) => setNewFolderColor(e.target.value)}
            className="h-8 w-12 rounded border border-av-border bg-transparent cursor-pointer"
            title={t('sidebar:folderColorTitle')}
          />
        </div>
        <div className="flex gap-3 mt-2 items-center">
          <label className="text-xs text-av-text-muted shrink-0">{t('sidebar:icon')}</label>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <Input
              value={newFolderIconEmoji}
              onChange={(v) => setNewFolderIconEmoji(v)}
              placeholder={t('sidebar:folderIconEmoji')}
              className="flex-1"
              maxLength={8}
              disabled={Boolean(newFolderIconRel)}
            />
            <button
              type="button"
              onClick={() => void pickFolderIconFromDisk()}
              className="shrink-0 px-2.5 py-1 text-xs rounded border border-av-border bg-av-bg-tertiary hover:bg-av-bg-hover text-av-text-secondary transition-colors"
            >
              {t('sidebar:pickLocal')}
            </button>
          </div>
        </div>
        {newFolderIconPreview ? (
          <div className="flex gap-3 mt-2 items-center">
            <span className="w-6 shrink-0" aria-hidden />
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <img
                src={newFolderIconPreview}
                alt=""
                className="w-9 h-9 rounded object-cover border border-av-border shrink-0"
              />
              <button
                type="button"
                onClick={() => void clearLocalFolderIcon()}
                className="text-xs text-av-text-muted hover:text-av-accent-blue shrink-0"
              >
                {t('sidebar:clearImage')}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title={t('sidebar:renameFolder')}
        visible={renameOpen}
        onOk={() => void submitRenameFolder()}
        onCancel={() => {
          setRenameOpen(false)
          setRenameFolderId(null)
        }}
        okText={t('common:save')}
        cancelText={t('common:cancel')}
        confirmLoading={renameBusy}
        mountOnEnter={false}
      >
        <Input
          value={renameValue}
          onChange={(v) => setRenameValue(v)}
          placeholder={t('sidebar:folderName')}
          onPressEnter={() => void submitRenameFolder()}
        />
      </Modal>

      <Modal
        title={t('sidebar:editFolderColor')}
        visible={colorEditOpen}
        onOk={() => void submitColorEdit()}
        onCancel={() => {
          setColorEditOpen(false)
          setColorEditFolderId(null)
        }}
        okText={t('common:save')}
        cancelText={t('common:cancel')}
        confirmLoading={colorEditBusy}
        mountOnEnter={false}
      >
        <div className="flex gap-3 items-center">
          <label className="text-xs text-av-text-muted shrink-0">{t('sidebar:color')}</label>
          <input
            type="color"
            value={colorEditValue}
            onChange={(e) => setColorEditValue(e.target.value)}
            className="h-8 w-12 rounded border border-av-border bg-transparent cursor-pointer"
          />
        </div>
      </Modal>

      <Modal
        title={t('sidebar:editFolderIcon')}
        visible={iconEditOpen}
        onOk={() => void submitIconEdit()}
        onCancel={() => closeIconEditModal()}
        okText={t('common:save')}
        cancelText={t('common:cancel')}
        confirmLoading={iconEditBusy}
        mountOnEnter={false}
      >
        <div className="flex gap-3 mt-1 items-center">
          <label className="text-xs text-av-text-muted shrink-0">{t('sidebar:icon')}</label>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <Input
              value={iconEditEmoji}
              onChange={(v) => setIconEditEmoji(v)}
              placeholder={t('sidebar:folderIconShort')}
              className="flex-1"
              maxLength={8}
              disabled={Boolean(iconEditRel)}
            />
            <button
              type="button"
              onClick={() => void pickIconEditFromDisk()}
              className="shrink-0 px-2.5 py-1 text-xs rounded border border-av-border bg-av-bg-tertiary hover:bg-av-bg-hover text-av-text-secondary transition-colors"
            >
              {t('sidebar:pickLocal')}
            </button>
          </div>
        </div>
        {iconEditPreview ? (
          <div className="flex gap-3 mt-2 items-center">
            <span className="w-10 shrink-0" aria-hidden />
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <img
                src={iconEditPreview}
                alt=""
                className="w-9 h-9 rounded object-cover border border-av-border shrink-0"
              />
              <button
                type="button"
                onClick={() => void clearIconEditLocal()}
                className="text-xs text-av-text-muted hover:text-av-accent-blue shrink-0"
              >
                {t('sidebar:clearImage')}
              </button>
            </div>
          </div>
        ) : null}
        <p className="text-[10px] text-av-text-muted mt-3 leading-relaxed">
          {t('sidebar:iconEditHint')}
        </p>
      </Modal>

      {/* Tags Section */}
      <SidebarSection title="Tags">
        <div className="space-y-0.5">
          {tags.length === 0 ? (
            <p className="text-xs text-av-text-muted px-1 py-2">No tags yet</p>
          ) : (
            tags.map((tag) => (
              <TagFilterItem
                key={tag.id}
                tag={tag}
                active={tagFilters.includes(tag.id)}
                onToggle={(id) => {
                  if (tagFilters.includes(id)) {
                    setTagFilters(tagFilters.filter((t) => t !== id))
                  } else {
                    setTagFilters([...tagFilters, id])
                  }
                }}
              />
            ))
          )}
        </div>
      </SidebarSection>

      {/* File Types Section */}
      <SidebarSection title="Types">
        <TypeFilterItem type="image" label="Images" emoji="🖼️" />
        <TypeFilterItem type="video" label="Videos" emoji="🎬" />
        <TypeFilterItem type="audio" label="Audio" emoji="🎵" />
        <TypeFilterItem type="font" label="Fonts" emoji="🔤" />
        <TypeFilterItem type="design" label="Design" emoji="🎨" />
        <TypeFilterItem type="document" label="Docs" emoji="📄" />
        <TypeFilterItem type="3d" label="3D" emoji="📦" />
        <TypeFilterItem type="code" label="Code" emoji="💻" />
        <TypeFilterItem type="other" label="Other" emoji="📎" />
      </SidebarSection>

      <FolderContextMenu
        state={folderContextMenu}
        onClose={() => setFolderContextMenu(null)}
        onAction={handleFolderContextAction}
        maxParentLevel={MAX_FOLDER_PARENT_LEVEL_FOR_CHILD}
      />
    </div>
  )
}

// Sub-components
function SidebarSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="sidebar-section border-b border-av-border/50 last:border-b-0">
      <h3 className="sidebar-section-title">{title}</h3>
      {children}
    </div>
  )
}

const SidebarItem = React.forwardRef<
  HTMLButtonElement,
  {
    icon?: React.ReactNode
    label: string
    active: boolean
    onClick: () => void
    count?: number | null
    indent?: number
    onDragOver?: (e: React.DragEvent) => void
    onDrop?: (e: React.DragEvent) => void
    onContextMenu?: (e: React.MouseEvent) => void
    rowStyle?: React.CSSProperties
  }
>(function SidebarItem(
  {
    icon,
    label,
    active,
    onClick,
    count,
    indent = 0,
    onDragOver,
    onDrop,
    onContextMenu,
    rowStyle
  },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors ${
        active
          ? 'bg-av-accent-blue/15 text-av-text-primary'
          : 'text-av-text-secondary hover:text-av-text-primary hover:bg-av-bg-hover'
      }`}
      style={{ paddingLeft: `${8 + indent * 16}px`, ...(rowStyle || {}) }}
    >
      {icon != null && <span className="text-xs flex items-center shrink-0">{icon}</span>}
      <span className="truncate flex-1 text-left">{label}</span>
      {count !== null && count !== undefined && (
        <span className="text-[10px] text-av-text-muted tabular-nums">{count}</span>
      )}
    </button>
  )
})

interface FolderTreeItemProps {
  folders: FolderItem[]
  level: number
  currentId: string | null
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onSelect: (id: string | null) => void
  onFolderDrop: (e: React.DragEvent, folderId: string) => void
  onFolderContextMenu: (folder: FolderItem, e: React.MouseEvent) => void
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  folders,
  level,
  currentId,
  expandedIds,
  onToggle,
  onSelect,
  onFolderDrop,
  onFolderContextMenu
}) => {
  if (!folders || folders.length === 0) return null

  return (
    <>
      {folders.map((folder) => {
        const accent = folder.color ?? '#64748b'
        return (
        <div key={folder.id}>
          <SidebarItem
              icon={
                <span className="flex items-center gap-0.5 shrink-0">
                  <span className="flex items-center w-3.5">
                    {(folder.children?.length ?? 0) > 0 ? (
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className={`transition-transform ${expandedIds.has(folder.id) ? 'rotate-90' : ''}`}
                      >
                        <path d="M3 1l4 4-4 4" />
                      </svg>
                    ) : (
                      <span className="w-[10px]" />
                    )}
                  </span>
                  <FolderIconDisplay icon={folder.icon} fallbackEmoji="📂" size={13} />
                </span>
              }
              label={folder.name}
              active={currentId === folder.id}
              count={folder.assetCount}
              indent={level}
              rowStyle={{ borderLeft: `3px solid ${accent}` }}
              onContextMenu={(e) => onFolderContextMenu(folder, e)}
              onDragOver={(e) => {
                const types = e.dataTransfer.types
                const ok =
                  [...types].includes('application/x-assetvault-drag') ||
                  [...types].includes('application/x-assetvault-asset-id')
                if (ok) {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                }
              }}
              onDrop={(e) => onFolderDrop(e, folder.id)}
              onClick={() => {
                if ((folder.children?.length ?? 0) > 0) onToggle(folder.id)
                onSelect(folder.id)
              }}
            />
          {expandedIds.has(folder.id) &&
            (folder.children?.length ?? 0) > 0 && (
              <FolderTreeItem
                folders={folder.children!}
                level={level + 1}
                currentId={currentId}
                expandedIds={expandedIds}
                onToggle={onToggle}
                onSelect={onSelect}
                onFolderDrop={onFolderDrop}
                onFolderContextMenu={onFolderContextMenu}
              />
            )}
        </div>
        )
      })}
    </>
  )
}

function TagFilterItem({
  tag,
  active,
  onToggle
}: {
  tag: TagItem
  active: boolean
  onToggle: (id: string) => void
}) {
  return (
    <button
      onClick={() => onToggle(tag.id)}
      className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors ${
        active
          ? 'bg-av-bg-elevated ring-1 ring-av-accent-blue/30'
          : 'hover:bg-av-bg-hover'
      }`}
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: tag.color }}
      />
      <span className="truncate flex-1 text-left text-sm">{tag.name}</span>
      <span className="text-[10px] text-av-text-muted tabular-nums">{tag.usageCount}</span>
    </button>
  )
}

function TypeFilterItem({
  type,
  label,
  emoji
}: {
  type: string
  label: string
  emoji: string
}) {
  const { fileTypeFilter, setFileTypeFilter } = useApp()
  const active = fileTypeFilter === type

  return (
    <SidebarItem
      icon={emoji}
      label={label}
      active={active}
      onClick={() =>
        setFileTypeFilter(active ? null : type)
      }
      indent={0}
    />
  )
}

export default Sidebar
