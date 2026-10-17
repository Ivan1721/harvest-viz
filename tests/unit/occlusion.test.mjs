// Modo Oclusión: huerto sintético, carga/exportación JSON, selección de vista y simulación robot + humano.
import test from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { orchard, generateOrchard, loadOrchard, exportOrchard, ORCHARD_LIMITS } from '../../src/data.js'
import { sim, step, resetSim, scoreViews, evaluate, setStrategy, snapshot, chosenFor, PRESETS, homeFor, MAX_REACH } from '../../src/sim.js'

const RUNS = Number(process.env.PBT_RUNS || 30)
const SEED = Number(process.env.PBT_SEED) || 20261016

// corre la simulación hasta completar el huerto (antes del reinicio automático) o hasta tMax
function runToCompletion(tMax = 600) {
  resetSim()
  sim.playing = true
  sim.speed = 1
  const t0 = sim.t // resetSim no reinicia el reloj global
  while (sim.t - t0 < tMax && !sim.fruits.every((f) => f.state === 'done')) step(0.05)
  return snapshot()
}

test('huerto sintético: determinista, oclusión en [0, 1] y frutos asignados', () => {
  generateOrchard()
  const a = JSON.stringify(exportOrchard())
  generateOrchard()
  assert.equal(JSON.stringify(exportOrchard()), a, 'misma semilla, mismo huerto')
  assert.equal(orchard.trees.length, 8)
  assert.equal(orchard.fruits.length, 48)
  for (const f of orchard.fruits) {
    assert.ok(f.occ >= 0 && f.occ <= 1, `${f.id}: occ ${f.occ}`)
    assert.ok(f.views.length > 0)
    for (const v of f.views) assert.ok(v.occ >= 0 && v.occ <= 1)
    assert.ok(f.assignee === 'robot' || f.assignee === 'human')
  }
  // el humano toma los más ocluidos: todo fruto humano está al menos tan ocluido como cualquiera del robot
  const maxRobot = Math.max(...orchard.fruits.filter((f) => f.assignee === 'robot').map((f) => f.occ))
  const minHuman = Math.min(...orchard.fruits.filter((f) => f.assignee === 'human').map((f) => f.occ))
  assert.ok(minHuman >= maxRobot)
})

test('exportar y volver a cargar conserva frutos, oclusión y asignación', () => {
  generateOrchard()
  const j = exportOrchard()
  const r = loadOrchard(j)
  assert.ok(r.ok, r.msg)
  const k = exportOrchard()
  assert.deepEqual(
    k.fruits.map((f) => [f.id, f.x, f.y, f.z, f.assignee, f.views.length]),
    j.fruits.map((f) => [f.id, f.x, f.y, f.z, f.assignee, f.views.length]),
  )
  for (let i = 0; i < j.fruits.length; i++) j.fruits[i].views.forEach((v, n) => assert.ok(Math.abs(v.occ - k.fruits[i].views[n].occ) < 1e-3))
  generateOrchard()
})

