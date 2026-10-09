// Análisis HRI sobre una corrida reproducida (posiciones RECONSTRUIDAS: trabajadores desde sus banderas
// de actividad, robot interpolado entre eventos del log → distancias aproximadas).
import { FLAG } from './run'

// Zonas de proxemia (Hall, 1966; valores usuales en navegación social)
export const ZONES = [
  { key: 'intimate', label: 'Íntima', r: 0.45, color: '#dc2626' },
  { key: 'personal', label: 'Personal', r: 1.2, color: '#f59e0b' },
  { key: 'social', label: 'Social', r: 3.6, color: '#eab308' },
]
export const zoneOf = (d) => (d < ZONES[0].r ? 0 : d < ZONES[1].r ? 1 : d < ZONES[2].r ? 2 : 3)
const ENC_D = 1.5 // distancia que define un "encuentro"

const jain = (xs) => {
  const v = xs.filter((x) => x > 0)
  if (v.length < 2) return 1
  const s = v.reduce((a, b) => a + b, 0), s2 = v.reduce((a, b) => a + b * b, 0)
  return (s * s) / (v.length * s2)
}

// Traspaso: el trabajador está en estado "colocando/cargando caja" (bandera 3) o lo estuvo hace < 5 s
function isHandoff(w, i) {
  const back = Math.max(1, Math.round(5 / w.dt))
  for (let j = i; j >= Math.max(0, i - back); j--) if (w.flag[j] === 3) return true
  return false
}

export function analyzeHRI(run) {
  run.workers.forEach((w) => { w.dt = run.dt })
  const n = run.n, nw = run.workers.length, DT = run.dt
  if (!run.robot || !run.robot.pos) return null
  const rp = run.robot.pos
  const dist = new Float32Array(n * nw)
  const minD = new Float32Array(n)
  const minW = new Uint8Array(n)
  const speed = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const j = Math.max(0, i - Math.max(1, Math.round(1 / DT)))
    speed[i] = i === j ? 0 : Math.hypot(rp[i * 3] - rp[j * 3], rp[i * 3 + 1] - rp[j * 3 + 1]) / ((i - j) * DT)
    let m = 1e9, mw = 0
    run.workers.forEach((w, k) => {
      const d = Math.hypot(w.track[i * 4] - rp[i * 3], w.track[i * 4 + 1] - rp[i * 3 + 1])
      dist[i * nw + k] = d
      if (d < m) { m = d; mw = k }
    })
    minD[i] = m; minW[i] = mw
  }

  // --- Cortesía: tiempo en cada zona y distancia mínima, por trabajador ---
  const perWorker = run.workers.map((w, k) => {
    const t = [0, 0, 0] // íntima, personal, social (acumulativo: <0.45, <1.2, <3.6)
    let mn = 1e9, tHand = 0
    for (let i = 0; i < n; i++) {
      const d = dist[i * nw + k]
      // el traspaso de caja (el trabajador sube la caja al robot detenido) es contacto intencional: no cuenta como invasión
      if (isHandoff(w, i)) { tHand += DT; continue }
      if (d < mn) mn = d
      if (d < ZONES[0].r) t[0] += DT
      if (d < ZONES[1].r) t[1] += DT
      if (d < ZONES[2].r) t[2] += DT
    }
    return { h: w.h, act: w.act, minD: mn, tIntimate: t[0], tPersonal: t[1], tSocial: t[2], tHandoff: tHand }
  })

  // --- Cesión de paso: encuentros (distancia < 1.5 m) ---
  const encounters = []
  let i = 0
  while (i < n) {
    if (minD[i] < ENC_D) {
      let a = i, best = i
      while (i < n && minD[i] < ENC_D) { if (minD[i] < minD[best]) best = i; i++ }
      const k = minW[best], w = run.workers[k]
      const hf = w.flag[best]
      const humanMoving = hf === 2 || hf === 3
      const sp = speed[best]
      const handoff = isHandoff(w, best)
      // quién "debería ceder": el humano ocupado/quieto en su tarea tiene prioridad; si ambos se mueven → ambiguo
      const verdict = handoff ? 'traspaso de caja' : !humanMoving ? (sp > 0.15 ? 'robot debe ceder' : 'ambos casi quietos') : sp > 0.15 ? 'ambos en movimiento' : 'robot quieto'
      encounters.push({ t0: a * DT, t1: (i - 1) * DT, tMin: best * DT, h: w.h, minD: minD[best], flag: hf, robotSpeed: sp, verdict })
    } else i++
  }

  // --- Asignación: espera de cada caja hasta que el robot la recoge ---
  const boxes = run.robot.boxes.map((b) => ({
    h: b.h, tDetect: b.idx * DT, tPick: b.served ? b.picked * DT : null, wait: b.served ? (b.picked - b.idx) * DT : null,
  }))
  const served = boxes.filter((b) => b.wait != null)
  const waitByW = run.workers.map((w) => {
    const ws = served.filter((b) => b.h === w.h).map((b) => b.wait)
    return { h: w.h, n: ws.length, mean: ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : 0, max: ws.length ? Math.max(...ws) : 0 }
  })
  // inversiones respecto de FIFO: caja detectada antes pero atendida después
  let inv = 0, pairs = 0
  for (let a = 0; a < served.length; a++) for (let b = a + 1; b < served.length; b++) {
    if (served[a].tDetect < served[b].tDetect) { pairs++; if (served[a].tPick > served[b].tPick) inv++ }
  }
  const allW = served.map((b) => b.wait)
  const assign = {
    n: served.length,
    pending: boxes.length - served.length,
    mean: allW.length ? allW.reduce((a, b) => a + b, 0) / allW.length : 0,
    max: allW.length ? Math.max(...allW) : 0,
    jain: jain(waitByW.map((w) => w.mean)),
    inversions: inv, pairs,
    byWorker: waitByW,
  }

  const nIntimate = perWorker.reduce((a, w) => a + (w.tIntimate > 0 ? 1 : 0), 0)
  const nHandoffs = encounters.filter((e) => e.verdict === 'traspaso de caja').length
  return { dist, minD, minW, speed, perWorker, encounters, assign, nIntimate, nHandoffs }
}

// Mini-tira de calor: distancia mínima robot–humano a lo largo del tiempo (para la línea de tiempo)
export function heatGradient(a, stops = 120) {
  const n = a.minD.length
  const parts = []
  for (let s = 0; s < stops; s++) {
    const i0 = Math.floor((s / stops) * n), i1 = Math.max(i0 + 1, Math.floor(((s + 1) / stops) * n))
    let m = 1e9
    for (let i = i0; i < i1 && i < n; i++) m = Math.min(m, a.minD[i])
    const z = zoneOf(m)
    const col = z === 0 ? '#dc2626' : z === 1 ? '#f59e0b' : z === 2 ? '#fde68a' : '#e8edf8'
    parts.push(`${col} ${(s / stops * 100).toFixed(2)}% ${((s + 1) / stops * 100).toFixed(2)}%`)
  }
  return `linear-gradient(90deg, ${parts.join(',')})`
}
export { FLAG }
