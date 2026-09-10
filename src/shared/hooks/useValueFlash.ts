import { useEffect, useRef, useState } from 'react'

export type FlashDirection = 'up' | 'down' | null

/** How long the highlight stays on after a value changes. */
const FLASH_MS = 700

/**
 * Reports, briefly, that a number just went up or down.
 *
 * Used to draw the eye to a value that changed off-screen or without a click —
 * hit points after damage, a resource after a rest — and then get out of the way.
 */
export function useValueFlash(value: number): FlashDirection {
  const previous = useRef(value)
  const [direction, setDirection] = useState<FlashDirection>(null)

  useEffect(() => {
    if (value === previous.current) return

    setDirection(value > previous.current ? 'up' : 'down')
    previous.current = value

    const timer = window.setTimeout(() => setDirection(null), FLASH_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [value])

  return direction
}
