// R1: selector de calidad de la escena en «Capas y estilo».
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react'
import { ViewBar } from '../../src/workload/panels/ViewBar.jsx'

afterEach(cleanup)

const base = {
  view: 'hr',
  setView: () => {},
  hasHO: true,
  hasHR: true,
  preset: 'iso',
  setPreset: () => {},
  setLook: () => {},
  canopy: 0.8,
  setCanopy: () => {},
  colorBy: 'rate',
  setColorBy: () => {},
  ov: { zones: false, intent: false, plantas: true },
  setOv: () => {},
}

describe('ViewBar · calidad de la escena', () => {
  it('en estilo Realista ofrece Alta y Básica y avisa el cambio', () => {
    const setCalidad = vi.fn()
    render(<ViewBar {...base} look="real" calidad="alta" setCalidad={setCalidad} />)
    const grupo = screen.getByRole('group', { name: 'Calidad' })
    expect(within(grupo).getByRole('button', { name: 'Alta' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(grupo).getByRole('button', { name: 'Básica' }))
    expect(setCalidad).toHaveBeenCalledWith('basica')
  })

  it('en estilo Esquemático no hay selector de calidad (no aplica)', () => {
    render(<ViewBar {...base} look="schem" calidad="alta" setCalidad={() => {}} />)
    expect(screen.queryByRole('group', { name: 'Calidad' })).toBeNull()
  })
})
