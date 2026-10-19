// Fase 2: métricas de fluidez y seguridad con resultado conocido (corridas construidas a mano).
import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeHRI, fluencyIndex, ATTEND_STATES } from '../../src/workload/hri.js'
import { protectionDistance, SSM_DEFAULTS } from '../../src/hrsim/ssm.js'
import { HRSim } from '../../src/hrsim/engine.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { FIS } from '../helpers.mjs'

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`)
const DT = 0.25

// corrida mínima: robot con trayectoria robotXY(i) y estado st(i); un trabajador fijo en (wx, wy)
function makeRun({ n, robotXY, st, wx = 0, wy = 0, wstate = () => 0, wflag = () => 1, boxes = [] }) {
  const pos = new Float32Array(n * 3),
    track = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const [x, y] = robotXY(i)
    pos[i * 3] = x
    pos[i * 3 + 1] = y
    track[i * 4] = wx
    track[i * 4 + 1] = wy
  }
  return {
    n,
    dt: DT,
    workers: [
      { h: 1, act: 'ground', flag: Uint8Array.from({ length: n }, (_, i) => wflag(i)), state: Uint8Array.from({ length: n }, (_, i) => wstate(i)), track },
    ],
    robot: { pos, status: st ? Uint8Array.from({ length: n }, (_, i) => st(i)) : undefined, boxes },
  }
}

test('S_p(v): valores de la tabla de la especificación', () => {
  near(protectionDistance(0), 0.567, 1e-9)
  for (const [v, sp] of [
    [0.3, 0.95],
    [0.6, 1.39],
    [1.0, 2.07],
    [1.7, 3.51],
  ])
    near(protectionDistance(v), sp, 0.005)
  near(protectionDistance(1.7, { ...SSM_DEFAULTS, a: 1.0 }), 4.9, 0.005)
  near(protectionDistance(-1), protectionDistance(0), 0) // velocidad negativa = detenido
})

test('robot y trabajador quietos a 1 m: zona personal con robot detenido, sin infracción de S_p', () => {
  const n = 41
  const a = analyzeHRI(makeRun({ n, robotXY: () => [5, 5], st: () => 2, wx: 6, wy: 5 }))
  const w = a.perWorker[0]
  near(w.tPersonal, n * DT)
  near(w.zoneStopped[1], n * DT)
  near(w.zoneMoving[1], 0)
  near(w.tIntimate, 0)
  const f = a.fluency
  assert.equal(f.protection.n, 0)
  assert.equal(f.robotTime.stop, 1)
  near(f.minDist, 1, 1e-6)
  assert.equal(f.p5Moving, null, 'sin ticks en movimiento')
})

test('robot a 1 m/s pasa junto al trabajador: tiempo dentro de S_p(1) = 2,07 m', () => {
  // robot por y = 0 de x = 0 a 20 m; trabajador en (10, 1): dentro de S_p cuando |x − 10| < √(2,07² − 1)
  const n = 81
  const a = analyzeHRI(makeRun({ n, robotXY: (i) => [i * DT, 0], st: () => 0, wx: 10, wy: 1 }))
  const f = a.fluency
  const half = Math.sqrt(protectionDistance(1) ** 2 - 1)
  let ticks = 0
  for (let i = 1; i < n; i++) if (Math.abs(i * DT - 10) < half) ticks++
  assert.equal(f.protection.n, 1, 'un solo evento continuo')
  near(f.protection.s, ticks * DT)
  near(f.protection.events[0].v, 1, 1e-5)
  near(f.protection.events[0].minD, 1, 1e-5)
  assert.equal(f.protection.events[0].h, 1)
  assert.equal(f.robotTime.move, 1)
  near(a.perWorker[0].zoneMoving[1], a.perWorker[0].tPersonal) // todo el tiempo cerca fue en movimiento
})

test('el trabajador que carga su caja no cuenta como infracción', () => {
  const n = 81
  const a = analyzeHRI(makeRun({ n, robotXY: (i) => [i * DT, 0], st: () => 0, wx: 10, wy: 1, wflag: () => 3 }))
  assert.equal(a.fluency.protection.n, 0)
  near(a.perWorker[0].tHandoff, n * DT)
})

test('robot espera 10 s junto a una caja; el trabajador la atiende (estados 10, 11)', () => {
  // 0–9,75 s se mueve, 10–19,75 s espera (rst = 1), 20 s en adelante descarga (rst = 2); la caja se recoge en el tick 80
  const n = 100
  const st = (i) => (i < 40 ? 0 : i < 80 ? 1 : 2)
  const wstate = (i) => (i >= 40 && i < 70 ? 10 : i >= 70 && i < 80 ? 11 : 1)
  const a = analyzeHRI(
    makeRun({ n, robotXY: (i) => [Math.min(i, 40) * 0.1, 0], st, wx: 30, wy: 30, wstate, boxes: [{ h: 1, idx: 30, picked: 80, served: true }] }),
  )
  const f = a.fluency
  near(f.robotTime.move, 0.4)
  near(f.robotTime.wait, 0.4)
  near(f.robotTime.stop, 0.2)
  assert.equal(f.robotWait.n, 1)
  near(f.robotWait.total, 10)
  assert.equal(f.robotWait.events[0].h, 1, 'la espera se atribuye a la caja que se recoge después')
  near(f.attend[0].s, 40 * DT)
  near(f.attend[0].frac, 0.4)
  near(f.boxWait.mean, 50 * DT)
  near(f.boxWait.p90, 50 * DT)
  assert.deepEqual(ATTEND_STATES, [10, 11, 12])
  const idx = fluencyIndex(a)
  assert.equal(idx.HR_robot_mov_pct, 40)
  assert.equal(idx.HR_espera_robot_s, 10)
  assert.equal(idx.HR_atencion_media_s, 10)
  assert.equal(idx.HR_eventos_Sp, 0)
})

test('corrida sin estados (CSV de MATLAB): solo movimiento / detenido, el resto queda vacío', () => {
  const n = 40
  const a = analyzeHRI(makeRun({ n, robotXY: (i) => [Math.min(i, 19) * DT, 0], wx: 30, wy: 30 }))
  const f = a.fluency
  assert.equal(f.exact, false)
  near(f.robotTime.move + f.robotTime.stopped, 1)
  near(f.robotTime.move, 19 / 40)
  assert.equal(f.robotWait, null)
  const idx = fluencyIndex(a)
  assert.equal(idx.HR_robot_espera_pct, '')
  assert.equal(idx.HR_espera_robot_s, '')
  assert.deepEqual(fluencyIndex(null), {})
})

test('réplica MATLAB (12 trabajadores, fila 3, mixta, 45 min): reparto del tiempo del robot 50 / 33 / 17 %', () => {
  const s = new HRSim({ nw: 12, row: 3, act: 'mixed', rp: 0, duration: 2700 }, FIS).run()
  const before = s.rec.rx.slice()
  const a = analyzeHRI(simToRun(s, { robot: true }))
  const f = a.fluency
  near(f.robotTime.move, 0.5, 0.01)
  near(f.robotTime.wait, 0.33, 0.01)
  near(f.robotTime.stop, 0.17, 0.01)
  near(f.robotTime.move + f.robotTime.wait + f.robotTime.stop, 1, 1e-12)
  assert.ok(f.protection.n > 0, 'la réplica sí infringe S_p (no tiene la regla de la fase 3)')
  assert.ok(f.jainAttend > 0 && f.jainAttend <= 1)
  assert.ok(f.p5Moving >= f.minDist)
  assert.deepEqual(s.rec.rx, before, 'medir no cambia las series del motor')
})
