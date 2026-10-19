// Análisis HRI sobre una corrida reproducida (posiciones RECONSTRUIDAS: trabajadores desde sus banderas
// de actividad, robot interpolado entre eventos del log → distancias aproximadas).
import { FLAG } from './run.js'
import { SSM_DEFAULTS, protectionDistance } from '../hrsim/ssm.js'

// Zonas de proxemia (Hall, 1966; valores usuales en navegación social)
export const ZONES = [
  { key: 'intimate', label: 'Íntima', r: 0.45, color: '#dc2626' },
  { key: 'personal', label: 'Personal', r: 1.2, color: '#f59e0b' },
  { key: 'social', label: 'Social', r: 3.6, color: '#eab308' },
]
export const zoneOf = (d) => (d < ZONES[0].r ? 0 : d < ZONES[1].r ? 1 : d < ZONES[2].r ? 2 : 3)
const ENC_D = 1.5 // distancia que define un "encuentro"
export const V_MOVE = 0.05 // m/s: por encima, el robot se considera en movimiento
// estados del trabajador dedicados al robot (motor JS): 10 camina a la caja, 11 la carga, 12 baja la escalera para atenderlo
export const ATTEND_STATES = [10, 11, 12]

const pct = (xs, q) => {
  if (!xs.length) return null
  const s = Float64Array.from(xs).sort()
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil(q * s.length) - 1))]
}
// tramos contiguos donde se cumple cond(i): [[a, b], …] con b inclusivo
function spans(n, cond) {
  const out = []
  for (let i = 0; i < n; i++)
    if (cond(i)) {
      const a = i
      while (i + 1 < n && cond(i + 1)) i++
      out.push([a, i])
    }
  return out
}

const jain = (xs) => {
  const v = xs.filter((x) => x > 0)
  if (v.length < 2) return 1
  const s = v.reduce((a, b) => a + b, 0),
    s2 = v.reduce((a, b) => a + b * b, 0)
  return (s * s) / (v.length * s2)
}

// Traspaso: el trabajador está en estado "colocando/cargando caja" (bandera 3) o lo estuvo hace ≤ 5 s
function handoffMask(w, n, dt) {
  const back = Math.max(1, Math.round(5 / dt)),
    m = new Uint8Array(n)
  let last = -1e9
  for (let i = 0; i < n; i++) {
    if (w.flag[i] === 3) last = i
    m[i] = i - last <= back ? 1 : 0
  }
  return m
}

