import { ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { cn } from '@/utils/cn'

type ConfirmTone = 'danger' | 'warning' | 'info'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: ReactNode
  confirmText?: string
  cancelText?: string
  tone?: ConfirmTone
  loading?: boolean
  closeOnOverlay?: boolean
}

const toneClasses: Record<ConfirmTone, { iconWrap: string; icon: string; confirmVariant: 'danger' | 'primary' }> = {
  danger: {
    iconWrap: 'bg-rose-50 ring-1 ring-rose-100',
    icon: 'text-rose-600',
    confirmVariant: 'danger',
  },
  warning: {
    iconWrap: 'bg-amber-50 ring-1 ring-amber-100',
    icon: 'text-amber-600',
    confirmVariant: 'primary',
  },
  info: {
    iconWrap: 'bg-blue-50 ring-1 ring-blue-100',
    icon: 'text-blue-600',
    confirmVariant: 'primary',
  },
}

function ConfirmIcon({ tone }: { tone: ConfirmTone }) {
  if (tone === 'warning') {
    return (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      </svg>
    )
  }
  if (tone === 'info') {
    return (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 16v-4m0-4h.01" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    )
  }
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m15 9-6 6m0-6 6 6" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy',
  tone = 'danger',
  loading = false,
  closeOnOverlay,
}: ConfirmDialogProps) {
  const toneMeta = toneClasses[tone]

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      closeOnOverlay={closeOnOverlay ?? !loading}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={toneMeta.confirmVariant} onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </>
      )}
    >
      <div className="space-y-3">
        <div className={cn('inline-flex h-11 w-11 items-center justify-center rounded-2xl', toneMeta.iconWrap)}>
          <span className={toneMeta.icon}>
            <ConfirmIcon tone={tone} />
          </span>
        </div>
        {description && <div className="text-sm leading-relaxed text-text-secondary">{description}</div>}
      </div>
    </Modal>
  )
}

