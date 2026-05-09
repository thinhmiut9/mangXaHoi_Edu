import { useEffect, useRef, useState, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/cn'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '6xl'
  children: ReactNode
  footer?: ReactNode
  closeOnOverlay?: boolean
  mobileFullscreen?: boolean
}

const sizeMap = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', '2xl': 'max-w-3xl', '6xl': 'max-w-6xl' }

export function Modal({ open, onClose, title, size = 'md', children, footer, closeOnOverlay = true, mobileFullscreen = false }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [shouldRender, setShouldRender] = useState(open)
  const [isClosing, setIsClosing] = useState(false)

  const requestClose = () => {
    setIsClosing(true)
    window.setTimeout(onClose, 180)
  }

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      setIsClosing(false)
      return
    }
    if (!shouldRender) return
    const timer = window.setTimeout(() => {
      setShouldRender(false)
      setIsClosing(false)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [open, shouldRender])

  // Keyboard: Escape to close
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Focus trap
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      panelRef.current?.focus()
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!shouldRender) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        mobileFullscreen ? 'p-0 sm:p-6' : 'p-4 sm:p-6'
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px]"
        onClick={closeOnOverlay ? requestClose : undefined}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-white shadow-xl animate-[scaleIn_0.2s_cubic-bezier(0.34,1.56,0.64,1)] focus:outline-none overflow-y-auto',
          mobileFullscreen
            ? 'h-[100dvh] max-h-[100dvh] rounded-none animate-[modalSlideUp_0.24s_ease-out] sm:h-auto sm:max-h-[calc(100vh-3rem)] sm:rounded-2xl sm:animate-[scaleIn_0.2s_cubic-bezier(0.34,1.56,0.64,1)]'
            : 'max-h-[calc(100vh-2rem)] rounded-2xl sm:max-h-[calc(100vh-3rem)]',
          isClosing && (mobileFullscreen ? 'animate-[modalSlideDown_0.18s_ease-in_forwards] sm:animate-[scaleOut_0.18s_ease-in_forwards]' : 'animate-[scaleOut_0.18s_ease-in_forwards]'),
          sizeMap[size]
        )}
      >
        {/* Header */}
        {title && (
          <div className={cn(
            'flex items-center justify-between px-6 py-4 border-b border-border-light bg-gradient-to-b from-white to-gray-50/50',
            mobileFullscreen && 'sticky top-0 z-10'
          )}>
            <div className="flex items-center gap-2">
              {mobileFullscreen && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={requestClose}
                  className="w-8 h-8 p-0 rounded-full sm:hidden"
                  aria-label="Quay lại"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </Button>
              )}
              <h2 id="modal-title" className="text-lg font-semibold text-text-primary">{title}</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={requestClose}
              className={cn('w-8 h-8 p-0 rounded-full', mobileFullscreen && 'hidden sm:flex')}
              aria-label="Đóng"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>
        )}
        {/* Body */}
        <div className="px-6 py-4">{children}</div>
        {/* Footer */}
        {footer && <div className="px-6 py-4 border-t border-border-light flex justify-end gap-3">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}
