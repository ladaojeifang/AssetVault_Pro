import React, { useState, useCallback, useEffect, createContext, useContext } from 'react'

interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number // ms (default: 3000)
}

interface ToastContextValue {
  showToast: (message: Omit<ToastMessage, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * Toast Notification Provider & Component
 * Renders toast notifications at top-right of the screen
 */
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: Omit<ToastMessage, 'id'>) => {
      const id = crypto.randomUUID()
      const newToast = { ...message, id }

      setToasts((prev) => [...prev.slice(-4), newToast]) // Max 5 toasts visible

      if (message.duration !== 0) {
        setTimeout(() => {
          removeToast(id)
        }, message.duration ?? 3000)
      }
    },
    [removeToast]
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div className="fixed top-12 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({
  toast,
  onClose
}: {
  toast: ToastMessage
  onClose: () => void
}) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  const config = {
    success: {
      bgClass: 'bg-green-500/10 border-green-500/30',
      iconColor: 'text-green-400',
      textColor: 'text-green-200',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      )
    },
    error: {
      bgClass: 'bg-red-500/10 border-red-500/30',
      iconColor: 'text-red-400',
      textColor: 'text-red-200',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      )
    },
    warning: {
      bgClass: 'bg-yellow-500/10 border-yellow-500/30',
      iconColor: 'text-yellow-400',
      textColor: 'text-yellow-200',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )
    },
    info: {
      bgClass: 'bg-blue-500/10 border-blue-500/30',
      iconColor: 'text-blue-400',
      textColor: 'text-blue-200',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      )
    }
  }

  const cfg = config[toast.type]

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg transition-all duration-200 min-w-[280px] max-w-[420px] ${cfg.bgClass} ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
      }`}
      onClick={onClose}
    >
      <span className={`shrink-0 mt-0.5 ${cfg.iconColor}`}>{cfg.icon}</span>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${cfg.textColor}`}>{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-white/50 mt-0.5">{toast.description}</p>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onClose()
        }}
        className="shrink-0 text-white/40 hover:text-white/70 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

/**
 * Hook for showing toasts from any component
 */
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.showToast
}

// Listen for error notifications from main process
export function setupErrorListener() {
  useEffect(() => {
    const api = window.assetVaultAPI

    // Note: This would use ipcRenderer.on in preload context
    // For now, we'll set up a global listener pattern
    let cleanup: (() => void) | null = null

    try {
      cleanup = api?.onImportProgress((_data: unknown) => {
        // Could show progress toasts here
      })
    } catch {
      // Preload not available
    }

    return () => cleanup?.()
  }, [])
}

export default ToastProvider
