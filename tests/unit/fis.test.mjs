import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFis, evalFis } from '../../src/hrsim/fis.js'
import { FIS } from '../helpers.mjs'

test('el FIS goal-seeking se parsea con 21 reglas y 2 salidas', () => {
  const sys = parseFis(FIS)
  assert.equal(sys.rules.length, 21)
  assert.equal(sys.outputs.length, 2)
})

test('evalFis devuelve salidas finitas dentro de su rango', () => {
  const sys = parseFis(FIS)
  for (const inp of [
    [0, 0],
    [5, 30],
    [10, -60],
    [2, 90],
  ]) {
    const out = evalFis(sys, inp.slice(0, sys.inputs.length))
    out.forEach((v, k) => {
      assert.ok(Number.isFinite(v))
      const [a, b] = sys.outputs[k].range
      assert.ok(v >= a - 1e-9 && v <= b + 1e-9, `salida ${k}=${v} fuera de [${a}, ${b}]`)
    })
  }
})

test('trimf: 0 fuera del soporte, 1 en el pico, lineal en los flancos', async () => {
  const { mfFn } = await import('../../src/hrsim/fis.js')
  const f = mfFn('trimf', [0, 5, 10])
  assert.equal(f(-1), 0)
  assert.equal(f(11), 0)
  assert.equal(f(5), 1)
  assert.equal(f(2.5), 0.5)
  assert.equal(f(7.5), 0.5)
})

test('trapmf: meseta en 1 y hombros abiertos (a=b o c=d)', async () => {
  const { mfFn } = await import('../../src/hrsim/fis.js')
  const f = mfFn('trapmf', [0, 2, 4, 6])
  assert.equal(f(3), 1)
  assert.equal(f(1), 0.5)
  assert.equal(f(5), 0.5)
  const left = mfFn('trapmf', [0, 0, 2, 4])
  assert.equal(left(0), 1)
  assert.equal(left(-5), 0)
  const right = mfFn('trapmf', [2, 4, 6, 6])
  assert.equal(right(6), 1)
})

test('mfFn rechaza tipos no soportados', async () => {
  const { mfFn } = await import('../../src/hrsim/fis.js')
  assert.throws(() => mfFn('gaussmf', [1, 2]), /no soportada/)
})

test('evalFis es determinista y continuo (entradas cercanas → salidas cercanas)', () => {
  const sys = parseFis(FIS)
  const a = evalFis(sys, [3, 20]),
    b = evalFis(sys, [3, 20]),
    c = evalFis(sys, [3.001, 20.001])
  assert.deepEqual(a, b)
  a.forEach((v, k) => assert.ok(Math.abs(v - c[k]) < 0.05))
})
