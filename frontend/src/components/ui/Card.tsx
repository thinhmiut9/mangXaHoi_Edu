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
        'bg-white rounded-xl shadow-card border border-border-light transition-all duration-200',
        paddingMap[padding],
        hover && 'hover:shadow-md hover:-translate-y-[1px] cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
