import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'

type ScrollFadeInOptions = {
  threshold?: number
  rootMargin?: string
  once?: boolean
  staggerStepMs?: number
  staggerMaxMs?: number
  durationMs?: number
  showOnInitialViewport?: boolean
}

let fadeSequence = 0

export function useScrollFadeIn<T extends HTMLElement = HTMLElement>(options: ScrollFadeInOptions = {}) {
  const {
    threshold = 0.12,
    rootMargin = '0px 0px -8% 0px',
    once = true,
    staggerStepMs = 70,
    staggerMaxMs = 420,
    durationMs = 500,
    showOnInitialViewport = true,
  } = options

  const elementRef = useRef<T | null>(null)
  const orderRef = useRef<number | null>(null)
  const [inView, setInView] = useState(false)

  if (orderRef.current === null) {
    orderRef.current = fadeSequence++
  }

  const delayMs = Math.min((orderRef.current ?? 0) * staggerStepMs, staggerMaxMs)

  useEffect(() => {
    const node = elementRef.current
    if (!node) return
    if (once && inView) return

    // Show immediately for cards already visible in the first viewport,
    // so the first screen never looks "missing" content.
    if (showOnInitialViewport) {
      const rect = node.getBoundingClientRect()
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight
      const isInInitialViewport = rect.top < viewportHeight * 0.98 && rect.bottom > 0
      if (isInInitialViewport) {
        setInView(true)
        if (once) return
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting) {
          setInView(true)
          if (once) observer.unobserve(entry.target)
        } else if (!once) {
          setInView(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [inView, once, rootMargin, showOnInitialViewport, threshold])

  const style = useMemo(
    () =>
      ({
        '--fade-delay': `${delayMs}ms`,
        '--fade-duration': `${durationMs}ms`,
      }) as CSSProperties,
    [delayMs, durationMs]
  )

  return {
    ref: elementRef,
    className: inView ? 'scroll-fade in-view' : 'scroll-fade',
    style,
  }
}
