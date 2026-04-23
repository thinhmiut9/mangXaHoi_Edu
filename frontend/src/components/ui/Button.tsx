import { cn } from '@/utils/cn'
import { Spinner } from './Spinner'
import { forwardRef, ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:   'bg-gradient-to-br from-primary-500 to-primary-600 text-white hover:from-primary-500 hover:to-primary-700 active:from-primary-600 active:to-primary-700 shadow-sm hover:shadow-md',
  secondary: 'bg-hover-bg text-text-primary hover:bg-border-light hover:shadow-sm active:bg-border-main',
  ghost:     'text-text-primary hover:bg-hover-bg active:bg-border-light',
  danger:    'bg-error-500 text-white hover:bg-error-600 active:bg-red-700 shadow-sm hover:shadow-md',
  outline:   'border border-border-main text-text-primary hover:bg-hover-bg bg-card-bg',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm font-medium rounded-lg',
  md: 'h-10 px-4 text-base font-semibold rounded-xl',
  lg: 'h-11 px-6 text-lg font-semibold rounded-2xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, fullWidth, leftIcon, rightIcon, className, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? <Spinner size="sm" className={variant === 'primary' || variant === 'danger' ? 'text-white' : 'text-text-secondary'} /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    )
  }
)
Button.displayName = 'Button'
