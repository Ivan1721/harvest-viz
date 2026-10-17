// Presupuesto de rendimiento: límites holgados (≈8× lo medido) para que no fallen por un runner lento,
// pero sí ante una regresión grave (p. ej. un O(n²) accidental). Para medir con detalle: npm run bench.
import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { analyzeHRI } from '../../src/workload/hri.js'
import { FIS } from '../helpers.mjs'

const median = (f, k = 3) => {
  const t = []
  for (let i = 0; i < k; i++) {
    const t0 = performance.now()
    f()
    t.push(performance.now() - t0)
  }
  return t.sort((a, b) => a - b)[Math.floor(k / 2)]
}
const cfg = { nw: 12, row: 3, act: 'mixed', rp: 0 }
const BUDGET = { ho: 400, hr: 2500, post: 800 }

test(`Solo humano, 12 trabajadores, 45 min < ${BUDGET.ho} ms`, () => {
  const ms = median(() => new HOSim(cfg).run())
  assert.ok(ms < BUDGET.ho, `${ms.toFixed(0)} ms`)
})

test(`Humano-robot, 12 trabajadores, 45 min < ${BUDGET.hr} ms`, () => {
  const ms = median(() => new HRSim(cfg, FIS).run())
  assert.ok(ms < BUDGET.hr, `${ms.toFixed(0)} ms`)
})

test(`conversión al visor + análisis HRI < ${BUDGET.post} ms`, () => {
  const sim = new HRSim(cfg, FIS).run()
  const ms = median(() => analyzeHRI(simToRun(sim, { robot: true })))
  assert.ok(ms < BUDGET.post, `${ms.toFixed(0)} ms`)
})
