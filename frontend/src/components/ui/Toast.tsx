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

const typeConfig: Record<ToastType, { bg: string; iconColor: string; glow: string; icon: ReactNode }> = {
  success: {
    bg: 'bg-success-50 border-success-500',
    iconColor: 'text-success-600',
    glow: 'shadow-[-5px_0_14px_-8px_rgba(34,197,94,0.65)]',
    icon: (
      <svg className='h-3.5 w-3.5' viewBox='0 0 20 20' fill='none' stroke='currentColor' strokeWidth='2.5'>
        <path d='M4.5 10.5l3.2 3.2L15.5 6.3' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    ),
  },
  error: {
    bg: 'bg-error-50 border-error-500',
    iconColor: 'text-error-600',
    glow: 'shadow-[-5px_0_14px_-8px_rgba(239,68,68,0.65)]',
    icon: (
      <svg className='h-3.5 w-3.5' viewBox='0 0 20 20' fill='none' stroke='currentColor' strokeWidth='2.5'>
        <path d='M6 6l8 8M14 6l-8 8' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    ),
  },
  warning: {
    bg: 'bg-warning-50 border-warning-500',
    iconColor: 'text-warning-600',
    glow: 'shadow-[-5px_0_14px_-8px_rgba(245,158,11,0.65)]',
    icon: (
      <svg className='h-3.5 w-3.5' viewBox='0 0 20 20' fill='none' stroke='currentColor' strokeWidth='2.2'>
        <path d='M10 5.2v5.9' strokeLinecap='round' />
        <circle cx='10' cy='14.2' r='1' fill='currentColor' stroke='none' />
      </svg>
    ),
  },
  info: {
    bg: 'bg-info-50 border-info-500',
    iconColor: 'text-info-600',
    glow: 'shadow-[-5px_0_14px_-8px_rgba(59,130,246,0.65)]',
    icon: (
      <svg className='h-3.5 w-3.5' viewBox='0 0 20 20' fill='none' stroke='currentColor' strokeWidth='2.2'>
        <path d='M10 9v4.8' strokeLinecap='round' />
        <circle cx='10' cy='6.2' r='1' fill='currentColor' stroke='none' />
      </svg>
    ),
  },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const add = useCallback(
    (opts: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((t) => [...t, { id, ...opts }])
      setTimeout(() => remove(id), 4000)
    },
    [remove]
  )

  const success = useCallback((message: string, title?: string) => add({ type: 'success', message, title }), [add])
  const error = useCallback((message: string, title?: string) => add({ type: 'error', message, title }), [add])
  const info = useCallback((message: string, title?: string) => add({ type: 'info', message, title }), [add])
  const warning = useCallback((message: string, title?: string) => add({ type: 'warning', message, title }), [add])

  return (
    <ToastContext.Provider value={{ toast: add, success, error, info, warning }}>
      {children}
      {createPortal(
        <div className='pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2'>
          {toasts.map((t) => {
            const config = typeConfig[t.type]
            return (
              <div
                key={t.id}
                className={cn(
                  'pointer-events-auto flex items-start gap-3 rounded-2xl border-l-4 bg-white/90 p-4 shadow-lg backdrop-blur-sm animate-[slideInRight_0.3s_ease-out]',
                  config.bg,
                  config.glow
                )}
                role='alert'
              >
                <span
                  className={cn(
                    'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 border-current text-sm font-bold',
                    config.iconColor
                  )}
                >
                  {config.icon}
                </span>
                <div className='min-w-0 flex-1'>
                  {t.title && <p className='text-sm font-semibold text-text-primary'>{t.title}</p>}
                  <p className='text-sm text-text-secondary'>{t.message}</p>
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className='flex-shrink-0 text-text-muted transition-colors hover:text-text-primary'
                  aria-label='Dong thong bao'
                >
                  <svg className='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
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
