type PullToRefreshIndicatorProps = {
  pullDistance: number
  isRefreshing: boolean
  trigger?: number
}

export function PullToRefreshIndicator({
  pullDistance,
  isRefreshing,
  trigger = 72,
}: PullToRefreshIndicatorProps) {
  return (
    <div
      className='flex justify-center overflow-hidden transition-[max-height] duration-200'
      style={{ maxHeight: pullDistance > 0 || isRefreshing ? 44 : 0 }}
    >
      <div className='mt-1 h-7 w-7 rounded-full border border-border-light bg-white/90 shadow-sm grid place-items-center'>
        <span
          className={`h-4 w-4 rounded-full border-2 border-slate-200 border-t-primary-500 ${isRefreshing ? 'animate-spin' : ''}`}
          style={!isRefreshing ? { transform: `rotate(${Math.min(360, (pullDistance / trigger) * 360)}deg)` } : undefined}
        />
      </div>
    </div>
  )
}
