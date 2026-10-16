import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFis, evalFis } from '../src/hrsim/fis.js'
import { FIS } from './helpers.mjs'

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
