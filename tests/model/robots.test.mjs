// Robots y energía (antes de H5): datos de fabricante, energía calibrada, tracción, frenada y carro de arrastre.
import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { resolveParams } from '../../src/hrsim/common.js'
import { ROBOTS, potencia, fuerzaAvance, limiteTraccion, frenadaEfectiva } from '../../src/hrsim/robots.js'
import { FIS } from '../helpers.mjs'

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`)

test('calibración: el Burro con 136 kg a 1,2 m/s en plano agota 2,4 kWh en 16 km (± 2 %)', () => {
  const e = ROBOTS.burro.energia
  const P = potencia(146 + 136, 1.2, 0, 0, e)
  const km = ((e.bateriaWh / P) * 3600 * 1.2) / 1000
  assert.ok(Math.abs(km - 16) / 16 <= 0.02, `${km.toFixed(2)} km`)
  // detenido: solo la electrónica; subir cuesta más que bajar; sin regeneración (nunca bajo P_aux)
  near(potencia(300, 0, 0, 0, e), e.paux)
  assert.ok(potencia(300, 1, 0, 0.1, e) > potencia(300, 1, 0, -0.1, e))
  assert.ok(potencia(300, 1, -3, -0.3, e) >= e.paux)
})

test('tracción: el Burro sube 15 % con 250 kg (ficha) y con el carro lleno solo hasta ≈ 8 %', () => {
  const e = ROBOTS.burro.energia
  const th = (pct) => Math.atan(pct / 100)
  assert.ok(fuerzaAvance(146 + 250, th(15), e) <= limiteTraccion(146, th(15)))
  const mCarro = 146 + 60 + 390
  assert.ok(fuerzaAvance(mCarro, th(7), e) <= limiteTraccion(146, th(7)))
  assert.ok(fuerzaAvance(mCarro, th(9), e) > limiteTraccion(146, th(9)))
  assert.ok(fuerzaAvance(mCarro, 0, e) <= limiteTraccion(146, 0), 'en plano sí lo arrastra')
})

test('frenada: el robot solo frena igual en ladera; con el carro sin freno, cuesta abajo no puede detenerse', () => {
  const th20 = -Math.atan(0.2) // cuesta abajo
  near(frenadaEfectiva(1.5, th20, 300, 300), 1.5)
  assert.ok(frenadaEfectiva(1.5, th20, 146, 596) < 0.3)
  near(frenadaEfectiva(1.5, 0, 146, 596), 1.5) // en plano, con μ = 0,65, el suelo permite 1,56: manda el control
})

test('parámetros: capacidad real en huertos generados, 68 cajas y sin energía en el mapa del estudio', () => {
  assert.equal(resolveParams({}).capacityBoxes, 68)
  assert.equal(resolveParams({}).energia, undefined)
  assert.equal(resolveParams({}).robotTipo, undefined)
  const H = { huerto: 'palta-alta-densidad' }
  assert.equal(resolveParams(H).capacityBoxes, 18)
  assert.equal(resolveParams({ ...H, robotTipo: 'burro' }).capacityBoxes, 15)
  assert.equal(resolveParams({ ...H, robotTipo: 'burro-carro' }).capacityBoxes, 26)
  assert.equal(resolveParams({ ...H, capacityBoxes: 40 }).capacityBoxes, 40, 'un valor explícito manda')
  assert.throws(() => resolveParams({ ...H, robotTipo: 'tractor' }), /robotTipo/)
})

for (const robotTipo of Object.keys(ROBOTS))
  test(`${robotTipo} en alta densidad: energía creciente, nunca más carga que su capacidad, el carro no roza copas`, () => {
    const s = new HRSim({ huerto: 'palta-alta-densidad', nw: 12, act: 'mixed', duration: 1800, robotTipo }, FIS).run()
    const r = s.rec,
      cap = ROBOTS[robotTipo].capacidad * 15
    for (let i = 1; i < r.t.length; i++) assert.ok(r.energy[i] >= r.energy[i - 1])
    assert.ok(Math.max(...r.onboard) <= cap)
    const sm = s.summary()
    assert.ok(sm.energyWh > 0 && sm.batteryPct < 100)
    assert.ok(sm.unloads >= 1)
    const cr = ROBOTS[robotTipo].carro
    if (cr)
      for (let i = 0; i < r.t.length; i += 2)
        for (const a of s.huerto.arboles) assert.ok(Math.hypot(a.x - r.cx[i], a.y - r.cy[i]) - a.radio >= cr.ancho / 2, `carro a ${r.cx[i]}, ${r.cy[i]}`)
    else assert.ok(r.cx.every((v) => Number.isNaN(v)))
  })

test('ladera 20 %: el Burro con carro lleno se queda sin tracción; el Warthog no', () => {
  const o = { huerto: 'palta-ladera', nw: 12, act: 'mixed', duration: 2700 }
  const b = new HRSim({ ...o, robotTipo: 'burro-carro' }, FIS).run().summary()
  const w = new HRSim({ ...o, robotTipo: 'warthog' }, FIS).run().summary()
  assert.ok(b.tractionLimited_s > 0)
  assert.equal(w.tractionLimited_s, 0)
  assert.ok(b.TotalProductionCargoZone_crop_units < w.TotalProductionCargoZone_crop_units)
})
