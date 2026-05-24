import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import {
  buildFormatIconMap,
  type FormatIconEntry,
  type FormatIconOverridesSettings
} from '@/shared/formatIconOverrides'

type FormatIconMap = Map<string, FormatIconEntry>

const FormatIconOverridesContext = createContext<FormatIconMap>(new Map())

export function FormatIconOverridesProvider({
  children
}: {
  children: React.ReactNode
}): React.ReactElement {
  const [map, setMap] = useState<FormatIconMap>(new Map())

  const reload = useCallback(async () => {
    const settings = await window.assetVaultAPI.settings.getFormatIconOverrides()
    setMap(buildFormatIconMap(settings.entries))
  }, [])

  useEffect(() => {
    void reload()
    const unsub = window.assetVaultAPI.settings.onFormatIconOverridesChanged(() => {
      void reload()
    })
    return unsub
  }, [reload])

  return (
    <FormatIconOverridesContext.Provider value={map}>{children}</FormatIconOverridesContext.Provider>
  )
}

export function useFormatIconOverridesMap(): FormatIconMap {
  return useContext(FormatIconOverridesContext)
}

export function useFormatIconForExtension(extension?: string | null): FormatIconEntry | undefined {
  const map = useFormatIconOverridesMap()
  return useMemo(() => {
    if (!extension) return undefined
    const key = extension.trim().replace(/^\./, '').toLowerCase()
    return map.get(key)
  }, [map, extension])
}

export async function persistFormatIconOverrides(
  settings: FormatIconOverridesSettings
): Promise<FormatIconOverridesSettings> {
  return window.assetVaultAPI.settings.setFormatIconOverrides(settings)
}
