import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom ships no `matchMedia`. Components legitimately ask for the user's
// colour-scheme and reduced-motion preferences, so stub it as "no preference".
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// jsdom has no layout engine, so `scrollIntoView` is undefined. Components may
// call it for niceties such as keeping the active tab visible.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = vi.fn()
}
if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = vi.fn()
}
window.scrollTo = vi.fn()

// Vitest runs with `globals: false`, so Testing Library's automatic teardown
// (which hooks into a global `afterEach`) does not self-register. Do it here.
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
