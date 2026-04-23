import { cn } from '@/utils/cn'
import { forwardRef, InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  success?: boolean
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  fullWidth?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, success, hint, leftIcon, rightIcon, fullWidth, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-primary">
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full h-11 rounded-xl border bg-[#f8fafc] px-3 text-base text-text-primary placeholder:text-text-muted',
              'transition-[box-shadow,border-color,background-color] duration-200 ease-out',
              'focus:outline-none focus:border-primary-500 focus:shadow-[0_0_0_3px_rgba(24,119,242,0.15),0_1px_3px_rgba(0,0,0,0.05)]',
              'disabled:opacity-50 disabled:bg-hover-bg disabled:cursor-not-allowed',
              error
                ? 'border-error-500 focus:border-error-500 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15),0_1px_3px_rgba(0,0,0,0.05)]'
                : success
                  ? 'border-success focus:border-success focus:shadow-[0_0_0_3px_rgba(34,197,94,0.15),0_1px_3px_rgba(0,0,0,0.05)] hover:border-success'
                : 'border-border-main hover:border-primary-300',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted">
              {rightIcon}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-error-500">{error}</p>}
        {hint && !error && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'
