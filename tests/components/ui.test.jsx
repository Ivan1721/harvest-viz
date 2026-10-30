// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Ayuda, Seg, fmtT, f0 } from '../../src/workload/ui.jsx'
import { ErrorBoundary } from '../../src/shared/ErrorBoundary.jsx'

afterEach(cleanup)

describe('Seg', () => {
  it('marca la opción activa, respeta deshabilitadas y avisa el cambio', () => {
    const onChange = vi.fn()
    render(
      <Seg
        value="b"
        onChange={onChange}
        options={[
          ['a', 'Uno'],
          ['b', 'Dos'],
          ['c', 'Tres', true],
        ]}
      />,
    )
    expect(screen.getByText('Dos').className).toBe('on')
    // deshabilitada: sigue enfocable (aria-disabled) y no cambia nada al pulsarla
    expect(screen.getByText('Tres').getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(screen.getByText('Tres'))
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Uno'))
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('escribe visible el motivo de las opciones deshabilitadas, agrupadas por motivo', () => {
    render(
      <Seg
        value="a"
        onChange={() => {}}
        options={[
          ['a', 'Uno'],
          ['b', 'Dos', true, 'Solo con robot'],
          ['c', 'Tres', true, 'Solo con robot'],
          ['d', 'Cuatro', false, 'Ayuda de una opción habilitada'],
        ]}
      />,
    )
    const motivo = screen.getByText('Dos, Tres: solo con robot.')
    expect(screen.getByText('Dos').getAttribute('aria-describedby')).toBe(motivo.id)
    // la ayuda de una opción habilitada no se escribe: va en una <Ayuda> enlazada al botón
    const ayuda = screen.getByRole('tooltip', { hidden: true })
    expect(ayuda.textContent).toBe('Ayuda de una opción habilitada')
    expect(screen.getByText('Cuatro').getAttribute('aria-describedby')).toBe(ayuda.id)
  })
})

describe('Ayuda', () => {
  it('reemplaza a title: se abre con el foco, se cierra con Esc y queda enlazada al control', () => {
    render(
      <Ayuda as="label" texto="MATLAB: 0,75">
        <span>Velocidad</span>
        <input aria-label="Velocidad" />
      </Ayuda>,
    )
    const input = screen.getByLabelText('Velocidad')
    const burbuja = screen.getByRole('tooltip', { hidden: true })
    expect(input.getAttribute('aria-describedby')).toBe(burbuja.id)
    expect(burbuja.hidden).toBe(true)
    expect(input.closest('label').getAttribute('title')).toBeNull()
    fireEvent.focus(input)
    expect(burbuja.hidden).toBe(false)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(burbuja.hidden).toBe(true)
  })

  it('sin control dentro, el envoltorio se vuelve enfocable; solo una ayuda abierta a la vez', () => {
    render(
      <>
        <Ayuda as="div" texto="Regla A">
          Estado A
        </Ayuda>
        <Ayuda as="div" texto="Regla B">
          Estado B
        </Ayuda>
      </>,
    )
    const a = screen.getByText('Estado A')
    const b = screen.getByText('Estado B')
    expect(a.tabIndex).toBe(0)
    expect(a.getAttribute('aria-describedby')).toBe(screen.getByText('Regla A').id)
    fireEvent.focus(a)
    expect(screen.getByText('Regla A').hidden).toBe(false)
    fireEvent.focus(b)
    expect(screen.getByText('Regla A').hidden).toBe(true)
    expect(screen.getByText('Regla B').hidden).toBe(false)
  })

  it('sin texto no agrega nada', () => {
    render(<Ayuda texto={null}>Solo texto</Ayuda>)
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull()
  })
})

describe('formatos', () => {
  it('fmtT da mm:ss y f0 usa separador de miles chileno', () => {
    expect(fmtT(0)).toBe('00:00')
    expect(fmtT(2700)).toBe('45:00')
    expect(fmtT(61.9)).toBe('01:01')
    expect(f0(4875.4)).toBe('4.875')
  })
})

describe('ErrorBoundary', () => {
  it('muestra un aviso con el mensaje y permite reintentar', () => {
    let fail = true
    const Boom = () => {
      if (fail) throw new Error('se rompió')
      return <p>todo bien</p>
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary label="la prueba">
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert').textContent).toContain('No se pudo mostrar la prueba')
    expect(screen.getByRole('alert').textContent).toContain('se rompió')
    fail = false
    fireEvent.click(screen.getByText('Reintentar'))
    expect(screen.getByText('todo bien')).toBeTruthy()
    spy.mockRestore()
  })
})
