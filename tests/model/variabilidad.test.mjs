// H6: variabilidad opcional entre cosecheros (semilla). Sin semilla todo sigue determinista y la réplica no cambia.
import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { resolveParams, paramsHash, mulberry32 } from '../../src/hrsim/common.js'
import { FIS } from '../helpers.mjs'

const O = { huerto: 'palta-alta-densidad', nw: 12, act: 'mixed', duration: 900 }

test('sin semilla no hay parámetros nuevos: el hash de la réplica y de los huertos no cambia', () => {
  for (const o of [{}, O]) {
    const p = resolveParams(o)
    assert.equal('semilla' in p, false)
    assert.equal('variacionRitmo' in p, false)
    assert.equal(paramsHash(resolveParams({ ...o, semilla: null })), paramsHash(p))
  }
  assert.throws(() => resolveParams({ semilla: 1.5 }), /semilla/)
  assert.throws(() => resolveParams({ semilla: 1, variacionRitmo: 1 }), /variacionRitmo/)
})

test('mulberry32: reproducible y uniforme en [0, 1)', () => {
  const a = mulberry32(7),
    b = mulberry32(7)
  const xs = Array.from({ length: 5000 }, () => a())
  assert.deepEqual(
    xs.slice(0, 5),
    Array.from({ length: 5 }, () => b()),
  )
  assert.ok(xs.every((x) => x >= 0 && x < 1))
  const m = xs.reduce((s, x) => s + x, 0) / xs.length
  assert.ok(Math.abs(m - 0.5) < 0.02, `media ${m}`)
})

test('con semilla: cada cosechero tiene su ritmo (±10 %), el mismo en HO y HR, y la corrida es reproducible', () => {
  const o = { ...O, semilla: 4 }
  const hr = new HRSim(o, FIS).run(),
    hr2 = new HRSim(o, FIS).run(),
    ho = new HOSim(o).run()
  const r = hr.W.map((w) => w.ritmo)
  assert.ok(r.every((x) => x >= 0.9 && x <= 1.1))
  assert.ok(new Set(r).size === r.length, 'ritmos distintos')
  assert.deepEqual(
    ho.W.map((w) => w.ritmo),
    r,
  )
  assert.deepEqual(hr2.summary(), hr.summary())
  const otra = new HRSim({ ...O, semilla: 5 }, FIS).run()
  assert.notDeepEqual(
    otra.W.map((w) => w.ritmo),
    r,
  )
})

test('el periodo fraccionario conserva el resto: el ritmo medio de cosecha es el pedido', () => {
  // un cosechero sin robot en un árbol con mucha fruta: cosecha ∝ 1 / (periodo × ritmo)
  const o = { huerto: 'palta-alta-densidad', nw: 1, act: 'ground', duration: 600, huertoParams: { cargaArbol: 500 } }
  const base = new HOSim(o).run().summary().TotalRecollectedCrops_crop_units
  // variación 0: mismo camino de código con ritmo 1 → idéntico a la corrida sin semilla
  assert.equal(new HOSim({ ...o, semilla: 11, variacionRitmo: 0 }).run().summary().TotalRecollectedCrops_crop_units, base)
  const s = new HOSim({ ...o, semilla: 7 }).run() // ritmo 0,902
  const u = s.summary().TotalRecollectedCrops_crop_units,
    esperado = base / s.W[0].ritmo
  assert.ok(Math.abs(s.W[0].ritmo - 1) > 0.02, 'el sorteo se aleja de 1')
  assert.ok(Math.abs(u - esperado) <= s.p.costProduction * s.p.dt + 1e-9, `${u} vs ${esperado.toFixed(2)}`)
})
