// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Seg, Field, Tabs, Toast } from '../../src/workload/ui.jsx'

afterEach(cleanup)

function T() {
  const [v, set] = useState('a')
  return (
    <Tabs
      label="Paneles"
      value={v}
      onChange={set}
      options={[
        ['a', 'Uno'],
        ['b', 'Dos'],
        ['c', 'Tres'],
      ]}
    />
  )
}

describe('controles accesibles', () => {
  it('Tabs: rol tab, aria-selected y flechas del teclado', () => {
    render(<T />)
    expect(screen.getByRole('tablist', { name: 'Paneles' })).toBeTruthy()
    const uno = screen.getByRole('tab', { name: 'Uno' })
    expect(uno.getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(uno, { key: 'ArrowLeft' }) // da la vuelta al último
    expect(screen.getByRole('tab', { name: 'Tres' }).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement.textContent).toBe('Tres')
    fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Uno' }).getAttribute('aria-selected')).toBe('true')
  })

  it('Seg dentro de Field: grupo nombrado y botón activo con aria-pressed', () => {
    render(
      <Field label="Velocidad">
        <Seg
          value={5}
          onChange={() => {}}
          options={[
            [1, '×1'],
            [5, '×5'],
          ]}
        />
      </Field>,
    )
    expect(screen.getByRole('group', { name: 'Velocidad' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '×5' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '×1' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('Toast: los errores se anuncian y se pueden cerrar', () => {
    let closed = false
    render(<Toast onClose={() => (closed = true)}>Falló la carga</Toast>)
    expect(screen.getByRole('alert').textContent).toContain('Falló la carga')
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))
    expect(closed).toBe(true)
  })
})
