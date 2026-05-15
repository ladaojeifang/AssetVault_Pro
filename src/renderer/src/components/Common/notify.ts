import type { ToastMessage } from './Toast'

export type NotifyContent =
  | string
  | {
      title: string
      description?: string
      duration?: number
    }

type ShowToastFn = (message: Omit<ToastMessage, 'id'>) => void

let showToastImpl: ShowToastFn | null = null

export function registerNotifyHandler(fn: ShowToastFn): void {
  showToastImpl = fn
}

export function unregisterNotifyHandler(): void {
  showToastImpl = null
}

function normalize(content: NotifyContent): Pick<ToastMessage, 'title' | 'description' | 'duration'> {
  if (typeof content === 'string') return { title: content }
  return content
}

function emit(type: ToastMessage['type'], content: NotifyContent): void {
  if (!showToastImpl) {
    console.warn('[notify]', type, typeof content === 'string' ? content : content.title)
    return
  }
  showToastImpl({ type, ...normalize(content) })
}

/** App-wide operation toasts (dark theme, top-right). */
export const notify = {
  success: (content: NotifyContent) => emit('success', content),
  error: (content: NotifyContent) => emit('error', content),
  warning: (content: NotifyContent) => emit('warning', content),
  info: (content: NotifyContent) => emit('info', content)
}
