// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { ModelTab } from '../../src/workload/panels/ModelTab.jsx'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import FIS from '../../src/hrsim/goal_seeking.fis?raw'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const o = { nw: 6, row: 3, act: 'mixed', rp: 0, duration: 300, profile: 'hri' }
const hr = simToRun(new HRSim(o, FIS).run(), { robot: true })
const ho = simToRun(new HOSim(o).run(), { robot: false })

function Harness({ t = 200, initial = 2 }) {
  const [sel, setSel] = useState(initial)
  return (
    <>
      <ModelTab ho={ho} hr={hr} t={t} sel={sel} select={setSel} />
      <output data-testid="sel">{sel}</output>
    </>
  )
}

describe('ModelTab (pestaña Modelo)', () => {
  it('resalta el estado actual del cosechero elegido y sus transiciones', () => {
    const { container } = render(<Harness />)
    const i = hr.rowAt(200)
    const actual = hr.workers[1].state[i]
    const now = container.querySelector('.sm-node.now')
    expect(now.getAttribute('data-estado')).toBe(String(actual))
    expect(screen.getByTestId('sm-reglas').textContent).toMatch(new RegExp(`^${actual} · `))
  })

  it('clic en un estado muestra lo que lo hace cambiar, con los valores de la corrida', () => {
    const { container } = render(<Harness />)
    fireEvent.click(container.querySelector('[data-estado="7"]'))
    expect(screen.getByTestId('sm-reglas').textContent).toMatch(/Termina de subir \(5 s\)/)
    fireEvent.keyDown(container.querySelector('[data-estado="11"]'), { key: 'Enter' })
    expect(screen.getByTestId('sm-reglas').textContent).toMatch(/3,6 s por caja/)
  })

  it('el selector de cosechero sincroniza la selección global; la máquina sin robot tiene otros estados', () => {
    const { container } = render(<Harness />)
    fireEvent.change(screen.getByLabelText('Cosechero'), { target: { value: '4' } })
    expect(screen.getByTestId('sel').textContent).toBe('4')
    expect(screen.getByText('Tiempo de H4 en cada estado')).toBeTruthy()
    fireEvent.click(screen.getByText('Sin robot'))
    expect(container.querySelector('[data-estado="3"]')).toBeTruthy() // lleva la caja al acopio
    expect(container.querySelector('[data-estado="10"]')).toBeNull()
  })

  it('estados del robot con su tiempo y la descripción ODD se copia como Markdown', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<Harness />)
    expect(screen.getByTestId('sm-robot').querySelectorAll('.sm-chip')).toHaveLength(7)
    expect(screen.getByTestId('odd-inicializacion').textContent).toMatch(/Velocidad de caminata/)
    fireEvent.click(screen.getByTestId('odd-copiar'))
    await waitFor(() => expect(screen.getByText('Descripción copiada')).toBeTruthy())
    expect(writeText.mock.calls[0][0]).toMatch(/^## 1\. Propósito y patrones/)
  })

  it('sin corrida, un aviso', () => {
    render(<ModelTab ho={null} hr={null} t={0} sel={null} select={() => {}} />)
    expect(screen.getByText(/Simula o carga una corrida/)).toBeTruthy()
  })
})
