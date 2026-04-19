import { useCallback, useEffect, useRef, useState } from 'react'

type UsePullToRefreshOptions = {
  trigger?: number
  maxPull?: number
}

type UsePullToRefreshResult = {
  pullDistance: number
  isRefreshing: boolean
}

export function usePullToRefresh(
  onRefresh: () => Promise<unknown>,
  options: UsePullToRefreshOptions = {}
): UsePullToRefreshResult {
  const trigger = options.trigger ?? 72
  const maxPull = options.maxPull ?? 96

  const pullStartYRef = useRef<number | null>(null)
  const isPullingRef = useRef(false)
  const pullDistanceRef = useRef(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    pullDistanceRef.current = pullDistance
  }, [pullDistance])

  const refreshAtTop = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
      setPullDistance(0)
    }
  }, [isRefreshing, onRefresh])

  useEffect(() => {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (!isTouchDevice) return

    const handleTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0 || isRefreshing) return
      pullStartYRef.current = event.touches[0]?.clientY ?? null
      isPullingRef.current = pullStartYRef.current !== null
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!isPullingRef.current || pullStartYRef.current === null) return
      if (window.scrollY > 0) {
        isPullingRef.current = false
        setPullDistance(0)
        return
      }

      const currentY = event.touches[0]?.clientY ?? pullStartYRef.current
      const delta = currentY - pullStartYRef.current
      if (delta <= 0) {
        setPullDistance(0)
        return
      }

      const distance = Math.min(maxPull, delta * 0.5)
      setPullDistance(distance)

      if (delta > 8) event.preventDefault()
    }

    const handleTouchEnd = () => {
      if (!isPullingRef.current) return
      isPullingRef.current = false
      pullStartYRef.current = null

      if (pullDistanceRef.current >= trigger) {
        void refreshAtTop()
      } else {
        setPullDistance(0)
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [isRefreshing, maxPull, refreshAtTop, trigger])

  return { pullDistance, isRefreshing }
}
