import React, { useState, useCallback, useEffect, createContext, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { registerNotifyHandler, unregisterNotifyHandler } from './notify'

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number
}

interface ToastContextValue {
  showToast: (message: Omit<ToastMessage, 'id'>) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TYPE_STYLES = {
  success: {
    accent: 'bg-emerald-500',
    iconWrap: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/25',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    )
  },
  error: {
    accent: 'bg-red-500',
    iconWrap: 'bg-red-500/15 text-red-400 ring-red-500/25',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    )
  },
  warning: {
    accent: 'bg-amber-500',
    iconWrap: 'bg-amber-500/15 text-amber-400 ring-amber-500/25',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  },
  info: {
    accent: 'bg-av-accent-blue',
    iconWrap: 'bg-blue-500/15 text-blue-400 ring-blue-500/25',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    )
  }
} as const

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: Omit<ToastMessage, 'id'>) => {
      const id = crypto.randomUUID()
      const newToast = { ...message, id }
      setToasts((prev) => [...prev.slice(-4), newToast])
      if (message.duration !== 0) {
        setTimeout(() => removeToast(id), message.duration ?? 3200)
      }
    },
    [removeToast]
  )

  useEffect(() => {
    registerNotifyHandler(showToast)
    return () => unregisterNotifyHandler()
  }, [showToast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-14 right-5 z-[10000] flex flex-col gap-2.5 pointer-events-none" aria-live="polite">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  const { t } = useTranslation('common')
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const duration = toast.duration ?? 3200
  const cfg = TYPE_STYLES[toast.type]

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  useEffect(() => {
    if (duration === 0) return
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const pct = Math.max(0, 100 - ((now - start) / duration) * 100)
      setProgress(pct)
      if (pct > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [duration])

  return (
    <div
      role="status"
      className={`pointer-events-auto relative flex items-start gap-3 pl-4 pr-3 py-3.5 rounded-xl min-w-[300px] max-w-[420px] overflow-hidden border border-av-border bg-av-bg-elevated/95 backdrop-blur-xl shadow-lg ring-1 ring-av-border-light/50 transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-x-0 scale-100' : 'opacity-0 translate-x-3 scale-[0.98]'
      }`}
    >
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${cfg.accent}`} aria-hidden />

      <span
        className={`shrink-0 mt-0.5 w-9 h-9 rounded-full flex items-center justify-center ring-1 ${cfg.iconWrap}`}
      >
        {cfg.icon}
      </span>

      <div className="flex-1 min-w-0 pt-0.5 pr-1">
        <p className="text-sm font-medium text-av-text-primary leading-snug">{toast.title}</p>
        {toast.description ? (
          <p className="text-xs text-av-text-secondary mt-1 leading-relaxed">{toast.description}</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="shrink-0 mt-0.5 p-1 rounded-md text-av-text-muted hover:text-av-text-primary hover:bg-white/5 transition-colors"
        aria-label={t('close')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {duration > 0 ? (
        <span
          className={`absolute bottom-0 left-0 h-[2px] ${cfg.accent} opacity-60 transition-[width] duration-75 linear`}
          style={{ width: `${progress}%` }}
          aria-hidden
        />
      ) : null}
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx.showToast
}

export default ToastProvider
