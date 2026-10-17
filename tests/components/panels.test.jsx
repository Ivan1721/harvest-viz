// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { SimPanel, DEFAULTS_SIM } from '../../src/workload/panels/SimPanel.jsx'
import { Validation } from '../../src/workload/panels/Validation.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Harness({ onRun = () => {}, onExport }) {
  const [params, setParams] = useState(DEFAULTS_SIM)
  return (
    <>
      <SimPanel params={params} setParams={setParams} onRun={onRun} busy={false} info="Simulado en 1 ms" onExport={onExport} />
      <output data-testid="walk">{params.walkSpeed}</output>
    </>
  )
}

describe('SimPanel', () => {
  it('edita un parámetro, lo marca como modificado y lo restablece', () => {
    render(<Harness />)
    expect(screen.getByText('Parámetros')).toBeTruthy()
    const input = screen.getByTitle('MATLAB: 0,75').querySelector('input')
    fireEvent.change(input, { target: { value: '1.1' } })
    expect(screen.getByTestId('walk').textContent).toBe('1.1')
    expect(screen.getByText('Parámetros (modificados)')).toBeTruthy()
    fireEvent.click(screen.getByText('Restablecer a MATLAB'))
    expect(screen.getByTestId('walk').textContent).toBe('0.75')
  })

  it('no aplica un campo vacío ni valores bajo el mínimo (velocidad 0 inmovilizaría a los trabajadores)', () => {
    render(<Harness />)
    const input = screen.getByTitle('MATLAB: 0,75').querySelector('input')
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.getByTestId('walk').textContent).toBe('0.75')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    fireEvent.change(input, { target: { value: '0' } })
    expect(screen.getByTestId('walk').textContent).toBe('0.75')
    fireEvent.change(input, { target: { value: '0.5' } })
    expect(screen.getByTestId('walk').textContent).toBe('0.5')
    expect(input.getAttribute('aria-invalid')).toBe('false')
  })

  it('solo muestra «Exportar corridas» si hay algo que exportar', () => {
    const onRun = vi.fn(),
      onExport = vi.fn()
    const { rerender } = render(<Harness onRun={onRun} />)
    expect(screen.queryByText('Exportar corridas')).toBeNull()
    fireEvent.click(screen.getByText('Simular'))
    expect(onRun).toHaveBeenCalled()
    rerender(<Harness onRun={onRun} onExport={onExport} />)
    fireEvent.click(screen.getByText('Exportar corridas'))
    expect(onExport).toHaveBeenCalled()
  })
})

describe('Validation', () => {
  const ref = {
    TimeWeightedAverageMetabolicRate: 1,
    AverageHumanProduction: 2,
    TotalHumanWorkload: 3,
    TotalProductionCargoZone: 4,
    RemainingCropsHumanBags: 5,
    RemainingCropsBoxes: 6,
    RemainingCropsRobot: 7,
    TotalRecollectedCrops: 8,
  }
  const cfg = { nw: 12, row: 3, act: 'mixed', rp: 0 }

  it('marca ✓ cuando coincide y la diferencia cuando no', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ 'HO|12|3|mixed|0': ref, 'HR|12|3|mixed|0': ref }) })),
    )
    render(<Validation ho={{ summary: ref }} hr={{ summary: { ...ref, TotalProductionCargoZone: 5 } }} cfg={cfg} params={DEFAULTS_SIM} base="/" />)
    await waitFor(() => expect(screen.getAllByText('✓').length).toBe(15))
    expect(screen.getByText('+1')).toBeTruthy()
    expect(screen.queryByText(/Cambiaste parámetros/)).toBeNull()
  })

  it('avisa cuando los parámetros no son los de MATLAB o no hay referencia', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    )
    render(<Validation ho={{ summary: ref }} hr={null} cfg={cfg} params={{ ...DEFAULTS_SIM, walkSpeed: 1 }} base="/" />)
    expect(screen.getByText(/Cambiaste parámetros/)).toBeTruthy()
    await waitFor(() => expect(screen.getByText(/no tiene esta configuración/)).toBeTruthy())
  })
})