export function analyzeHRI(run, ssm = run.meta?.params?.ssm ?? SSM_DEFAULTS) {
  const n = run.n,
    nw = run.workers.length,
    DT = run.dt
  if (!run.robot || !run.robot.pos) return null
  const hand = run.workers.map((w) => handoffMask(w, n, DT))
  const isHandoff = (k, i) => hand[k][i] === 1
  const rp = run.robot.pos
  // velocidad instantánea (desplazamiento en el tick) para S_p; `speed` (ventana de 1 s) para los encuentros
  const vInst = new Float32Array(n)
  for (let i = 1; i < n; i++) vInst[i] = Math.hypot(rp[i * 3] - rp[(i - 1) * 3], rp[i * 3 + 1] - rp[(i - 1) * 3 + 1]) / DT
  const moving = (i) => vInst[i] > V_MOVE
  const dist = new Float32Array(n * nw)
  const minD = new Float32Array(n)
  const minW = new Uint8Array(n)
  const speed = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const j = Math.max(0, i - Math.max(1, Math.round(1 / DT)))
    speed[i] = i === j ? 0 : Math.hypot(rp[i * 3] - rp[j * 3], rp[i * 3 + 1] - rp[j * 3 + 1]) / ((i - j) * DT)
    let m = 1e9,
      mw = 0
    run.workers.forEach((w, k) => {
      const d = Math.hypot(w.track[i * 4] - rp[i * 3], w.track[i * 4 + 1] - rp[i * 3 + 1])
      dist[i * nw + k] = d
      if (d < m) {
        m = d
        mw = k
      }
    })
    minD[i] = m
    minW[i] = mw
  }

  // --- Cortesía: tiempo en cada zona y distancia mínima, por trabajador ---
  const perWorker = run.workers.map((w, k) => {
    const t = [0, 0, 0] // íntima, personal, social (acumulativo: <0.45, <1.2, <3.6)
    const tMov = [0, 0, 0] // … de ello, con el robot en movimiento
    let mn = 1e9,
      tHand = 0
    for (let i = 0; i < n; i++) {
      const d = dist[i * nw + k]
      // el traspaso de caja (el trabajador sube la caja al robot detenido) es contacto intencional: no cuenta como invasión
      if (isHandoff(k, i)) {
        tHand += DT
        continue
      }
      if (d < mn) mn = d
      const mv = moving(i)
      for (let z = 0; z < 3; z++)
        if (d < ZONES[z].r) {
          t[z] += DT
          if (mv) tMov[z] += DT
        }
    }
    return {
      h: w.h,
      act: w.act,
      minD: mn,
      tIntimate: t[0],
      tPersonal: t[1],
      tSocial: t[2],
      tHandoff: tHand,
      zoneMoving: tMov,
      zoneStopped: t.map((x, z) => x - tMov[z]),
    }
  })

  // --- Cesión de paso: encuentros (distancia < 1.5 m) ---
  const encounters = []
  let i = 0
  while (i < n) {
    if (minD[i] < ENC_D) {
      let a = i,
        best = i
      while (i < n && minD[i] < ENC_D) {
        if (minD[i] < minD[best]) best = i
        i++
      }
      const k = minW[best],
        w = run.workers[k]
      const hf = w.flag[best]
      const humanMoving = hf === 2 || hf === 3
      const sp = speed[best]
      const handoff = isHandoff(k, best)
      // quién "debería ceder": el humano ocupado/quieto en su tarea tiene prioridad; si ambos se mueven → ambiguo
      const verdict = handoff
        ? 'traspaso de caja'
        : !humanMoving
          ? sp > 0.15
            ? 'robot debe ceder'
            : 'ambos casi quietos'
          : sp > 0.15
            ? 'ambos en movimiento'
            : 'robot quieto'
      encounters.push({ t0: a * DT, t1: (i - 1) * DT, tMin: best * DT, h: w.h, minD: minD[best], flag: hf, robotSpeed: sp, verdict })
    } else i++
  }

  // --- Asignación: espera de cada caja hasta que el robot la recoge ---
  const boxes = run.robot.boxes.map((b) => ({
    h: b.h,
    tDetect: b.idx * DT,
    tPick: b.served ? b.picked * DT : null,
    wait: b.served ? (b.picked - b.idx) * DT : null,
  }))
  const served = boxes.filter((b) => b.wait != null)
  const waitByW = run.workers.map((w) => {
    const ws = served.filter((b) => b.h === w.h).map((b) => b.wait)
    return {
      h: w.h,
      n: ws.length,
      mean: ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : 0,
      p90: ws.length ? pct(ws, 0.9) : 0,
      max: ws.length ? Math.max(...ws) : 0,
    }
  })
  // inversiones respecto de FIFO: caja detectada antes pero atendida después
  let inv = 0,
    pairs = 0
  for (let a = 0; a < served.length; a++)
    for (let b = a + 1; b < served.length; b++) {
      if (served[a].tDetect < served[b].tDetect) {
        pairs++
        if (served[a].tPick > served[b].tPick) inv++
      }
    }
  const allW = served.map((b) => b.wait)
  const assign = {
    n: served.length,
    pending: boxes.length - served.length,
    mean: allW.length ? allW.reduce((a, b) => a + b, 0) / allW.length : 0,
    p90: allW.length ? pct(allW, 0.9) : 0,
    max: allW.length ? Math.max(...allW) : 0,
    jain: jain(waitByW.map((w) => w.mean)),
    inversions: inv,
    pairs,
    byWorker: waitByW,
  }

  const nIntimate = perWorker.reduce((a, w) => a + (w.tIntimate > 0 ? 1 : 0), 0)
  const nHandoffs = encounters.filter((e) => e.verdict === 'traspaso de caja').length

  // --- Fluidez y seguridad (fase 2) ---
  // estado del robot por tick (solo motor JS): 0 se mueve, 1 espera al trabajador, 2 descarga/carga,
  // 3 parada de seguridad, 4 velocidad reducida por seguridad (los dos últimos solo en el perfil hri)
  const st = run.robot.status
  const T = n * DT
  const robotTime = st
    ? (() => {
        const c = [0, 0, 0, 0, 0]
        for (let i = 0; i < n; i++) if (st[i] <= 4) c[st[i]]++
        return { move: c[0] / n, wait: c[1] / n, stop: c[2] / n, safety: c[3] / n, slow: c[4] / n, exact: true }
      })()
    : (() => {
        let m = 0
        for (let i = 0; i < n; i++) if (moving(i)) m++
        return { move: m / n, wait: null, stop: null, stopped: 1 - m / n, exact: false }
      })()
  // espera del robot: tramos con rst = 1; se atribuye a la caja que recoge al terminar la espera
  const boxesByPick = run.robot.boxes.filter((b) => b.served).sort((a, b) => a.picked - b.picked)
  const robotWait = st
    ? (() => {
        const ev = spans(n, (i) => st[i] === 1).map(([a, b]) => {
          const box = boxesByPick.find((x) => x.picked >= b)
          return { t0: a * DT, dur: (b - a + 1) * DT, h: box ? box.h : null }
        })
        const tot = ev.reduce((s, e) => s + e.dur, 0)
        return { total: tot, n: ev.length, mean: ev.length ? tot / ev.length : 0, max: ev.length ? Math.max(...ev.map((e) => e.dur)) : 0, events: ev }
      })()
    : null
  // tiempo de cada trabajador dedicado al robot (estados 10, 11, 12)
  const attend = run.workers.every((w) => w.state)
    ? run.workers.map((w) => {
        let c = 0
        for (let i = 0; i < n; i++) if (ATTEND_STATES.includes(w.state[i])) c++
        return { h: w.h, s: c * DT, frac: c / n }
      })
    : null
  // distancia de protección S_p(v_c): ticks con el robot en movimiento y un trabajador (que no está cargando su caja)
  // más cerca que S_p de su velocidad de ACERCAMIENTO a ese trabajador (ISO/TS 15066: componente hacia la persona)
  const minMov = [] // distancia mínima a trabajadores (sin traspasos) en cada tick de movimiento
  const inSp = new Uint8Array(n),
    who = new Int16Array(n).fill(-1),
    vcAt = new Float32Array(n)
  for (let i = 1; i < n; i++) {
    if (!moving(i)) continue
    const ddx = rp[i * 3] - rp[(i - 1) * 3],
      ddy = rp[i * 3 + 1] - rp[(i - 1) * 3 + 1]
    let m = 1e9
    for (let k = 0; k < nw; k++) {
      if (isHandoff(k, i)) continue
      const w = run.workers[k]
      const d = dist[i * nw + k]
      if (d < m) m = d
      const ux = w.track[i * 4] - rp[(i - 1) * 3],
        uy = w.track[i * 4 + 1] - rp[(i - 1) * 3 + 1],
        du = Math.hypot(ux, uy)
      const vc = du > 1e-9 ? Math.max(0, (ddx * ux + ddy * uy) / du / DT) : vInst[i]
      if (d < protectionDistance(vc, ssm) && (who[i] < 0 || d < dist[i * nw + who[i]])) {
        who[i] = k
        vcAt[i] = vc
      }
    }
    if (m < 1e9) minMov.push(m)
    if (who[i] >= 0) inSp[i] = 1
  }
  const spEvents = spans(n, (i) => inSp[i] === 1).map(([a, b]) => {
    let best = a
    for (let i = a; i <= b; i++) if (dist[i * nw + who[i]] < dist[best * nw + who[best]]) best = i
    const k = who[best]
    return { t0: a * DT, dur: (b - a + 1) * DT, h: run.workers[k].h, minD: dist[best * nw + k], v: vcAt[best], sp: protectionDistance(vcAt[best], ssm) }
  })
  const safetyStops = st ? spans(n, (i) => st[i] === 3).map(([a, b]) => ({ t0: a * DT, dur: (b - a + 1) * DT })) : []
  const fluency = {
    exact: !!st,
    safetyStops,
    robotTime,
    robotWait,
    boxWait: { mean: assign.mean, p90: assign.p90, max: assign.max },
    attend,
    attendMean: attend ? attend.reduce((s, a) => s + a.s, 0) / attend.length : null,
    jainAttend: attend ? jain(attend.map((a) => a.s)) : null,
    protection: { s: spEvents.reduce((s, e) => s + e.dur, 0), n: spEvents.length, frac: spEvents.reduce((s, e) => s + e.dur, 0) / T, events: spEvents },
    minDist: Math.min(...perWorker.map((w) => w.minD)),
    p5Moving: pct(minMov, 0.05),
    ssm,
  }
  return { dist, minD, minW, speed, vInst, perWorker, encounters, assign, nIntimate, nHandoffs, fluency }
}

