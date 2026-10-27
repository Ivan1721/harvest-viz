// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react'
import { SimSteps, SimAction, DEFAULTS_SIM, CFG0, changedSteps, resetStep, listaCambios } from '../../src/workload/panels/SimPanel.jsx'
import { profileDefaults } from '../../src/hrsim/common.js'
import { Validation } from '../../src/workload/panels/Validation.jsx'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Harness({ onRun = () => {}, onExport, stale = false, start = DEFAULTS_SIM }) {
  const [params, setParams] = useState(start)
  const [cfg, setCfg] = useState({ nw: 12, row: 3, act: 'mixed', rp: 0 })
  return (
    <>
      <SimSteps
        params={params}
        setParams={setParams}
        cfg={cfg}
        pickCfg={(k, v) => setCfg((c) => ({ ...c, [k]: v }))}
        onRun={onRun}
        busy={false}
        stale={stale}
        info="Simulado en 1 ms"
        onExport={onExport}
      />
      <output data-testid="walk">{params.walkSpeed}</output>
      <output data-testid="huerto">{params.huerto}</output>
      <output data-testid="nw">{cfg.nw}</output>
      <output data-testid="avance">{params.avance ?? ''}</output>
      <output data-testid="reparto">{params.reparto ? JSON.stringify(params.reparto) : ''}</output>
      <output data-testid="carga">{params.carga ? JSON.stringify(params.carga) : ''}</output>
      <output data-testid="acopio">{params.acopio ? JSON.stringify(params.acopio) : ''}</output>
    </>
  )
}

