import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Memory } from '@/store/useMemoriesStore'
import { useMemoriesStore } from '@/store/useMemoriesStore'
import { serializeMemories } from './backup'
import { MemoriesView } from './MemoriesView'

const BASE_TIME = 1_740_000_000_000

function memory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'mem-1',
    title: 'El trato con Vessa',
    body: 'Le debemos un favor.',
    category: 'deal',
    pinned: false,
    createdAt: BASE_TIME,
    updatedAt: BASE_TIME,
    ...overrides,
  }
}

/** Puts memories in the store the way a previous session would have left them. */
function seed(...memories: Memory[]) {
  useMemoriesStore.setState({ memories })
}

function cardNamed(title: string): HTMLElement {
  return screen.getByRole('article', { name: title })
}

function listedTitles(): (string | null)[] {
  return screen.getAllByRole('article').map((card) => within(card).getByRole('heading').textContent)
}

beforeEach(() => {
  useMemoriesStore.setState({ memories: [] })
})

describe('MemoriesView', () => {
  it('crea un recuerdo y lo muestra en la lista', async () => {
    const user = userEvent.setup()
    render(<MemoriesView />)

    await user.click(screen.getByRole('button', { name: 'Añadir recuerdo' }))
    await user.type(screen.getByLabelText('Título'), 'La puerta de sal')
    await user.type(screen.getByLabelText('Qué pasó'), 'Se abre solo con sangre.')
    await user.selectOptions(screen.getByLabelText('Categoría'), 'place')
    await user.type(screen.getByLabelText('Sesión'), '7')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    const card = cardNamed('La puerta de sal')
    expect(within(card).getByText('Se abre solo con sangre.')).toBeInTheDocument()
    expect(within(card).getByText('Lugar')).toBeInTheDocument()
    expect(within(card).getByText('Sesión 7')).toBeInTheDocument()
    expect(screen.getByText('1 recuerdo')).toBeInTheDocument()

    const stored = useMemoriesStore.getState().memories[0]
    expect(stored?.title).toBe('La puerta de sal')
    expect(stored?.sessionNumber).toBe(7)
  })

  it('no guarda un recuerdo sin título', async () => {
    const user = userEvent.setup()
    render(<MemoriesView />)

    await user.click(screen.getByRole('button', { name: 'Añadir recuerdo' }))
    await user.type(screen.getByLabelText('Qué pasó'), 'Sin encabezado.')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/título/i)
    expect(screen.getByLabelText('Título')).toHaveAttribute('aria-invalid', 'true')
    expect(useMemoriesStore.getState().memories).toHaveLength(0)
  })

  it('filtra por texto en el título y en el cuerpo', async () => {
    const user = userEvent.setup()
    seed(
      memory(),
      memory({ id: 'mem-2', title: 'La puerta de sal', body: 'Sangre.', category: 'place' }),
    )
    render(<MemoriesView />)

    await user.type(screen.getByLabelText('Buscar'), 'vessa')

    expect(cardNamed('El trato con Vessa')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'La puerta de sal' })).not.toBeInTheDocument()
    expect(screen.getByText('1 de 2')).toBeInTheDocument()
  })

  it('filtra por categoría', async () => {
    const user = userEvent.setup()
    seed(memory(), memory({ id: 'mem-2', title: 'Vessa la prestamista', category: 'npc' }))
    render(<MemoriesView />)

    await user.selectOptions(screen.getByLabelText('Filtrar por categoría'), 'npc')

    expect(cardNamed('Vessa la prestamista')).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'El trato con Vessa' })).not.toBeInTheDocument()
  })

  it('avisa cuando no hay ningún recuerdo todavía', () => {
    render(<MemoriesView />)

    expect(screen.getByText(/Todavía no hay nada anotado/)).toBeInTheDocument()
  })

  it('avisa con otro texto cuando el filtro no encuentra nada', async () => {
    const user = userEvent.setup()
    seed(memory())
    render(<MemoriesView />)

    await user.type(screen.getByLabelText('Buscar'), 'dragón')

    expect(screen.getByText(/Ningún recuerdo coincide/)).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('fija un recuerdo y lo sube al principio de la lista', async () => {
    const user = userEvent.setup()
    seed(
      memory({ id: 'mem-1', title: 'Reciente', updatedAt: BASE_TIME + 1000 }),
      memory({ id: 'mem-2', title: 'Antiguo', updatedAt: BASE_TIME }),
    )
    render(<MemoriesView />)

    expect(listedTitles()).toEqual(['Reciente', 'Antiguo'])

    await user.click(within(cardNamed('Antiguo')).getByRole('button', { name: 'Fijar' }))

    expect(listedTitles()).toEqual(['Antiguo', 'Reciente'])
    const pinned = within(cardNamed('Antiguo')).getByRole('button', { name: 'Fijar' })
    expect(pinned).toHaveAttribute('aria-pressed', 'true')
    expect(within(cardNamed('Antiguo')).getByText('Fijado')).toBeInTheDocument()
  })

  it('edita un recuerdo existente', async () => {
    const user = userEvent.setup()
    seed(memory())
    render(<MemoriesView />)

    await user.click(
      within(cardNamed('El trato con Vessa')).getByRole('button', { name: 'Editar' }),
    )

    const title = screen.getByLabelText('Título')
    await user.clear(title)
    await user.type(title, 'El trato roto con Vessa')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(cardNamed('El trato roto con Vessa')).toBeInTheDocument()
    expect(screen.queryByLabelText('Título')).not.toBeInTheDocument()
    expect(useMemoriesStore.getState().memories[0]?.title).toBe('El trato roto con Vessa')
  })

  it('solo borra tras confirmar en la propia tarjeta', async () => {
    const user = userEvent.setup()
    seed(memory())
    render(<MemoriesView />)

    await user.click(
      within(cardNamed('El trato con Vessa')).getByRole('button', { name: 'Borrar' }),
    )

    expect(cardNamed('El trato con Vessa')).toBeInTheDocument()
    expect(useMemoriesStore.getState().memories).toHaveLength(1)

    await user.click(
      within(cardNamed('El trato con Vessa')).getByRole('button', { name: '¿Seguro?' }),
    )

    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(useMemoriesStore.getState().memories).toHaveLength(0)
  })

  it('conserva el recuerdo si se cancela el borrado', async () => {
    const user = userEvent.setup()
    seed(memory())
    render(<MemoriesView />)

    const card = cardNamed('El trato con Vessa')
    await user.click(within(card).getByRole('button', { name: 'Borrar' }))
    await user.click(within(card).getByRole('button', { name: 'Conservar' }))

    expect(within(card).getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
    expect(useMemoriesStore.getState().memories).toHaveLength(1)
  })

  it('rechaza un archivo que no es un respaldo', async () => {
    const user = userEvent.setup()
    seed(memory())
    render(<MemoriesView />)

    const file = new File(['{"nope":true}'], 'lista.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Importar respaldo'), file)

    expect(await screen.findByText(/no es un respaldo de recuerdos/)).toBeInTheDocument()
    expect(useMemoriesStore.getState().memories).toHaveLength(1)
  })

  it('importa un respaldo válido solo después de confirmar', async () => {
    const user = userEvent.setup()
    seed(memory())
    render(<MemoriesView />)

    const backup = serializeMemories(
      [memory({ id: 'mem-9', title: 'La deuda de Kell', category: 'clue' })],
      '2025-03-01T20:00:00.000Z',
    )
    const file = new File([backup], 'recuerdos.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('Importar respaldo'), file)

    expect(await screen.findByText(/No hay vuelta atrás/)).toBeInTheDocument()
    expect(useMemoriesStore.getState().memories[0]?.id).toBe('mem-1')

    await user.click(screen.getByRole('button', { name: 'Reemplazar todo' }))

    expect(cardNamed('La deuda de Kell')).toBeInTheDocument()
    expect(useMemoriesStore.getState().memories).toHaveLength(1)
    expect(useMemoriesStore.getState().memories[0]?.id).toBe('mem-9')
  })
})
