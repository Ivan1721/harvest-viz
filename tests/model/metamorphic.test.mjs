// Pruebas metamórficas: relaciones entre corridas que deben cumplirse aunque no conozcamos el valor "correcto".
import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { DEFAULTS } from '../../src/hrsim/common.js'
import { FIS } from '../helpers.mjs'

const make = (kind, cfg) => (kind === 'HR' ? new HRSim(cfg, FIS) : new HOSim(cfg)).run()
const base = { nw: 8, row: 2, act: 'mixed', rp: 0, duration: 900 }

for (const kind of ['HO', 'HR']) {
  test(`${kind}: alargar la sesión no cambia lo ya ocurrido (prefijo)`, () => {
    const a = make(kind, base),
      b = make(kind, { ...base, duration: 1800 })
    const n = a.rec.t.length
    for (const k of ['delivered', 'work']) assert.deepEqual(b.rec[k].slice(0, n), a.rec[k], k)
    for (let h = 0; h < a.NH; h++) {
      assert.deepEqual(b.rec.prod[h].slice(0, n), a.rec.prod[h])
      assert.deepEqual(b.rec.wx[h].slice(0, n), a.rec.wx[h])
    }
  })

  test(`${kind}: escalar el multiplicador metabólico escala la carga y no cambia la producción`, () => {
    const a = make(kind, base),
      b = make(kind, { ...base, metabolicMultiplier: 1.7 })
    const sa = a.summary(),
      sb = b.summary()
    assert.ok(Math.abs(sb.TotalHumanWorkload_kcal / sa.TotalHumanWorkload_kcal - 1.7) < 1e-9)
    assert.equal(sb.TotalRecollectedCrops_crop_units, sa.TotalRecollectedCrops_crop_units)
    assert.deepEqual(b.rec.delivered, a.rec.delivered)
  })

  test(`${kind}: con costos nulos la carga es cero y la producción no cambia`, () => {
    const zero = Object.fromEntries(Object.keys(DEFAULTS.costs).map((k) => [k, 0]))
    const a = make(kind, base),
      b = make(kind, { ...base, costs: zero })
    assert.equal(b.summary().TotalHumanWorkload_kcal, 0)
    assert.deepEqual(b.rec.delivered, a.rec.delivered)
  })

  test(`${kind}: el costo de escalera no afecta a cuadrillas sin escalera`, () => {
    const cfg = { ...base, act: 'ground' }
    const a = make(kind, cfg),
      b = make(kind, { ...cfg, costs: { ...DEFAULTS.costs, ladderClimb: 9, ladderDown: 9, harvestLadder: 9 } })
    assert.deepEqual(b.rec.work, a.rec.work)
  })

  test(`${kind}: cambiar solo el costo de caminar no cambia trayectorias ni producción`, () => {
    const a = make(kind, base),
      b = make(kind, { ...base, costs: { ...DEFAULTS.costs, walking: 0.2 } })
    assert.deepEqual(b.rec.delivered, a.rec.delivered)
    for (let h = 0; h < a.NH; h++) assert.deepEqual(b.rec.wy[h], a.rec.wy[h])
    assert.ok(b.summary().TotalHumanWorkload_kcal > a.summary().TotalHumanWorkload_kcal)
  })
}

test('HR: una capacidad que nunca se alcanza no cambia el resultado', () => {
  const a = make('HR', base)
  const maxOn = Math.max(...a.rec.onboard)
  const boxes = Math.ceil(maxOn / DEFAULTS.maxProd) + 1
  const b = make('HR', { ...base, capacityBoxes: boxes })
  assert.deepEqual(b.rec.delivered, a.rec.delivered)
  assert.deepEqual(b.rec.onboard, a.rec.onboard)
})

test('HR: cosechar más rápido no reduce lo cosechado', () => {
  const a = make('HR', base).summary(),
    b = make('HR', { ...base, prodPeriod: { 1: 3, 2: 5, 3: 4 } }).summary()
  assert.ok(b.TotalRecollectedCrops_crop_units >= a.TotalRecollectedCrops_crop_units)
})
