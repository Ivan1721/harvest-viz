// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { RobotPanel } from '../../src/workload/panels/RobotPanel.jsx'
import { Summary } from '../../src/workload/panels/Summary.jsx'
import { Analysis } from '../../src/workload/panels/Analysis.jsx'
import { DataPanel } from '../../src/workload/panels/DataPanel.jsx'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { analyzeHRI } from '../../src/workload/hri.js'
import FIS from '../../src/hrsim/goal_seeking.fis?raw'

afterEach(cleanup)

const o = { huerto: 'palta-alta-densidad', nw: 6, act: 'mixed', duration: 600, huertoParams: { hileras: 6, arbolesPorHilera: 12 } }
const conRobot = (r) => {
  const run = simToRun(new HRSim({ ...o, robotTipo: r }, FIS).run(), { robot: true })
  run.hri = analyzeHRI(run)
  return run
}
const warthog = conRobot('warthog'),
  burro = conRobot('burro')
const ho = simToRun(new HOSim(o).run(), { robot: false })

describe('Resultados por pregunta (I4)', () => {
  it('Robot: con una variante con robot, tabla lado a lado; el detalle es el de la principal', () => {
    render(<RobotPanel ho={burro} hr={warthog} labels={{ ho: 'Burro', hr: 'Warthog' }} t={100} seek={() => {}} />)
    const tabla = screen.getByTestId('robot-cmp')
    expect(tabla.textContent).toMatch(/Energía por kg entregado/)
    expect(tabla.querySelectorAll('th')[1].textContent).toBe('Burro')
    expect(screen.getByText('El detalle de abajo es el de Warthog.')).toBeTruthy()
    expect(screen.getByText('Energía usada · por kg entregado')).toBeTruthy()
  })

  it('Robot: sin variante no hay tabla; sin robot, un aviso', () => {
    render(<RobotPanel ho={ho} hr={warthog} labels={{ ho: 'Solo humano', hr: 'Humano-robot' }} t={0} seek={() => {}} />)
    expect(screen.queryByTestId('robot-cmp')).toBeNull()
    cleanup()
    render(<RobotPanel ho={ho} hr={null} labels={{ ho: '', hr: '' }} t={0} seek={() => {}} />)
    expect(screen.getByText(/requiere una corrida con robot/)).toBeTruthy()
  })

  it('Resumen: las columnas llevan el nombre de cada corrida y suma energía y espera de cajas', () => {
    render(<Summary ho={burro} hr={warthog} t={0} seek={() => {}} labels={{ ho: 'Burro', hr: 'Warthog' }} />)
    const ths = [...document.querySelectorAll('table.cmp th')].map((x) => x.textContent)
    expect(ths).toEqual(['Métrica', 'Burro', 'Warthog', 'Δ'])
    expect(screen.getByText('Energía del robot por kg entregado')).toBeTruthy()
    expect(screen.getByText('Espera media de las cajas')).toBeTruthy()
  })

  it('Interacción y Datos: posiciones exactas en el simulador, reconstruidas en las corridas de MATLAB', () => {
    render(<Analysis run={warthog} i={0} seek={() => {}} select={() => {}} />)
    expect(screen.getByTestId('nota-posiciones').textContent).toBe('Posiciones exactas: el simulador registra la pose de cada agente cada 0,25 s.')
    cleanup()
    const matlab = { ...warthog, meta: { ...warthog.meta, simulated: undefined } }
    render(<Analysis run={matlab} i={0} seek={() => {}} select={() => {}} />)
    expect(screen.getByTestId('nota-posiciones').textContent).toMatch(/^Posiciones reconstruidas/)
    cleanup()
    render(<DataPanel ho={ho} hr={warthog} />)
    expect(screen.getByTestId('nota-posiciones').textContent).toMatch(/^Posiciones exactas/)
    cleanup()
    render(<DataPanel ho={null} hr={matlab} />)
    expect(screen.getByTestId('nota-posiciones').textContent).toMatch(/^Los CSV de MATLAB/)
  })

  it('Interacción: decimales con coma y duraciones con una sola regla', () => {
    render(<Analysis run={warthog} i={0} seek={() => {}} select={() => {}} />)
    const txt = document.body.textContent
    expect(txt).not.toMatch(/\d\.\d+ m/)
    expect(txt).toMatch(/\d,\d{2} m/)
  })
})