/** Columnas de fase 2 para simulaciones/indice.csv (nombres estables; valores redondeados). */
export function fluencyIndex(a) {
  const f = a?.fluency
  if (!f) return {}
  const r = (x, d = 2) => (x == null || !Number.isFinite(x) ? '' : +x.toFixed(d))
  return {
    HR_robot_mov_pct: r(f.robotTime.move * 100, 1),
    HR_robot_espera_pct: r(f.robotTime.wait != null ? f.robotTime.wait * 100 : null, 1),
    HR_robot_detenido_pct: r(f.robotTime.stop != null ? f.robotTime.stop * 100 : null, 1),
    HR_robot_parada_seg_pct: r(f.robotTime.safety != null ? f.robotTime.safety * 100 : null, 1),
    HR_robot_lento_pct: r(f.robotTime.slow != null ? f.robotTime.slow * 100 : null, 1),
    HR_paradas_seg: f.exact ? f.safetyStops.length : '',
    HR_espera_robot_s: r(f.robotWait?.total, 1),
    HR_espera_caja_media_s: r(f.boxWait.mean, 1),
    HR_espera_caja_p90_s: r(f.boxWait.p90, 1),
    HR_atencion_media_s: r(f.attendMean, 1),
    HR_jain_espera: r(a.assign.jain, 3),
    HR_jain_atencion: r(f.jainAttend, 3),
    HR_dentro_Sp_s: r(f.protection.s, 1),
    HR_eventos_Sp: f.protection.n,
    HR_dist_min_m: r(f.minDist, 2),
    HR_dist_p5_mov_m: r(f.p5Moving, 2),
  }
}

// Mini-tira de calor: distancia mínima robot–humano a lo largo del tiempo (para la línea de tiempo)
export function heatGradient(a, stops = 120) {
  const n = a.minD.length
  const parts = []
  for (let s = 0; s < stops; s++) {
    const i0 = Math.floor((s / stops) * n),
      i1 = Math.max(i0 + 1, Math.floor(((s + 1) / stops) * n))
    let m = 1e9
    for (let i = i0; i < i1 && i < n; i++) m = Math.min(m, a.minD[i])
    const z = zoneOf(m)
    const col = z === 0 ? '#dc2626' : z === 1 ? '#f59e0b' : z === 2 ? '#fde68a' : '#e8edf8'
    parts.push(`${col} ${((s / stops) * 100).toFixed(2)}% ${(((s + 1) / stops) * 100).toFixed(2)}%`)
  }
  return `linear-gradient(90deg, ${parts.join(',')})`
}
export { FLAG }
