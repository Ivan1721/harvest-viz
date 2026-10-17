import test from 'node:test'
import assert from 'node:assert/strict'
import { ladderHeights, metabolicRate, rateScale } from '../../src/workload/derive.js'
import { zoneOf } from '../../src/workload/hri.js'
import { parseName } from '../../src/workload/run.js'

test('ladderHeights sube con la bandera 5, se mantiene arriba y baja con la 4', () => {
  const h = ladderHeights([1, 5, 5, 1, 1, 4, 4, 1], 2)
  assert.deepEqual(Array.from(h), [0, 1, 2, 2, 2, 1, 0, 0])
})

test('metabolicRate de una carga lineal es constante tras la ventana', () => {
  const dt = 0.25,
    work = Array.from({ length: 200 }, (_, i) => 0.1 * i * dt)
  const s = [],
    r = metabolicRate(work, dt, s)
  assert.equal(r[0], 0)
  for (let i = 40; i < 200; i++) assert.ok(Math.abs(r[i] - 0.1) < 1e-6)
  assert.ok(s.length > 0)
  assert.ok(Math.abs(rateScale(s) - 0.1) < 1e-6)
  assert.equal(rateScale([]), 1)
})

test('zoneOf usa los umbrales de proxemia 0,45 / 1,2 / 3,6 m', () => {
  assert.deepEqual([0.2, 0.45, 1.0, 1.2, 3.0, 3.6, 10].map(zoneOf), [0, 1, 1, 2, 2, 3, 3])
})

test('parseName reconoce los nombres de MATLAB y rechaza otros', () => {
  assert.deepEqual(parseName('HUMAN_ROBOT_12_ROW3_harv_mixed_RP0_20261006_120927'), { robot: true, nw: 12, row: 3, act: 'mixed', rp: 0 })
  assert.deepEqual(parseName('HUMAN_ONLY_1_ROW1_harv_ground_RP1'), { robot: false, nw: 1, row: 1, act: 'ground', rp: 1 })
  assert.equal(parseName('otra_cosa.csv'), null)
})
