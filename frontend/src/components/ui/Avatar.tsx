import { cn } from '@/utils/cn'
import { getInitials } from '@/utils/format'

interface AvatarProps {
  src?: string | null
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  online?: boolean
  className?: string
}

const sizeMap = {
  xs:  { container: 'w-6 h-6',   text: 'text-[10px]', indicator: 'w-2 h-2 border' },
  sm:  { container: 'w-8 h-8',   text: 'text-xs',      indicator: 'w-2.5 h-2.5 border' },
  md:  { container: 'w-10 h-10', text: 'text-sm',      indicator: 'w-3 h-3 border-2' },
  lg:  { container: 'w-12 h-12', text: 'text-base',    indicator: 'w-3.5 h-3.5 border-2' },
  xl:  { container: 'w-16 h-16', text: 'text-xl',      indicator: 'w-4 h-4 border-2' },
  '2xl': { container: 'w-24 h-24', text: 'text-2xl',   indicator: 'w-5 h-5 border-2' },
}

export function Avatar({ src, name = '', size = 'md', online, className }: AvatarProps) {
  const { container, text, indicator } = sizeMap[size]
  const initials = getInitials(name)

  return (
    <div className={cn('relative flex-shrink-0', className)}>
      <div
        className={cn(
          'rounded-full overflow-hidden flex items-center justify-center font-semibold select-none bg-primary-100 text-primary-700',
          container
        )}
      >
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className={text}>{initials || '?'}</span>
        )}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-white',
            indicator,
            online ? 'bg-success-500' : 'bg-[#CED0D4]'
          )}
          aria-label={online ? 'Đang online' : 'Offline'}
        />
      )}
    </div>
  )
}
