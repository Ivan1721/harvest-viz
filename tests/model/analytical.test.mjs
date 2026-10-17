// Casos con resultado calculable a mano.
import test from 'node:test'
import assert from 'node:assert/strict'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { HRSim } from '../../src/hrsim/engine.js'
import { DEFAULTS } from '../../src/hrsim/common.js'
import { FIS } from '../helpers.mjs'

const C = DEFAULTS.costs

test('1 trabajador en el suelo antes de llenar la bolsa: unidades = ⌊t / 4 s⌋ y carga = 0,0666 · t', () => {
  for (const d of [8, 20, 40, 59]) {
    const s = new HOSim({ nw: 1, row: 1, act: 'ground', rp: 0, duration: d }).run()
    assert.equal(s.rec.prod[0].at(-1), Math.floor(d / 4), `unidades a ${d} s`)
    assert.ok(Math.abs(s.rec.workH[0].at(-1) - C.harvestGround * d) < 1e-9, `carga a ${d} s`)
  }
})

test('el periodo de producción fija el ritmo: gancho 5 s, escalera 6 s', () => {
  const g = new HOSim({ nw: 1, row: 1, act: 'picker', rp: 0, duration: 50 }).run()
  assert.equal(g.rec.prod[0].at(-1), Math.floor(50 / 5))
  const l = new HOSim({ nw: 1, row: 1, act: 'ladder', rp: 0, duration: 60 }).run()
  assert.equal(l.rec.prod[0].at(-1), Math.floor(60 / 6))
})

test('con 2 s por unidad la bolsa (15 u) se llena a los 30 s y el trabajador sale a caminar', () => {
  const s = new HOSim({ nw: 1, row: 1, act: 'ground', rp: 0, duration: 40, prodPeriod: { 1: 2, 2: 6, 3: 5 } }).run()
  const first = s.rec.flag[0].findIndex((f) => f === 2)
  assert.ok(Math.abs(s.rec.t[first] - 30) <= 0.5, `sale a los ${s.rec.t[first]} s`)
})

test('la carga crece al ritmo del costo de la actividad en curso (bandera 1 = cosecha)', () => {
  const s = new HOSim({ nw: 1, row: 1, act: 'ground', rp: 0, duration: 30 }).run()
  const rate = (s.rec.workH[0].at(-1) - s.rec.workH[0][40]) / (s.rec.t.at(-1) - s.rec.t[40])
  assert.ok(Math.abs(rate - C.harvestGround) < 1e-9)
})

test('sin robot no hay entregas antes de llenar la primera bolsa', () => {
  const s = new HOSim({ nw: 4, row: 2, act: 'ground', rp: 0, duration: 59 }).run()
  assert.equal(s.rec.delivered.at(-1), 0)
})

test('HR: el robot parte en reposo cerca de su punto inicial y avanza a lo sumo su velocidad máxima', () => {
  const s = new HRSim({ nw: 2, row: 1, act: 'ground', rp: 0, duration: 120 }, FIS).run()
  let vmax = 0
  for (let i = 1; i < s.rec.t.length; i++) vmax = Math.max(vmax, Math.hypot(s.rec.rx[i] - s.rec.rx[i - 1], s.rec.ry[i] - s.rec.ry[i - 1]) / s.dt)
  assert.ok(vmax > 0.1, 'el robot se mueve')
  assert.ok(vmax < 10, `velocidad máxima razonable (${vmax.toFixed(2)} m/s)`)
})
