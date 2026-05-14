import React, { useState } from 'react'
import { useApp } from '../../stores/AppContext'
import type { FolderItem, TagItem } from '@/shared/types'

const Sidebar: React.FC = () => {
  const {
    folderTree,
    tags,
    currentFolderId,
    tagFilters,
    setCurrentFolder,
    setTagFilters
  } = useApp()

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="h-full flex flex-col bg-av-bg-secondary overflow-y-auto scrollbar-hide">
      {/* Libraries / Folders Section */}
      <SidebarSection title="Libraries">
        <div className="space-y-0.5">
          <SidebarItem
            icon="📁"
            label="All Files"
            active={!currentFolderId}
            onClick={() => setCurrentFolder(null)}
            count={null}
          />
          <FolderTreeItem
            folders={folderTree}
            level={0}
            currentId={currentFolderId}
            expandedIds={expandedFolders}
            onToggle={toggleFolder}
            onSelect={setCurrentFolder}
          />
        </div>
        <button
          onClick={() => {
            // TODO: Create folder dialog
          }}
          className="w-full mt-2 px-2 py-1.5 text-xs text-av-text-muted hover:text-av-accent-blue hover:bg-av-bg-hover rounded flex items-center gap-1.5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 6v12M6 12h12" />
          </svg>
          New Folder
        </button>
      </SidebarSection>

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
      </SidebarSection>
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

function SidebarItem({
  icon,
  label,
  active,
  onClick,
  count,
  indent = 0
}: {
  icon?: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
  count?: number | null
  indent?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-colors ${
        active
          ? 'bg-av-accent-blue/15 text-av-text-primary'
          : 'text-av-text-secondary hover:text-av-text-primary hover:bg-av-bg-hover'
      }`}
      style={{ paddingLeft: `${8 + indent * 16}px` }}
    >
      {icon != null && <span className="text-xs flex items-center shrink-0">{icon}</span>}
      <span className="truncate flex-1 text-left">{label}</span>
      {count !== null && count !== undefined && (
        <span className="text-[10px] text-av-text-muted tabular-nums">{count}</span>
      )}
    </button>
  )
}

interface FolderTreeItemProps {
  folders: FolderItem[]
  level: number
  currentId: string | null
  expandedIds: Set<string>
  onToggle: (id: string) => void
  onSelect: (id: string | null) => void
}

const FolderTreeItem: React.FC<FolderTreeItemProps> = ({
  folders,
  level,
  currentId,
  expandedIds,
  onToggle,
  onSelect
}) => {
  if (!folders || folders.length === 0) return null

  return (
    <>
      {folders.map((folder) => (
        <div key={folder.id}>
          <SidebarItem
            icon={
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
            }
            label={folder.name}
            active={currentId === folder.id}
            count={folder.assetCount}
            indent={level + 1}
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
              />
            )}
        </div>
      ))}
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
