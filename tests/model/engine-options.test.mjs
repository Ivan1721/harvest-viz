import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { metaJSON } from '../../src/hrsim/export.js'
import { paramsHash } from '../../src/hrsim/common.js'
import { parseFis, evalFis } from '../../src/hrsim/fis.js'
import { FIS } from '../helpers.mjs'

const stuckTicks = (sim) => {
  // ticks en que un trabajador camina al robot (estado 10) habiendo terminado ya su carga
  let n = 0
  for (let h = 0; h < sim.NH; h++) for (const st of sim.rec.wst[h]) if (st === 10) n++
  return n
}

test('fixRecallLoop: con el robot lleno, el trabajador deja de volver a cargar', () => {
  const cfg = { nw: 12, row: 3, act: 'mixed', rp: 0, duration: 1800, capacityBoxes: 3 }
  const legacy = new HRSim(cfg, FIS).run(),
    fixed = new HRSim({ ...cfg, fixRecallLoop: true }, FIS).run()
  assert.ok(legacy.summary().capacityBlocked > 0, 'el robot se llena en este escenario')
  assert.ok(stuckTicks(fixed) < stuckTicks(legacy), `ticks caminando al robot: ${stuckTicks(fixed)} (corregido) vs ${stuckTicks(legacy)} (MATLAB)`)
  assert.ok(fixed.summary().TotalRecollectedCrops_crop_units >= legacy.summary().TotalRecollectedCrops_crop_units, 'cosecha al menos lo mismo')
})

test('fixRecallLoop no cambia nada cuando el robot nunca se llena (protocolo del estudio)', () => {
  const cfg = { nw: 8, row: 2, act: 'mixed', rp: 1, duration: 900 }
  assert.deepEqual(new HRSim({ ...cfg, fixRecallLoop: true }, FIS).run().summary(), new HRSim(cfg, FIS).run().summary())
})

test('capacidad ilimitada (Infinity) queda trazable en el hash y en _meta.json', () => {
  const run = simToRun(new HRSim({ nw: 2, duration: 60, capacityBoxes: Infinity }, FIS).run(), { robot: true })
  assert.equal(run.meta.params.capacityBoxes, 'Infinity')
  assert.equal(JSON.parse(metaJSON(run)).params.capacityBoxes, 'Infinity')
  assert.notEqual(paramsHash({ c: Infinity }), paramsHash({ c: null }))
})

test('summary() funciona con series largas (sin desbordar la pila)', () => {
  const s = new HRSim({ nw: 1, duration: 4 * 3600, dt: 0.1 }, FIS).run().summary()
  assert.ok(Number.isFinite(s.TotalHumanWorkload_kcal))
})

test('evalFis satura las entradas fuera de rango como evalfis de MATLAB', () => {
  const sys = parseFis(FIS)
  const [lo, hi] = sys.inputs[0].range
  assert.deepEqual(evalFis(sys, [hi + 50, 10]), evalFis(sys, [hi, 10]))
  assert.deepEqual(evalFis(sys, [lo - 5, 10]), evalFis(sys, [lo, 10]))
})
