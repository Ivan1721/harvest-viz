// I3: las máquinas de estado de la pestaña Modelo coinciden con lo que hace el motor.
// Se corren configuraciones que recorren todos los caminos (escalera, robot, árboles que se agotan) y cada cambio de
// estado observado tick a tick debe estar en la lista de transiciones del diagrama.
import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { profileDefaults } from '../../src/hrsim/common.js'
import {
  ESTADOS_HO,
  ESTADOS_HR,
  ESTADOS_ROBOT,
  TRANSICIONES_HO,
  TRANSICIONES_HR,
  describirModelo,
  oddMarkdown,
  tiempoPorEstado,
  valoresReglas,
} from '../../src/workload/modelo.js'
import { FIS } from '../helpers.mjs'

const CASOS = [
  { nw: 12, row: 3, act: 'mixed', rp: 0, duration: 2700 }, // mapa del estudio, con escalera
  { huerto: 'palta-tradicional', nw: 12, act: 'mixed', duration: 1800, huertoParams: { cargaArbol: 8 } }, // árboles que se agotan
  { huerto: 'palta-alta-densidad', nw: 24, act: 'mixed', duration: 3600, huertoParams: { hileras: 8, arbolesPorHilera: 12, cargaArbol: 10 } }, // sin tramos
]

function observadas(sim) {
  const pares = new Set(),
    estados = new Set()
  for (const s of sim.rec.wst)
    for (let i = 0; i < s.length; i++) {
      estados.add(s[i])
      if (i && s[i] !== s[i - 1]) pares.add(`${s[i - 1]}→${s[i]}`)
    }
  return { pares, estados }
}

for (const [nombre, Sim, ESTADOS, TRANS] of [
  ['con robot', (o) => new HRSim(o, FIS).run(), ESTADOS_HR, TRANSICIONES_HR],
  ['sin robot', (o) => new HOSim(o).run(), ESTADOS_HO, TRANSICIONES_HO],
]) {
  test(`cosechero ${nombre}: todo estado y todo cambio de estado del motor está en el diagrama`, () => {
    const ids = new Set(ESTADOS.map((e) => e.id))
    const lista = new Set(TRANS.map((x) => `${x.de}→${x.a}`))
    for (const x of TRANS) assert.ok(ids.has(x.de) && ids.has(x.a), `${x.de}→${x.a} usa un estado que no está en el diagrama`)
    const vistos = new Set()
    for (const o of CASOS) {
      const { pares, estados } = observadas(Sim(o))
      for (const e of estados) if (e !== 0) assert.ok(ids.has(e), `estado ${e} sin nodo`)
      for (const p of pares) {
        if (p.startsWith('0→')) continue // estado inicial del registro
        assert.ok(lista.has(p), `transición ${p} no documentada (${JSON.stringify(o)})`)
        vistos.add(p)
      }
    }
    assert.ok(vistos.size >= TRANS.length * 0.6, `se recorrió ${vistos.size} de ${TRANS.length} transiciones`)
  })
}

test('robot: sus estados registrados son los del diagrama (0–5)', () => {
  const s = new HRSim({ ...profileDefaults('hri', 'palta-ladera', 'burro'), nw: 12, act: 'mixed', duration: 900 }, FIS).run()
  const ids = new Set(ESTADOS_ROBOT.map((e) => e.id))
  for (const v of new Set(s.rec.rst)) assert.ok(ids.has(v), `estado del robot ${v}`)
  const t = tiempoPorEstado(Uint8Array.from(s.rec.rst), 0.25)
  assert.ok(Math.abs([...t.values()].reduce((a, b) => a + b, 0) - s.rec.rst.length * 0.25) < 1e-9)
  assert.equal(tiempoPorEstado(null, 0.25).size, 0)
})

test('descripción ODD: seis secciones, valores de la corrida y Markdown', () => {
  const p = { ...profileDefaults('hri', 'uva-parron', 'burro'), semilla: 2, variacionRitmo: 0.1 }
  const d = describirModelo(p)
  assert.deepEqual(
    d.map((s) => s.id),
    ['proposito', 'entidades', 'proceso', 'diseno', 'inicializacion', 'submodelos'],
  )
  const ini = d.find((s) => s.id === 'inicializacion').tabla
  assert.equal(ini.find((f) => f.k === 'maxProd').valor, 9)
  assert.equal(ini.find((f) => f.k === 'ssm.a').supuesto, true)
  assert.equal(ini.find((f) => f.k === 'ssm.vh').supuesto, false)
  const md = oddMarkdown(d, { dt: 0.25 })
  assert.match(md, /^## 1\. Propósito y patrones/)
  assert.match(md, /semilla 2; el ritmo de cada cosechero varía ±10 %/)
  assert.match(md, /\| Unidades por caja \| 9 \|/)
  assert.match(md, /ticks de 0.25 s/)
  // mapa del estudio: sin generador ni energía
  const m = describirModelo(profileDefaults('matlab-2026'))
  assert.equal(
    m.find((s) => s.id === 'inicializacion').tabla.some((f) => f.k.startsWith('huertoParams')),
    false,
  )
  assert.equal(valoresReglas(profileDefaults('matlab-2026')).tResume, '—')
  assert.equal(valoresReglas(p).ladderTime, '5')
})
