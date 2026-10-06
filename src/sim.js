// Simulación (nivel 2): el robot cosecha frutos poco ocluidos y el humano los muy ocluidos.
// El robot elige el punto de vista según una estrategia parametrizable.
// Si el humano se acerca al robot, el robot cede el paso.
import { orchard } from './data'

export const STEPS = ['Detección', 'Selección de vista', 'Aproximación', 'Agarre', 'Entrega']
export const YIELD_DIST = 2.0
export const SHOULDER_Y = 1.05
export const MAX_REACH = 2.55
export const homeFor = (x) => [x + 0.55, 1.6, 0.05]

// Pesos: [oclusión, movimiento del brazo, alcance/extensión]
export const PRESETS = {
  occ: { label: 'Mín. oclusión', w: [1, 0, 0] },
  move: { label: 'Mín. movimiento', w: [0.12, 1, 0.3] },
  balanced: { label: 'Balanceada', w: [0.5, 0.5, 0.2] },
}

export const sim = {
  t: 0,
  speed: 1,
  playing: true,
  resetTimer: 0,
  selected: null,
  strategy: { mode: 'balanced', w: [...PRESETS.balanced.w] },
  fruits: [],
  robot: null,
  human: null,
}

const newRobot = () => ({
  x: -6, z: 0, state: 'idle', targetId: null, timer: 0, picked: 0,
  tip: homeFor(-6), goal: homeFor(-6), status: 'Esperando tarea', step: -1,
  paused: false, pausedTime: 0, chosen: null, travel: 0, occSum: 0, occN: 0,
})
const newHuman = () => ({ x: 5.5, z: 0.95, state: 'idle', targetId: null, timer: 0, picked: 0, heading: Math.PI / 2, status: 'Esperando tarea', walk: 0 })

const byId = (id) => orchard.fruits.find((f) => f.id === id)
const st = (id) => sim.fruits.find((f) => f.id === id)

// ---- Selección de vista ----
// score = w0·occ + w1·(distancia desde la punta actual)/3 + w2·(distancia al hombro)/2.6 (+ penalización si no alcanza)
export function scoreViews(f, w, fromTip) {
  const sh = [f.x - 0.1, SHOULDER_Y, 0]
  let best = null
  f.views.forEach((v, i) => {
    const reach = Math.hypot(v.pos[0] - sh[0], v.pos[1] - sh[1], v.pos[2] - sh[2])
    const move = Math.hypot(v.pos[0] - fromTip[0], v.pos[1] - fromTip[1], v.pos[2] - fromTip[2])
    const score = w[0] * v.occ + w[1] * (move / 3) + w[2] * (reach / 2.6) + (reach > MAX_REACH ? 5 : 0) + v.theta * 0.01
    if (!best || score < best.score) best = { idx: i, view: v, score, occ: v.occ, move, reach }
  })
  return best
}

// Resumen de una estrategia sobre todos los frutos asignados al robot (partiendo de la pose de reposo)
export function evaluate(w) {
  const rf = orchard.fruits.filter((f) => f.assignee === 'robot')
  if (!rf.length) return { occ: 0, move: 0, n: 0 }
  let o = 0, m = 0
  rf.forEach((f) => { const s = scoreViews(f, w, homeFor(f.x - 0.1)); o += s.occ; m += s.move })
  return { occ: o / rf.length, move: m / rf.length, n: rf.length }
}

export function setStrategy(mode, w) {
  sim.strategy = { mode, w: w ? [...w] : [...PRESETS[mode].w] }
}

// Vista que se mostrará/usará para un fruto
export function chosenFor(f) {
  const R = sim.robot
  if (R.chosen && R.targetId === f.id) return R.chosen
  return scoreViews(f, sim.strategy.w, homeFor(f.x - 0.1))
}

export function resetSim() {
  sim.fruits = orchard.fruits.map((f) => ({ id: f.id, state: 'pending', doneBy: null }))
  sim.robot = newRobot()
  sim.human = newHuman()
  sim.resetTimer = 0
  sim.selected = null
}
resetSim()

function nextFor(who, fromX) {
  return orchard.fruits
    .filter((f) => f.assignee === who && st(f.id).state === 'pending')
    .sort((a, b) => Math.abs(a.x - fromX) - Math.abs(b.x - fromX))[0]
}
const move = (v, target, maxStep) => (Math.abs(target - v) <= maxStep ? target : v + Math.sign(target - v) * maxStep)
const smooth = (cur, goal, k) => cur + (goal - cur) * k

