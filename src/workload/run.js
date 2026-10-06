// Lectura de una corrida de MATLAB: *_timeseries.csv (+ opcional *_robot_status_log.txt).
// El CSV no registra trayectorias: la posición de los trabajadores y del robot se RECONSTRUYE
// (trabajadores: posición base + viaje a su caja según las banderas de actividad;
// robot: interpolación lineal entre los eventos del log).
import { MIX, workerBase, boxXY, CARGO } from './spec'

export const DT = 0.25
export const FLAG = {
  0: { label: 'Inicio', color: '#9aa6bf' },
  1: { label: 'Cosechando', color: '#16a34a' },
  2: { label: 'Caminando / transporte', color: '#2f6bff' },
  3: { label: 'Colocando caja', color: '#f59e0b' },
  4: { label: 'Bajando escalera', color: '#8b5cf6' },
  5: { label: 'Subiendo escalera', color: '#ec4899' },
}

export function parseName(name) {
  const m = /HUMAN_(ROBOT|ONLY)_(\d+)_ROW(\d)_harv_([a-z]+)_RP(\d)/i.exec(name || '')
  if (!m) return null
  return { robot: m[1].toUpperCase() === 'ROBOT', nw: +m[2], row: +m[3], act: m[4].toLowerCase(), rp: +m[5] }
}

function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim())
  const head = lines[0].split(',')
  const col = Object.fromEntries(head.map((h, i) => [h, i]))
  const rows = lines.slice(1).map((l) => l.split(',').map(Number))
  return { col, rows }
}

function parseLog(text, n) {
  const key = [], picks = [], boxes = [], unloads = []
  const num = '(-?[\\d.]+)'
  const reXY = new RegExp(`\\[${num}\\s+${num}\\]`)
  text.replace(/\r/g, '').split('\n').forEach((line) => {
    const m = /^idx=(\d+)\s*\|\s*(.+)$/.exec(line)
    if (!m) return
    const idx = +m[1], body = m[2]
    let r
    if (/reached ROUTE waypoint/.test(body) && (r = /pos=\[(-?[\d.]+)\s+(-?[\d.]+)\]/.exec(body))) key.push({ idx, x: +r[1], y: +r[2] })
    else if (/Robot picked BOX/.test(body)) {
      const h = /from h(\d+)/.exec(body), a = /box_product=([\d.]+)/.exec(body), p = /robot=\[(-?[\d.]+)\s+(-?[\d.]+)\]/.exec(body)
      if (h && p) { key.push({ idx, x: +p[1], y: +p[2] }); picks.push({ idx, h: +h[1], amount: a ? +a[1] : 0 }) }
    } else if (/Robot detected BOX/.test(body)) {
      const h = /from h(\d+)/.exec(body)
      const b = /box=\[(-?[\d.]+)\s+(-?[\d.]+)\]/.exec(body) || /at \[(-?[\d.]+)\s+(-?[\d.]+)\]/.exec(body)
      if (h && b) boxes.push({ idx, h: +h[1], x: +b[1], y: +b[2], picked: n + 1, served: false })
    } else if (/reached CARGO ZONE/.test(body)) {
      const a = /unloading ([\d.]+)/.exec(body)
      key.push({ idx, x: CARGO.wp[0], y: CARGO.wp[1] })
      unloads.push({ idx, amount: a ? +a[1] : 0 })
    }
  })
  // cada pick cierra la detección pendiente más antigua del mismo trabajador (espera = pick - detección)
  picks.forEach((p) => {
    const b = boxes.find((x) => x.h === p.h && x.idx <= p.idx && !x.served)
    if (b) { b.picked = p.idx; b.served = true }
  })
  key.sort((a, b) => a.idx - b.idx)
  const uniq = []
  key.forEach((k) => { if (uniq.length && uniq[uniq.length - 1].idx === k.idx) uniq[uniq.length - 1] = k; else uniq.push(k) })
  return { key: uniq, picks, boxes, unloads }
}

function robotTrack(key, n) {
  const pos = new Float32Array(n * 3) // x, y, heading
  if (!key.length) return null
  let j = 0, lastH = 0
  for (let i = 0; i < n; i++) {
    while (j + 1 < key.length && key[j + 1].idx <= i) j++
    const a = key[j], b = key[j + 1]
    let x = a.x, y = a.y
    if (i < key[0].idx) { x = key[0].x; y = key[0].y }
    else if (b) {
      const f = (i - a.idx) / Math.max(1, b.idx - a.idx)
      x = a.x + (b.x - a.x) * f; y = a.y + (b.y - a.y) * f
      if (Math.hypot(b.x - a.x, b.y - a.y) > 0.05) lastH = Math.atan2(b.y - a.y, b.x - a.x)
    }
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = lastH
  }
  return pos
}

