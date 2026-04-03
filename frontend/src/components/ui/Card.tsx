import { cn } from '@/utils/cn'
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
}

const paddingMap = { none: '', sm: 'p-3', md: 'p-4', lg: 'p-6' }

export function Card({ padding = 'md', hover, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-lg shadow-card border border-border-light',
        paddingMap[padding],
        hover && 'hover:shadow-md transition-shadow duration-150 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
