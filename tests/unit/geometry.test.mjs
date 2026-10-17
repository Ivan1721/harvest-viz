import test from 'node:test'
import assert from 'node:assert/strict'
import { hyp, nearestOnPolyline, movePose, paramsHash, assignActivities, initWorkers, DEFAULTS } from '../../src/hrsim/common.js'

test('hyp es la norma euclídea', () => {
  assert.equal(hyp(3, 4), 5)
})

test('nearestOnPolyline proyecta sobre el segmento y se queda en los extremos', () => {
  const poly = [
    [0, 0],
    [10, 0],
    [10, 10],
  ]
  assert.deepEqual(nearestOnPolyline([5, 3], poly), [5, 0])
  assert.deepEqual(nearestOnPolyline([-4, -1], poly), [0, 0])
  assert.deepEqual(nearestOnPolyline([12, 5], poly), [10, 5])
})

test('movePose avanza speed·dt sin pasarse y marca la llegada', () => {
  const a = movePose([0, 0, 0], [10, 0], 0.75, 0.25)
  assert.ok(Math.abs(a.pose[0] - 0.1875) < 1e-12)
  assert.equal(a.reached, false)
  const b = movePose([9.9, 0, 0], [10, 0], 0.75, 0.25)
  assert.ok(Math.abs(b.pose[0] - 10) < 1e-12)
  assert.equal(b.reached, true)
  const c = movePose([1, 1, 0.3], [1, 1], 0.75, 0.25)
  assert.deepEqual(c.pose, [1, 1, 0.3])
  assert.equal(c.reached, true)
})

test('paramsHash es estable al orden de las claves y cambia con los valores', () => {
  assert.equal(paramsHash({ a: 1, b: { c: 2, d: 3 } }), paramsHash({ b: { d: 3, c: 2 }, a: 1 }))
  assert.notEqual(paramsHash({ a: 1 }), paramsHash({ a: 2 }))
  assert.match(paramsHash(DEFAULTS), /^[0-9a-f]{8}$/)
})

test('assignActivities: mixta reparte suelo/escalera/gancho en bloques de 2', () => {
  const { type, ladder } = assignActivities(12, 'mixed')
  assert.deepEqual(type, [1, 1, 2, 2, 3, 3, 1, 1, 2, 2, 3, 3])
  assert.deepEqual(ladder, [0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 0, 0])
  assert.deepEqual(assignActivities(3, 'mixed').type, [1, 2, 3])
  assert.throws(() => assignActivities(4, 'otra'), /desconocida/)
})

test('initWorkers ubica a todos dentro del mapa con costo y ritmo según su actividad', () => {
  for (const row of [1, 2, 3])
    for (const rp of [0, 1]) {
      const { W } = initWorkers({ ...DEFAULTS, nw: 24, row, rp, act: 'mixed' })
      assert.equal(W.length, 24)
      for (const w of W) {
        assert.ok(w.start[0] > 0 && w.start[0] < DEFAULTS.mapW && w.start[1] > 0 && w.start[1] < DEFAULTS.mapH)
        assert.ok(w.cost > 0 && w.tInc > 0)
      }
    }
})