// Reconstrucción de la posición (x, y, altura de escalera, rumbo) del trabajador en cada tick
function workerTrack(flags, base, box) {
  const n = flags.length
  const out = new Float32Array(n * 4)
  const set = (i, x, y, z, hd) => { out[i * 4] = x; out[i * 4 + 1] = y; out[i * 4 + 2] = z; out[i * 4 + 3] = hd }
  for (let i = 0; i < n; i++) set(i, base.x, base.y, 0, base.heading)
  // viajes: tramos contiguos con bandera 2 o 3
  let i = 0
  while (i < n) {
    if (flags[i] === 2 || flags[i] === 3) {
      let a = i
      while (i < n && (flags[i] === 2 || flags[i] === 3)) i++
      const b = i - 1
      let f3 = -1, l3 = -1
      for (let k = a; k <= b; k++) if (flags[k] === 3) { if (f3 < 0) f3 = k; l3 = k }
      const mid = Math.floor((a + b) / 2)
      const outEnd = f3 >= 0 ? f3 - 1 : mid
      const backStart = f3 >= 0 ? l3 + 1 : mid + 1
      const hdOut = Math.atan2(box[1] - base.y, box[0] - base.x)
      for (let k = a; k <= b; k++) {
        let f, hd
        if (k <= outEnd) { f = (k - a + 1) / Math.max(1, outEnd - a + 1); hd = hdOut }
        else if (k < backStart) { f = 1; hd = base.heading }
        else { f = 1 - (k - backStart + 1) / Math.max(1, b - backStart + 1); hd = hdOut + Math.PI }
        set(k, base.x + (box[0] - base.x) * f, base.y + (box[1] - base.y) * f, 0, hd)
      }
    } else i++
  }
  return out
}

function ladderHeights(flags, H = 1.7) {
  const n = flags.length
  const h = new Float32Array(n)
  let cur = 0, i = 0
  while (i < n) {
    const f = flags[i]
    if (f === 5 || f === 4) {
      let a = i
      while (i < n && flags[i] === f) i++
      const len = i - a
      for (let k = a; k < i; k++) h[k] = f === 5 ? H * ((k - a + 1) / len) : H * (1 - (k - a + 1) / len)
      cur = f === 5 ? H : 0
    } else { h[i] = cur; i++ }
  }
  return h
}

export function buildRun({ csvText, logText, name }) {
  const meta = parseName(name) || { robot: !!logText, nw: 0, row: 3, act: 'mixed', rp: 0 }
  const { col, rows } = parseCSV(csvText)
  const n = rows.length
  let nw = 0
  while (col[`Workload_H${nw + 1}`] !== undefined) nw++
  meta.nw = nw
  const g = (row, c) => row[col[c]]
  const series = { t: new Float32Array(n), cargo: new Float32Array(n), total: new Float32Array(n), robot: new Float32Array(n), work: new Float32Array(n) }
  const workers = Array.from({ length: nw }, (_, k) => {
    const h = k + 1
    const act = meta.act === 'mixed' ? MIX[(h - 1) % 6] : meta.act
    const base = workerBase(h, meta.row, meta.rp)
    return { h, act, base, box: boxXY(base, meta.row), prod: new Float32Array(n), work: new Float32Array(n), flag: new Uint8Array(n) }
  })
  rows.forEach((r, i) => {
    series.t[i] = g(r, 'Time_s'); series.cargo[i] = g(r, 'Total_product_cargo'); series.total[i] = g(r, 'Total_product')
    series.robot[i] = g(r, 'Total_product_robot'); series.work[i] = g(r, 'Total_workload')
    workers.forEach((w) => { w.prod[i] = g(r, `Production_H${w.h}`); w.work[i] = g(r, `Workload_H${w.h}`); w.flag[i] = g(r, `ActivityFlag_H${w.h}`) })
  })
  // tasa metabólica en ventana de 10 s (kcal/s) y su escala
  const WIN = 40
  const all = []
  workers.forEach((w) => {
    w.rate = new Float32Array(n)
    for (let i = 0; i < n; i++) { const j = Math.max(0, i - WIN); w.rate[i] = i === j ? 0 : (w.work[i] - w.work[j]) / ((i - j) * DT) }
    for (let i = WIN; i < n; i += 4) all.push(w.rate[i])
    w.track = workerTrack(w.flag, w.base, w.box)
    const lh = w.act === 'ladder' ? ladderHeights(w.flag) : null
    if (lh) for (let i = 0; i < n; i++) w.track[i * 4 + 2] = lh[i]
  })
  all.sort((a, b) => a - b)
  const rateMax = all.length ? all[Math.floor(all.length * 0.97)] || 1 : 1
  let robot = null
  if (logText) {
    const lg = parseLog(logText, n)
    robot = { pos: robotTrack(lg.key, n), picks: lg.picks, boxes: lg.boxes, unloads: lg.unloads }
  }
  return { meta, n, series, workers, robot, rateMax, name }
}

// Contenido a bordo del robot (cultivo) en el tick i, a partir de picks y descargas
export function onboard(run, i) {
  if (!run.robot) return 0
  let v = 0
  const ev = [
    ...run.robot.picks.map((p) => ({ idx: p.idx, d: +p.amount, k: 'p' })),
    ...run.robot.unloads.map((u) => ({ idx: u.idx, k: 'u' })),
  ].sort((a, b) => a.idx - b.idx || (a.k === 'u' ? -1 : 1))
  for (const e of ev) { if (e.idx > i) break; if (e.k === 'p') v += e.d; else v = 0 }
  return v
}