describe('SimSteps (panel izquierdo del Simulador)', () => {
  it('tres pasos en orden: Escenario, Agentes, Simulación', () => {
    render(<Harness />)
    const titles = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(titles).toEqual(['1Escenario', '2Agentes', '3Simulación'])
  })

  it('edita un parámetro de la cuadrilla, marca el paso Agentes y lo restablece', () => {
    render(<Harness />)
    expect(screen.getByTestId('crew-params').textContent).toBe('Ajustar la cuadrilla')
    expect(screen.queryByTestId('reset-2')).toBeNull()
    const input = screen.getByTitle('MATLAB: 0,75').querySelector('input')
    fireEvent.change(input, { target: { value: '1.1' } })
    expect(screen.getByTestId('walk').textContent).toBe('1.1')
    expect(screen.getByTestId('crew-params').textContent).toMatch(/modificado/)
    expect(screen.getByTestId('step-agentes').querySelector('.step-dot')).toBeTruthy()
    expect(screen.getByTestId('step-escenario').querySelector('.step-dot')).toBeNull()
    fireEvent.click(screen.getByTestId('reset-2'))
    expect(screen.getByTestId('walk').textContent).toBe('0.75')
    expect(screen.getByTestId('step-agentes').querySelector('.step-dot')).toBeNull()
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

  it('cambiar el huerto, el robot o la cuadrilla no simula: solo «Simular» dispara', () => {
    const onRun = vi.fn()
    render(<Harness onRun={onRun} />)
    fireEvent.click(screen.getByText('Alta densidad'))
    expect(screen.getByTestId('huerto').textContent).toBe('palta-alta-densidad')
    fireEvent.click(screen.getByText('Burro con carro'))
    fireEvent.click(screen.getByText('16'))
    expect(screen.getByTestId('nw').textContent).toBe('16')
    expect(screen.getByTestId('robot-info').textContent).toMatch(/26 cajas de 15 kg/)
    expect(screen.queryByRole('button', { name: 'Escalera' })).toBeNull() // alta densidad: sin escalera
    expect(screen.queryByText('Fila de cultivo')).toBeNull()
    expect(onRun).not.toHaveBeenCalled()
    fireEvent.click(screen.getByTestId('sim-run'))
    expect(onRun).toHaveBeenCalledTimes(1)
  })

  it('el comportamiento del robot reemplaza a «Modelo»: como en MATLAB o con regla de seguridad', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Con regla de seguridad'))
    fireEvent.click(screen.getByTestId('robot-params'))
    expect(screen.getByText('Regla de seguridad activa')).toBeTruthy()
  })

  it('con cambios sin simular, el botón Simular se destaca y lo dice', () => {
    render(<Harness stale />)
    expect(screen.getByTestId('sim-run').className).toMatch(/primary/)
    expect(screen.getByText('Hay cambios sin simular.')).toBeTruthy()
  })

  it('solo muestra «Exportar corridas» si hay algo que exportar', () => {
    const onRun = vi.fn(),
      onExport = vi.fn()
    const { rerender } = render(<Harness onRun={onRun} />)
    expect(screen.queryByText('Exportar corridas')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Simular' }))
    expect(onRun).toHaveBeenCalled()
    rerender(<Harness onRun={onRun} onExport={onExport} />)
    fireEvent.click(screen.getByText('Exportar corridas'))
    expect(onExport).toHaveBeenCalled()
  })

  it('escenario en dos niveles: cultivo y luego sistema; un cultivo con un solo sistema no muestra el segundo nivel', () => {
    render(<Harness />)
    expect(screen.getByText('Mapa del estudio')).toBeTruthy()
    fireEvent.click(screen.getByText('Uva de mesa'))
    expect(screen.getByTestId('huerto').textContent).toBe('uva-parron')
    expect(screen.queryByText('Sistema')).toBeNull()
    expect(screen.getByTestId('huerto-info').textContent).toMatch(/caja de 9 kg/)
    fireEvent.click(screen.getByText('Palta'))
    expect(screen.getByTestId('huerto').textContent).toBe('palta-tradicional')
    expect(screen.getByText('Sistema')).toBeTruthy()
  })

  it('terreno visible y restablecer por paso: solo vuelve a los valores de ese paso', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Ladera'))
    const pend = screen.getByLabelText('Pendiente a lo largo de las hileras (%)')
    expect(pend.value).toBe('20')
    fireEvent.change(pend, { target: { value: '30' } })
    fireEvent.change(screen.getByTitle('MATLAB: 0,75').querySelector('input'), { target: { value: '1' } })
    expect(screen.getByTestId('step-escenario').querySelector('.step-dot')).toBeTruthy()
    fireEvent.click(screen.getByTestId('reset-1'))
    expect(screen.getByLabelText('Pendiente a lo largo de las hileras (%)').value).toBe('20')
    expect(screen.getByTestId('walk').textContent).toBe('1') // el paso 2 no se toca
    expect(screen.getByTestId('step-agentes').querySelector('.step-dot')).toBeTruthy()
  })

  it('ficha del robot: ancho, carga, batería y si cabe en las calles', () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('Arándano'))
    expect(screen.getByTestId('robot-info').textContent).toMatch(/1,38 m de ancho · 272 kg de carga · batería 2,4 kWh/)
    expect(screen.getByTestId('robot-info').textContent).toMatch(/no cabe/)
    fireEvent.click(screen.getByText('Burro con carro'))
    expect(screen.getByTestId('robot-info').textContent).toMatch(/carro de 60 kg/)
    expect(screen.getByTestId('robot-info').textContent).toMatch(/entra a las calles/)
  })

  it('H7: «Acopiador y camión» agrega el acopio con sus valores, se ajusta y se quita con restablecer el paso 1', () => {
    render(<Harness />)
    expect(screen.getByTestId('acopio').textContent).toBe('')
    fireEvent.click(screen.getByTestId('acopio-on'))
    expect(JSON.parse(screen.getByTestId('acopio').textContent)).toMatchObject({ binKg: 380, camionBins: 4, topeBins: 8 })
    expect(screen.getByTestId('step-escenario').querySelector('.step-dot')).toBeTruthy()
    fireEvent.click(screen.getByText('Ajustar el acopio'))
    const bins = screen.getByLabelText('Bins por camión')
    fireEvent.change(bins, { target: { value: '2.5' } })
    fireEvent.blur(bins)
    expect(JSON.parse(screen.getByTestId('acopio').textContent).camionBins).toBe(4) // entero
    fireEvent.change(bins, { target: { value: '6' } })
    fireEvent.blur(bins)
    expect(JSON.parse(screen.getByTestId('acopio').textContent).camionBins).toBe(6)
    fireEvent.click(screen.getByTestId('reset-1'))
    expect(screen.getByTestId('acopio').textContent).toBe('')
    expect(screen.queryByText('Ajustar el acopio')).toBeNull()
  })

  it('H7 B: «Carga variable y ritmo que cae» solo en huertos generados, con el CV del cultivo y la fruta que se deja', () => {
    render(<Harness />)
    expect(screen.queryByTestId('carga-on')).toBeNull() // mapa del estudio: sin fruta por árbol
    fireEvent.click(screen.getByText('Tradicional'))
    fireEvent.click(screen.getByTestId('carga-on'))
    expect(JSON.parse(screen.getByTestId('carga').textContent)).toEqual({ cv: 0.5, k: 460, umbral: 2 })
    expect(screen.getByText(/lo deja con 4[,.]5 % de su fruta/)).toBeTruthy()
    fireEvent.click(screen.getByText('Ajustar la carga y el ritmo'))
    const u = screen.getByLabelText('Deja el árbol cuando el periodo supera (× T₀)')
    fireEvent.change(u, { target: { value: '1' } })
    fireEvent.blur(u)
    expect(JSON.parse(screen.getByTestId('carga').textContent).umbral).toBe(2) // bajo el mínimo: no se aplica
    fireEvent.click(screen.getByTestId('carga-on'))
    expect(screen.getByTestId('carga').textContent).toBe('')
  })

  it('H7 C: avance del bloque (paso 1) y reparto de la cuadrilla (paso 2), con su restablecer', () => {
    render(<Harness />)
    expect(screen.queryByRole('group', { name: 'Reparto de la cuadrilla' })).toBeNull()
    fireEvent.click(screen.getByText('Alta densidad'))
    fireEvent.click(screen.getByRole('button', { name: '50 %' }))
    expect(screen.getByTestId('avance').textContent).toBe('0.5')
    const rep = screen.getByRole('group', { name: 'Reparto de la cuadrilla' })
    fireEvent.click(within(rep).getByText('Frente'))
    expect(JSON.parse(screen.getByTestId('reparto').textContent)).toEqual({ modo: 'frente', tramo: 4 })
    expect(screen.getByTestId('reparto-nota').textContent).toMatch(/tramos cortos/)
    const tr = screen.getByLabelText('Árboles por tramo')
    fireEvent.change(tr, { target: { value: '6' } })
    fireEvent.blur(tr)
    expect(JSON.parse(screen.getByTestId('reparto').textContent).tramo).toBe(6)
    fireEvent.click(within(rep).getByText('Repartida'))
    expect(JSON.parse(screen.getByTestId('reparto').textContent)).toEqual({ modo: 'repartida', tramo: 6 })
    fireEvent.click(screen.getByTestId('reset-2'))
    expect(screen.getByTestId('reparto').textContent).toBe('')
    expect(screen.getByTestId('avance').textContent).toBe('0.5') // el paso 1 no se toca
    fireEvent.click(screen.getByTestId('reset-1'))
    expect(screen.getByTestId('avance').textContent).toBe('')
  })

  it('changedSteps asigna cada parámetro a su paso', () => {
    const base = profileDefaults('matlab-2026', 'palta-tradicional')
    expect([...changedSteps(base, base)]).toEqual([])
    expect([...changedSteps({ ...base, huertoParams: { ...base.huertoParams, hileras: 3 } }, base)]).toEqual([1])
    expect([...changedSteps({ ...base, capacityBoxes: 3 }, base)]).toEqual([2])
    expect([...changedSteps({ ...base, duration: 600 }, base)]).toEqual([3])
    const mod = { ...base, duration: 600, capacityBoxes: 3 }
    expect(resetStep(mod, base, 3)).toEqual({ ...base, capacityBoxes: 3 })
    expect([...changedSteps(resetStep(mod, base, 2), base)]).toEqual([3])
  })

  it('changedSteps ve la cuadrilla (cfg): cosecheros y actividad en el paso 2; fila y disposición en el 1, solo en el mapa del estudio', () => {
    const m = DEFAULTS_SIM,
      g = profileDefaults('matlab-2026', 'palta-tradicional')
    expect([...changedSteps(m, m, CFG0)]).toEqual([])
    expect([...changedSteps(m, m, { ...CFG0, nw: 16 })]).toEqual([2])
    expect([...changedSteps(m, m, { ...CFG0, act: 'ground' })]).toEqual([2])
    expect([...changedSteps(m, m, { ...CFG0, row: 1 })]).toEqual([1])
    expect([...changedSteps(g, g, { ...CFG0, rp: 1 })]).toEqual([])
  })

  it('el punto «modificado» se enciende con los cosecheros y «Restablecer» los devuelve', () => {
    render(<Harness />)
    const paso2 = screen.getByTestId('step-agentes')
    expect(within(paso2).queryByTestId('reset-2')).toBeNull()
    fireEvent.click(within(paso2).getByRole('button', { name: '16' }))
    expect(screen.getByTestId('nw').textContent).toBe('16')
    fireEvent.click(within(paso2).getByTestId('reset-2'))
    expect(screen.getByTestId('nw').textContent).toBe('12')
    expect(within(paso2).queryByTestId('reset-2')).toBeNull()
  })

  it('barra de acción: principal solo con cambios, los nombra; al día sin ellos; Cancelar mientras simula', () => {
    const onRun = vi.fn(),
      onCancel = vi.fn()
    const { rerender } = render(<SimAction onRun={onRun} onCancel={onCancel} fresh />)
    expect(screen.getByTestId('sim-run').className).not.toMatch(/primary/)
    expect(screen.getByTestId('sim-estado').textContent).toBe('Resultados al día.')
    expect(screen.getByTestId('sim-run').getAttribute('aria-keyshortcuts')).toMatch(/Control\+Enter/)
    rerender(<SimAction onRun={onRun} onCancel={onCancel} stale cambios={['Cosecheros', 'Duración (s)', 'Hileras', 'Robot']} />)
    expect(screen.getByTestId('sim-run').className).toMatch(/primary/)
    expect(screen.getByTestId('sim-estado').textContent).toBe('Hay 4 cambios sin simular: Cosecheros, Duración (s), Hileras +1 más.')
    fireEvent.click(screen.getByRole('button', { name: 'Simular' }))
    expect(onRun).toHaveBeenCalledTimes(1)
    rerender(<SimAction onRun={onRun} onCancel={onCancel} stale cambios={['Cosecheros']} />)
    expect(screen.getByTestId('sim-estado').textContent).toBe('Hay 1 cambio sin simular: Cosecheros.')
    rerender(<SimAction onRun={onRun} onCancel={onCancel} busy stale />)
    expect(screen.queryByTestId('sim-estado')).toBeNull()
    fireEvent.click(screen.getByTestId('sim-cancel'))
    expect(onCancel).toHaveBeenCalled()
    expect(listaCambios(['a', 'b'])).toBe('a, b')
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
