// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { RobotPanel } from '../../src/workload/panels/RobotPanel.jsx'
import { Summary } from '../../src/workload/panels/Summary.jsx'
import { Analysis } from '../../src/workload/panels/Analysis.jsx'
import { DataPanel } from '../../src/workload/panels/DataPanel.jsx'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { analyzeHRI } from '../../src/workload/hri.js'
import { analizarFlota } from '../../src/workload/flota.js'
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
const conFlota = (n, estrategia = 'zonas') => {
  const run = simToRun(new HRSim({ ...o, nw: 12, flota: { n, estrategia } }, FIS).run(), { robot: true })
  run.hri = analizarFlota(run)
  return run
}
const flota2 = conFlota(2)

describe('Resultados por pregunta (I4)', () => {
  it('Robot: con una variante con robot, tabla lado a lado; el detalle es el de la principal', () => {
    render(<RobotPanel ho={burro} hr={warthog} labels={{ ho: 'Burro', hr: 'Warthog' }} t={100} seek={() => {}} />)
    const tabla = screen.getByTestId('robot-cmp')
    expect(tabla.textContent).toMatch(/Energía por kg entregado/)
    expect(tabla.querySelectorAll('th')[1].textContent).toBe('Burro')
    expect(screen.getByText('El detalle de abajo es el de Warthog.')).toBeTruthy()
    expect(screen.getByText('Energía usada · por kg entregado')).toBeTruthy()
  })

  it('H8: con flota, una columna por robot y el total; el detalle es el de la flota o el de un robot', () => {
    render(<RobotPanel ho={null} hr={flota2} labels={{ ho: '', hr: '' }} t={100} seek={() => {}} />)
    const tabla = screen.getByTestId('flota-tabla')
    expect([...tabla.querySelectorAll('th')].map((x) => x.textContent)).toEqual(['Métrica', 'RB-01', 'RB-02', 'Flota'])
    expect(tabla.textContent).toMatch(/Cajas atendidas/)
    expect(tabla.textContent).toMatch(/Esperando calle libre/)
    expect(tabla.textContent).toMatch(/Cediendo el paso/)
    // cada fila: un valor por robot y el de la flota
    for (const tr of tabla.querySelectorAll('tbody tr')) expect(tr.querySelectorAll('td').length).toBe(4)
    expect(screen.getByText('Equilibrio de cajas entre robots (Jain)')).toBeTruthy()
    expect(screen.getByText('Distancia mínima entre robots (toda la corrida)')).toBeTruthy()
    // sin variante no hay la tabla de comparación entre corridas
    expect(screen.queryByTestId('robot-cmp')).toBeNull()
    // el detalle: la flota por defecto; un robot lo cambia
    const det = screen.getByRole('group', { name: 'Detalle de' })
    expect(
      within(det)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Flota', 'RB-01', 'RB-02'])
    expect(within(det).getByRole('button', { name: 'Flota' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(within(det).getByRole('button', { name: 'RB-02' }))
    expect(within(det).getByRole('button', { name: 'RB-02' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('Energía usada · por kg entregado')).toBeTruthy()
  })

  it('H8: con tres robots la tabla tiene tres columnas; con un robot no hay tabla de la flota', () => {
    render(<RobotPanel ho={null} hr={conFlota(3, 'desfase')} labels={{ ho: '', hr: '' }} t={0} seek={() => {}} />)
    expect([...screen.getByTestId('flota-tabla').querySelectorAll('th')].map((x) => x.textContent)).toEqual(['Métrica', 'RB-01', 'RB-02', 'RB-03', 'Flota'])
    cleanup()
    render(<RobotPanel ho={null} hr={warthog} labels={{ ho: '', hr: '' }} t={0} seek={() => {}} />)
    expect(screen.queryByTestId('flota-tabla')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Detalle de' })).toBeNull()
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

  it('H8: Interacción avisa que con flota la geometría es con el robot más cercano', () => {
    render(<Analysis run={flota2} i={0} seek={() => {}} select={() => {}} />)
    expect(screen.getByTestId('nota-flota-hri').textContent).toMatch(/robot más cercano a cada trabajador/)
    cleanup()
    render(<Analysis run={warthog} i={0} seek={() => {}} select={() => {}} />)
    expect(screen.queryByTestId('nota-flota-hri')).toBeNull()
  })

  it('H8: el resumen dice «de la flota» cuando alguna corrida tiene flota', () => {
    render(<Summary ho={warthog} hr={flota2} t={0} seek={() => {}} labels={{ ho: 'Con 1 robot', hr: 'Con 2 robots' }} />)
    expect(screen.getByText('Entregado por la flota')).toBeTruthy()
    expect(screen.getByText('Energía de la flota por kg entregado')).toBeTruthy()
    expect(screen.queryByText('Entregado por el robot')).toBeNull()
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
