import { cn } from '@/utils/cn'

interface SkeletonProps {
  className?: string
  rounded?: boolean
}

export function Skeleton({ className, rounded }: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-border-light animate-pulse',
        rounded ? 'rounded-full' : 'rounded',
        className
      )}
      aria-hidden="true"
    />
  )
}

export function PostSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-card border border-border-light p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10" rounded />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-48 w-full rounded-lg" />
      <div className="flex gap-4 pt-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-card border border-border-light overflow-hidden">
      <Skeleton className="h-48 w-full rounded-none" />
      <div className="px-4 pb-4">
        <div className="flex items-end gap-4 -mt-12 mb-4">
          <Skeleton className="w-24 h-24 rounded-full border-4 border-white flex-shrink-0" />
          <div className="flex-1 pt-12 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-9 w-28" />)}
        </div>
      </div>
    </div>
  )
}

export function UserCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="w-10 h-10" rounded />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  )
}
