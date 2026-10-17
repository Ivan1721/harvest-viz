import test from 'node:test'
import assert from 'node:assert/strict'
import { sampleAt, lerpAngle, trackAt } from '../../src/workload/interp.js'

test('sampleAt: índice, siguiente y fracción; se detiene en el último tick', () => {
  assert.deepEqual(sampleAt(10, 0.25, 0), { i: 0, j: 1, f: 0 })
  assert.deepEqual(sampleAt(10, 0.25, 0.375), { i: 1, j: 2, f: 0.5 })
  assert.deepEqual(sampleAt(10, 0.25, 99), { i: 9, j: 9, f: 0 })
  assert.deepEqual(sampleAt(10, 0.25, -1), { i: 0, j: 1, f: 0 })
})

test('lerpAngle toma el giro corto al cruzar ±π', () => {
  const a = 3.0,
    b = -3.0 // 0,28 rad de distancia por el lado corto
  const m = lerpAngle(a, b, 0.5)
  assert.ok(Math.abs(Math.atan2(Math.sin(m), Math.cos(m)) - Math.PI) < 0.01 || Math.abs(Math.atan2(Math.sin(m), Math.cos(m)) + Math.PI) < 0.01)
  assert.equal(lerpAngle(0, 1, 0), 0)
  assert.equal(lerpAngle(0, 1, 1), 1)
})

test('trackAt: exacto en los ticks, en el segmento entre ticks y sin interpolar saltos', () => {
  const tr = Float32Array.from([0, 0, 0, 1, 0, 0.5, 10, 0, 0.5])
  const out = [0, 0, 0]
  assert.deepEqual(trackAt(tr, 3, { i: 1, j: 2, f: 0 }, out, { angleIdx: 2 }), [1, 0, 0.5])
  assert.deepEqual(trackAt(tr, 3, { i: 0, j: 1, f: 0.5 }, out, { angleIdx: 2 }), [0.5, 0, 0.25])
  // de x=1 a x=10 hay 9 m: más que maxJump, se queda en el tick i
  assert.deepEqual(trackAt(tr, 3, { i: 1, j: 2, f: 0.5 }, out, { angleIdx: 2 }), [1, 0, 0.5])
})
