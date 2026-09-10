import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs with `globals: false`, so Testing Library's automatic teardown
// (which hooks into a global `afterEach`) does not self-register. Do it here.
afterEach(() => {
  cleanup()
  window.localStorage.clear()
})