export function step(rawDt) {
  if (!sim.playing) return
  const dt = Math.min(rawDt, 0.05) * sim.speed
  sim.t += dt
  const R = sim.robot, H = sim.human
  const humanNear = Math.hypot(R.x - H.x, R.z - H.z) < YIELD_DIST

  // ---------- Robot ----------
  R.paused = false
  if (R.state === 'idle') {
    const f = nextFor('robot', R.x)
    if (f) { R.targetId = f.id; R.state = 'view'; R.timer = 0; R.chosen = null; st(f.id).state = 'claimed' }
    else { R.status = 'Sin frutos asignados'; R.step = -1; R.goal = homeFor(R.x) }
  } else if (humanNear) {
    R.paused = true
    R.pausedTime += dt
    R.status = 'Cede el paso: humano cerca'
  } else {
    const f = byId(R.targetId)
    R.timer += dt
    if (R.state === 'view') {
      R.step = 1; R.status = `Seleccionando mejor vista · ${f.id}`
      R.x = move(R.x, f.x - 0.1, 0.9 * dt)
      R.goal = homeFor(R.x)
      if (Math.abs(R.x - (f.x - 0.1)) < 0.02) {
        R.chosen = scoreViews(f, sim.strategy.w, R.tip)
        R.state = 'approach'; R.timer = 0
      }
    } else if (R.state === 'approach') {
      R.step = 2; R.status = `Aproximando cámara a la vista ${R.chosen.idx + 1}/${f.views.length} · ${f.id}`
      R.goal = R.chosen.view.pos
      if (R.timer > 1.6) { R.state = 'grasp'; R.timer = 0 }
    } else if (R.state === 'grasp') {
      R.step = 3; R.status = `Agarrando ${f.id}`
      R.goal = [f.x, f.y, f.z]
      if (R.timer > 1.4) {
        st(f.id).state = 'done'; st(f.id).doneBy = 'robot'
        R.picked++; R.occSum += R.chosen.occ; R.occN++
        R.state = 'deliver'; R.timer = 0
      }
    } else if (R.state === 'deliver') {
      R.step = 4; R.status = 'Entregando a la caja'
      R.goal = homeFor(R.x)
      if (R.timer > 0.9) { R.state = 'idle'; R.targetId = null }
    }
  }
  const k = 1 - Math.exp(-dt * 4)
  const nt = [smooth(R.tip[0], R.goal[0], k), smooth(R.tip[1], R.goal[1], k), smooth(R.tip[2], R.goal[2], k)]
  R.travel += Math.hypot(nt[0] - R.tip[0], nt[1] - R.tip[1], nt[2] - R.tip[2])
  R.tip = nt

  // ---------- Humano ----------
  if (H.state === 'idle') {
    const f = nextFor('human', H.x)
    if (f) { H.targetId = f.id; H.state = 'walk'; st(f.id).state = 'claimed' }
    else {
      H.status = 'Sin frutos asignados · espera fuera del carril'
      if (Math.abs(7.5 - H.x) > 0.02) { H.x = move(H.x, 7.5, dt); H.heading = Math.PI / 2; H.walk += dt * 6 } else H.walk = 0
      H.z = move(H.z, 1.3, dt)
    }
  } else if (H.state === 'walk') {
    const f = byId(H.targetId)
    H.status = `Caminando hacia ${f.id}`
    const tz = f.side * 0.95
    H.heading = Math.atan2(Math.sign(f.x - H.x) || 0, 0.0001)
    H.x = move(H.x, f.x, dt)
    H.z = move(H.z, tz, dt)
    H.walk += dt * 6
    if (Math.abs(H.x - f.x) < 0.02 && Math.abs(H.z - tz) < 0.02) { H.state = 'pick'; H.timer = 0 }
  } else if (H.state === 'pick') {
    const f = byId(H.targetId)
    H.status = `Cosechando ${f.id} (muy ocluido)`
    H.heading = f.side > 0 ? Math.PI : 0
    H.timer += dt
    if (H.timer > 1.8) { st(f.id).state = 'done'; st(f.id).doneBy = 'human'; H.picked++; H.state = 'idle'; H.targetId = null }
  }

  // ---------- Reinicio automático ----------
  if (sim.fruits.every((f) => f.state === 'done')) {
    sim.resetTimer += dt
    R.status = H.status = 'Huerto completado'
    if (sim.resetTimer > 4) {
      const keep = { selected: sim.selected, mode: sim.strategy }
      resetSim(); sim.selected = keep.selected
    }
  }
}

export function snapshot() {
  const total = sim.fruits.length
  const done = sim.fruits.filter((f) => f.state === 'done').length
  const R = sim.robot
  const pending = orchard.fruits.filter((f) => st(f.id)?.state !== 'done')
  const meanOcc = pending.length ? pending.reduce((s, f) => s + f.occ, 0) / pending.length : 0
  return {
    t: sim.t, total, done, rp: R.picked, hp: sim.human.picked, meanOcc,
    pausedTime: R.pausedTime, travel: R.travel, pickOcc: R.occN ? R.occSum / R.occN : null,
    robot: { ...R, tip: [...R.tip] }, human: { ...sim.human },
    fruits: sim.fruits.map((f) => ({ ...f })),
    selected: sim.selected, playing: sim.playing, speed: sim.speed,
    strategy: { mode: sim.strategy.mode, w: [...sim.strategy.w] },
  }
}
