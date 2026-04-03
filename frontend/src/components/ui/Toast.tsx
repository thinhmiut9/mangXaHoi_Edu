import { createContext, useContext, useCallback, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/cn'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
  title?: string
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const typeConfig: Record<ToastType, { bg: string; icon: string; iconColor: string }> = {
  success: { bg: 'bg-success-50 border-success-500', icon: '✓', iconColor: 'text-success-500' },
  error:   { bg: 'bg-error-50 border-error-500',   icon: '✕', iconColor: 'text-error-500' },
  warning: { bg: 'bg-warning-50 border-warning-500', icon: '!', iconColor: 'text-warning-500' },
  info:    { bg: 'bg-info-50 border-info-500',     icon: 'i', iconColor: 'text-info-500' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const add = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(t => [...t, { id, ...opts }])
    setTimeout(() => remove(id), 4000)
  }, [remove])

  const success = useCallback((message: string, title?: string) => add({ type: 'success', message, title }), [add])
  const error   = useCallback((message: string, title?: string) => add({ type: 'error',   message, title }), [add])
  const info    = useCallback((message: string, title?: string) => add({ type: 'info',    message, title }), [add])
  const warning = useCallback((message: string, title?: string) => add({ type: 'warning', message, title }), [add])

  return (
    <ToastContext.Provider value={{ toast: add, success, error, info, warning }}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map(t => {
            const config = typeConfig[t.type]
            return (
              <div
                key={t.id}
                className={cn(
                  'flex items-start gap-3 bg-white border-l-4 rounded-lg shadow-lg p-4 pointer-events-auto animate-[fadeIn_0.2s_ease]',
                  config.bg
                )}
                role="alert"
              >
                <span className={cn('text-sm font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 flex-shrink-0', config.iconColor, 'border-current')}>
                  {config.icon}
                </span>
                <div className="flex-1 min-w-0">
                  {t.title && <p className="text-sm font-semibold text-text-primary">{t.title}</p>}
                  <p className="text-sm text-text-secondary">{t.message}</p>
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
                  aria-label="Đóng thông báo"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
