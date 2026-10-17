// Topes de entrada: valores fuera de rango dan un error legible en vez de agotar la memoria.
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveParams, LIMITS, DEFAULTS } from '../../src/hrsim/common.js'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { buildRun, parseName, FormatError, INPUT_LIMITS } from '../../src/workload/run.js'
import { loadOrchard, ORCHARD_LIMITS } from '../../src/data.js'
import { FIS } from '../helpers.mjs'

test('resolveParams rechaza valores fuera de rango con un mensaje claro', () => {
  for (const bad of [
    { duration: LIMITS.maxDuration + 1 },
    { duration: 1e9 },
    { duration: 0 },
    { nw: 0 },
    { nw: LIMITS.maxWorkers + 1 },
    { nw: 2.5 },
    { row: 4 },
    { rp: 2 },
    { dt: 0.001 },
    { prodPeriod: { 1: 0 } },
    { costs: { walking: -1 } },
    { walkSpeed: 0 },
  ])
    assert.throws(() => resolveParams(bad), /Parámetro inválido/, JSON.stringify(bad))
  assert.throws(() => new HOSim({ duration: 1e9 }), /duration/)
  assert.throws(() => new HRSim({ nw: 100 }, FIS), /nw/)
})

test('resolveParams completa objetos anidados parciales (prodPeriod, costs)', () => {
  const p = resolveParams({ prodPeriod: { 1: 3 }, costs: { walking: 0.05 } })
  assert.deepEqual(p.prodPeriod, { ...DEFAULTS.prodPeriod, 1: 3 })
  assert.equal(p.costs.walking, 0.05)
  assert.equal(p.costs.ladderClimb, DEFAULTS.costs.ladderClimb)
})

test('un prodPeriod parcial ya no apaga la producción de escalera y gancho', () => {
  const s = new HOSim({ nw: 6, act: 'mixed', duration: 120, prodPeriod: { 1: 4 } }).run()
  for (let h = 0; h < 6; h++) assert.ok(Math.max(...s.rec.prod[h]) > 0, `H${h + 1} produce`)
})

test('parseName rechaza filas, disposiciones y cantidades fuera de rango', () => {
  assert.equal(parseName('HUMAN_ROBOT_12_ROW4_harv_mixed_RP0'), null)
  assert.equal(parseName('HUMAN_ROBOT_12_ROW3_harv_mixed_RP2'), null)
  assert.equal(parseName('HUMAN_ROBOT_0_ROW3_harv_mixed_RP0'), null)
  assert.equal(parseName(`HUMAN_ROBOT_${INPUT_LIMITS.maxWorkers + 1}_ROW3_harv_mixed_RP0`), null)
  assert.equal(parseName('HUMAN_ROBOT_12_ROW3_harv_otra_RP0'), null)
})

test('CSV con demasiadas columnas o filas da FormatError antes de procesarlo', () => {
  const wide = Array.from({ length: INPUT_LIMITS.maxCols + 1 }, (_, i) => `c${i}`).join(',') + '\n' + '0,'.repeat(INPUT_LIMITS.maxCols) + '0\n'
  assert.throws(() => buildRun({ csvText: wide, logText: null, name: 'x' }), FormatError)
  const tall = 'Time_s\n' + '0\n'.repeat(INPUT_LIMITS.maxRows + 1)
  assert.throws(() => buildRun({ csvText: tall, logText: null, name: 'x' }), /filas/)
})

test('loadOrchard rechaza JSON demasiado grandes o con hojas/árboles inválidos', () => {
  const f = { x: 0, y: 1, z: 0 }
  assert.equal(loadOrchard({ fruits: Array(ORCHARD_LIMITS.maxFruits + 1).fill(f) }).ok, false)
  assert.equal(loadOrchard({ fruits: [f], leaves: [{ x: 0, y: 1, z: 'a', r: 0.2 }] }).ok, false)
  assert.equal(loadOrchard({ fruits: [f], trees: [{ cx: null, cz: 0 }] }).ok, false)
  assert.equal(loadOrchard({ fruits: [{ ...f, views: 'x' }] }).ok, false)
})
