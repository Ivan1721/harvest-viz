// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Seg, fmtT, f0 } from '../../src/workload/ui.jsx'
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
    expect(screen.getByText('Tres').disabled).toBe(true)
    fireEvent.click(screen.getByText('Uno'))
    expect(onChange).toHaveBeenCalledWith('a')
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