test('loadOrchard rechaza entradas inválidas con mensaje claro', () => {
  const bad = [
    [null, /arreglo "fruits"/],
    [{ fruits: [] }, /arreglo "fruits"/],
    [{ fruits: [{ x: 0, y: 'a', z: 0 }] }, /Fruto #1/],
    [{ fruits: [{ x: 0, y: 1, z: 0, views: [{ pos: [0, 1] }] }] }, /pos:\[x,y,z\]/],
    [{ fruits: [{ x: 0, y: 1, z: 0 }], leaves: [{ x: 0, y: 0, z: 0, r: -1 }] }, /Hoja #1/],
    [{ fruits: [{ x: 0, y: 1, z: 0 }], trees: [{ cx: 'x', cz: 0 }] }, /Árbol #1/],
    [{ fruits: Array.from({ length: ORCHARD_LIMITS.maxFruits + 1 }, () => ({ x: 0, y: 1, z: 0 })) }, /Demasiados frutos/],
  ]
  for (const [json, re] of bad) {
    const r = loadOrchard(json)
    assert.equal(r.ok, false)
    assert.match(r.msg, re)
  }
  generateOrchard()
})

test('carga mínima: occ y asignación aportadas se respetan', () => {
  const r = loadOrchard({
    fruits: [
      { id: 'A', x: 0, y: 1.5, z: -1, occ: 0.9, assignee: 'robot' },
      { id: 'B', x: 1, y: 1.5, z: 1, occ: 1.7 },
    ],
  })
  assert.ok(r.ok)
  const [a, b] = orchard.fruits
  assert.equal(a.assignee, 'robot', 'asignación fija')
  assert.equal(b.occ, 1, 'occ se acota a [0, 1]')
  assert.equal(b.side, 1)
  generateOrchard()
})

test('selección de vista: cada estrategia minimiza lo que dice', () => {
  generateOrchard()
  const f = orchard.fruits[0],
    tip = homeFor(f.x - 0.1)
  const occ = scoreViews(f, PRESETS.occ.w, tip)
  const reachable = f.views.filter((v) => Math.hypot(v.pos[0] - (f.x - 0.1), v.pos[1] - 1.05, v.pos[2]) <= MAX_REACH)
  if (reachable.length) assert.equal(occ.occ, Math.min(...reachable.map((v) => v.occ)))
  const mv = scoreViews(f, [0, 1, 0], tip)
  for (const v of f.views) assert.ok(mv.move <= Math.hypot(v.pos[0] - tip[0], v.pos[1] - tip[1], v.pos[2] - tip[2]) + 1e-9)
  // a más peso de oclusión, menos oclusión media (y a más peso de movimiento, menos recorrido)
  assert.ok(evaluate(PRESETS.occ.w).occ <= evaluate(PRESETS.move.w).occ + 1e-12)
  assert.ok(evaluate(PRESETS.move.w).move <= evaluate(PRESETS.occ.w).move + 1e-12)
})

test('simulación: completa el huerto, cada quien cosecha lo suyo y nada se cosecha dos veces', () => {
  generateOrchard()
  for (const mode of Object.keys(PRESETS)) {
    setStrategy(mode)
    const s = runToCompletion()
    assert.equal(s.done, s.total, `${mode}: huerto completo`)
    assert.equal(s.rp + s.hp, s.total)
    const by = Object.fromEntries(orchard.fruits.map((f) => [f.id, f.assignee]))
    for (const f of s.fruits) assert.equal(f.doneBy, by[f.id], `${f.id} lo cosecha ${by[f.id]}`)
    assert.ok(s.pickOcc >= 0 && s.pickOcc <= 1)
    assert.ok(s.travel > 0)
  }
  setStrategy('balanced')
})

test('simulación: el robot cede el paso y no avanza mientras el humano está cerca', () => {
  generateOrchard()
  resetSim()
  sim.playing = true
  sim.speed = 1
  step(0.05) // el robot toma una tarea
  const R = sim.robot
  sim.human.x = R.x
  sim.human.z = R.z
  sim.human.state = 'pick' // inmóvil junto al robot
  sim.human.targetId = orchard.fruits.find((f) => f.assignee === 'human').id
  sim.human.timer = -1e9
  const x0 = R.x,
    state0 = R.state
  for (let i = 0; i < 40; i++) step(0.05)
  assert.equal(R.x, x0)
  assert.equal(R.state, state0)
  assert.ok(R.pausedTime > 1.9)
  assert.match(R.status, /Cede el paso/)
  resetSim()
})

test('simulación: en pausa no avanza; el paso se acota a 50 ms × velocidad', () => {
  generateOrchard()
  resetSim()
  const t0 = sim.t
  sim.playing = false
  step(1)
  assert.equal(sim.t, t0)
  sim.playing = true
  sim.speed = 3
  step(10)
  assert.ok(Math.abs(sim.t - t0 - 0.15) < 1e-9)
  sim.speed = 1
  resetSim()
})

test('simulación: reinicio automático 4 s después de completar', () => {
  generateOrchard()
  runToCompletion()
  sim.selected = 'FR-01'
  for (let i = 0; i < 100; i++) step(0.05)
  assert.ok(sim.fruits.every((f) => f.state === 'pending' || f.state === 'claimed'))
  assert.equal(sim.robot.picked + sim.human.picked, 0)
  assert.equal(sim.selected, 'FR-01', 'conserva la selección')
})

test('chosenFor usa la vista fijada mientras el robot apunta a ese fruto', () => {
  generateOrchard()
  resetSim()
  const f = orchard.fruits.find((x) => x.assignee === 'robot')
  const fixed = { idx: 0, view: f.views[0], occ: f.views[0].occ }
  sim.robot.targetId = f.id
  sim.robot.chosen = fixed
  assert.equal(chosenFor(f), fixed)
  sim.robot.targetId = null
  assert.notEqual(chosenFor(f), fixed)
  resetSim()
})

test(`property-based: huertos al azar se cargan, la oclusión queda en [0, 1] y la simulación termina (${RUNS} casos)`, () => {
  const fruit = fc.record({
    x: fc.double({ min: -6, max: 6, noNaN: true }),
    y: fc.double({ min: 0.5, max: 3, noNaN: true }),
    z: fc.double({ min: -2.5, max: 2.5, noNaN: true }),
  })
  const leaf = fc.record({
    x: fc.double({ min: -6, max: 6, noNaN: true }),
    y: fc.double({ min: 0.5, max: 3, noNaN: true }),
    z: fc.double({ min: -3, max: 3, noNaN: true }),
    r: fc.double({ min: 0.05, max: 0.6, noNaN: true }),
  })
  fc.assert(
    fc.property(fc.array(fruit, { minLength: 1, maxLength: 12 }), fc.array(leaf, { maxLength: 40 }), (fruits, leaves) => {
      const r = loadOrchard({ fruits, leaves })
      assert.ok(r.ok, r.msg)
      for (const f of orchard.fruits) {
        assert.ok(f.occ >= 0 && f.occ <= 1)
        for (const v of f.views) assert.ok(v.occ >= 0 && v.occ <= 1 && v.pos.every(Number.isFinite))
      }
      const s = runToCompletion(1200)
      assert.equal(s.done, s.total, 'la simulación completa el huerto')
      assert.equal(s.rp + s.hp, s.total)
    }),
    { numRuns: RUNS, seed: SEED },
  )
  generateOrchard()
  resetSim()
})
