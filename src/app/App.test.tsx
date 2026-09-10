import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './App'

// The hash is real browser state in jsdom and would leak from test to test.
beforeEach(() => {
  window.location.hash = ''
})

describe('App', () => {
  it('renders the character in play', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Soryn Vort')
    expect(screen.getByLabelText('Personaje activo')).toHaveValue('soryn-vort')
  })

  it('opens on the combat tab', () => {
    render(<App />)

    expect(screen.getByRole('tab', { name: 'Combate' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-combate')
  })

  it('swaps the visible panel when another tab is pressed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: 'Hoja' }))

    expect(screen.getByRole('tab', { name: 'Hoja' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Combate' })).toHaveAttribute('aria-selected', 'false')

    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-hoja')
    expect(panel).not.toBeEmptyDOMElement()
  })

  it('mirrors the active tab in the URL hash', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('tab', { name: 'Recuerdos' }))

    expect(window.location.hash).toBe('#/recuerdos')
  })

  it('opens on the tab named by the hash', () => {
    window.location.hash = '#/conjuros'
    render(<App />)

    expect(screen.getByRole('tab', { name: 'Conjuros' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'tab-conjuros')
  })

  it('walks the tab strip with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<App />)

    screen.getByRole('tab', { name: 'Combate' }).focus()
    await user.keyboard('{ArrowRight}')

    const attacks = screen.getByRole('tab', { name: 'Ataques' })
    expect(attacks).toHaveFocus()
    expect(attacks).toHaveAttribute('aria-selected', 'true')

    // Wraps around, so the strip is never a dead end mid-combat.
    await user.keyboard('{ArrowLeft}{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Recuerdos' })).toHaveFocus()
  })
})
