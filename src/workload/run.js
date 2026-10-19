// Lectura de una corrida de MATLAB: *_timeseries.csv (+ opcional *_robot_status_log.txt).
// El CSV no registra trayectorias: la posición de los trabajadores y del robot se RECONSTRUYE
// (trabajadores: posición base + viaje a su caja según las banderas de actividad;
// robot: interpolación lineal entre los eventos del log).
import { MIX, workerBase, boxXY, CARGO } from './spec.js'
import { ladderHeights, metabolicRate, rateScale } from './derive.js'
import { fmtNum, t } from '../i18n/index.js'

// Paso interno del simulador MATLAB: los índices `idx=` del log están en ticks de 0.25 s.
// El CSV puede estar muestreado a otro paso (p. ej. 1 s en el estudio de 45 min): se deduce de Time_s.
export const SIM_TICK = 0.25
export const FLAG = {
  0: { label: 'Inicio', color: '#9aa6bf' },
  1: { label: 'Cosechando', color: '#16a34a' },
  2: { label: 'Caminando / transporte', color: '#2f6bff' },
  3: { label: 'Colocando caja', color: '#f59e0b' },
  4: { label: 'Bajando escalera', color: '#8b5cf6' },
  5: { label: 'Subiendo escalera', color: '#ec4899' },
}

/** Límites de los archivos que se cargan en el navegador (evitan congelar la pestaña). */
export const INPUT_LIMITS = { maxBytes: 50 * 1024 * 1024, maxRows: 200_000, maxCols: 500, maxWorkers: 48 }

export function parseName(name) {
  const m = /HUMAN_(ROBOT|ONLY)_(\d+)_ROW([1-3])_harv_(ground|ladder|picker|mixed)_RP([01])/i.exec(name || '')
  if (!m) return null
  const nw = +m[2]
  if (nw < 1 || nw > INPUT_LIMITS.maxWorkers) return null
  return { robot: m[1].toUpperCase() === 'ROBOT', nw, row: +m[3], act: m[4].toLowerCase(), rp: +m[5] }
}

function parseCSV(text) {
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .filter((l) => l.trim())
  if (lines.length - 1 > INPUT_LIMITS.maxRows)
    throw new FormatError(t('El CSV tiene {n} filas; el máximo es {max}.', { n: fmtNum(lines.length - 1), max: fmtNum(INPUT_LIMITS.maxRows) }))
  const head = lines[0]
    .replace(/^\uFEFF/, '')
    .split(',')
    .map((h) => h.trim())
  if (head.length > INPUT_LIMITS.maxCols)
    throw new FormatError(t('El CSV tiene {n} columnas; el máximo es {max}.', { n: head.length, max: INPUT_LIMITS.maxCols }))
  const col = Object.fromEntries(head.map((h, i) => [h, i]))
  const rows = lines.slice(1).map((l) => l.split(',').map((v) => (v.trim() === '' ? NaN : Number(v))))
  return { col, rows }
}

function parseLog(text, n, dt) {
  const row = (idx) => Math.max(0, Math.round(((idx - 1) * SIM_TICK) / dt))
  const key = [],
    picks = [],
    boxes = [],
    unloads = []
  text
    .replace(/\r/g, '')
    .split('\n')
    .forEach((line) => {
      const m = /^idx=(\d+)\s*\|\s*(.+)$/.exec(line)
      if (!m) return
      const idx = row(+m[1]),
        body = m[2]
      let r
      if (/reached ROUTE waypoint/.test(body) && (r = /pos=\[(-?[\d.]+)\s+(-?[\d.]+)\]/.exec(body))) key.push({ idx, x: +r[1], y: +r[2] })
      else if (/Robot picked BOX/.test(body)) {
        const h = /from h(\d+)/.exec(body),
          a = /box_product=([\d.]+)/.exec(body),
          p = /robot=\[(-?[\d.]+)\s+(-?[\d.]+)\]/.exec(body)
        if (h && p) {
          key.push({ idx, x: +p[1], y: +p[2] })
          picks.push({ idx, h: +h[1], amount: a ? +a[1] : 0 })
        }
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
    if (b) {
      b.picked = p.idx
      b.served = true
    }
  })
  key.sort((a, b) => a.idx - b.idx)
  const uniq = []
  key.forEach((k) => {
    if (uniq.length && uniq[uniq.length - 1].idx === k.idx) uniq[uniq.length - 1] = k
    else uniq.push(k)
  })
  return { key: uniq, picks, boxes, unloads }
}

function robotTrack(key, n) {
  const pos = new Float32Array(n * 3) // x, y, heading
  if (!key.length) return null
  let j = 0,
    lastH = 0
  for (let i = 0; i < n; i++) {
    while (j + 1 < key.length && key[j + 1].idx <= i) j++
    const a = key[j],
      b = key[j + 1]
    let x = a.x,
      y = a.y
    if (i < key[0].idx) {
      x = key[0].x
      y = key[0].y
    } else if (b) {
      const f = (i - a.idx) / Math.max(1, b.idx - a.idx)
      x = a.x + (b.x - a.x) * f
      y = a.y + (b.y - a.y) * f
      if (Math.hypot(b.x - a.x, b.y - a.y) > 0.05) lastH = Math.atan2(b.y - a.y, b.x - a.x)
    }
    pos[i * 3] = x
    pos[i * 3 + 1] = y
    pos[i * 3 + 2] = lastH
  }
  return pos
}

// Reconstrucción de la posición (x, y, altura de escalera, rumbo) del trabajador en cada tick
function workerTrack(flags, base, box) {
  const n = flags.length
  const out = new Float32Array(n * 4)
  const set = (i, x, y, z, hd) => {
    out[i * 4] = x
    out[i * 4 + 1] = y
    out[i * 4 + 2] = z
    out[i * 4 + 3] = hd
  }
  for (let i = 0; i < n; i++) set(i, base.x, base.y, 0, base.heading)
  // viajes: tramos contiguos con bandera 2 o 3
  let i = 0
  while (i < n) {
    if (flags[i] === 2 || flags[i] === 3) {
      let a = i
      while (i < n && (flags[i] === 2 || flags[i] === 3)) i++
      const b = i - 1
      let f3 = -1,
        l3 = -1
      for (let k = a; k <= b; k++)
        if (flags[k] === 3) {
          if (f3 < 0) f3 = k
          l3 = k
        }
      const mid = Math.floor((a + b) / 2)
      const outEnd = f3 >= 0 ? f3 - 1 : mid
      const backStart = f3 >= 0 ? l3 + 1 : mid + 1
      const hdOut = Math.atan2(box[1] - base.y, box[0] - base.x)
      for (let k = a; k <= b; k++) {
        let f, hd
        if (k <= outEnd) {
          f = (k - a + 1) / Math.max(1, outEnd - a + 1)
          hd = hdOut
        } else if (k < backStart) {
          f = 1
          hd = base.heading
        } else {
          f = 1 - (k - backStart + 1) / Math.max(1, b - backStart + 1)
          hd = hdOut + Math.PI
        }
        set(k, base.x + (box[0] - base.x) * f, base.y + (box[1] - base.y) * f, 0, hd)
      }
    } else i++
  }
  return out
}

/** Error de formato de un archivo de entrada: mensaje pensado para mostrarse al usuario. */
export class FormatError extends Error {
  constructor(msg) {
    super(msg)
    this.name = 'FormatError'
  }
}

export const REQUIRED_COLUMNS = ['Time_s', 'Total_product_cargo', 'Total_product', 'Total_workload']

/** Contrato del *_timeseries.csv de MATLAB: columnas, filas, tiempo creciente y valores numéricos. */
export function validateTimeseries(col, rows) {
  const missing = REQUIRED_COLUMNS.filter((c) => col[c] === undefined)
  if (missing.length) throw new FormatError(t('Al CSV le faltan columnas: {cols}.', { cols: missing.join(', ') }))
  if (col.Workload_H1 === undefined || col.Production_H1 === undefined || col.ActivityFlag_H1 === undefined)
    throw new FormatError(t('El CSV no tiene columnas por trabajador (Production_H1, Workload_H1, ActivityFlag_H1…).'))
  if (rows.length < 2) throw new FormatError(t('El CSV necesita al menos 2 filas de datos.'))
  const ncol = Object.keys(col).length
  rows.forEach((r, i) => {
    if (r.length !== ncol) throw new FormatError(t('La fila {i} tiene {n} valores y la cabecera {h}.', { i: i + 2, n: r.length, h: ncol }))
    if (r.some((v) => !Number.isFinite(v))) throw new FormatError(t('La fila {i} tiene valores no numéricos.', { i: i + 2 }))
    if (i > 0 && !(r[col.Time_s] > rows[i - 1][col.Time_s])) throw new FormatError(t('Time_s no es creciente en la fila {i}.', { i: i + 2 }))
  })
}

export function buildRun({ csvText, logText, name }) {
  if (typeof csvText !== 'string' || !csvText.trim()) throw new FormatError(t('El CSV está vacío.'))
  const meta = parseName(name) || { robot: !!logText, nw: 0, row: 3, act: 'mixed', rp: 0 }
  const { col, rows } = parseCSV(csvText)
  validateTimeseries(col, rows)
  const n = rows.length
  const dt = n > 1 && rows[1][col.Time_s] > rows[0][col.Time_s] ? rows[1][col.Time_s] - rows[0][col.Time_s] : SIM_TICK
  meta.duration = rows[n - 1][col.Time_s]
  meta.robot = meta.robot || !!logText
  let nw = 0
  while (col[`Workload_H${nw + 1}`] !== undefined) nw++
  meta.nw = nw
  // las corridas de estudio (45 min) usan un punto de entrega por árbol; las antiguas (10 min), uno por trabajador
  meta.placement = meta.duration > 1000 ? 'tree_point' : 'route_corridor'
  const lg = logText ? parseLog(logText, n, dt) : null
  const g = (row, c) => row[col[c]]
  const series = { t: new Float32Array(n), cargo: new Float32Array(n), total: new Float32Array(n), robot: new Float32Array(n), work: new Float32Array(n) }
  const workers = Array.from({ length: nw }, (_, k) => {
    const h = k + 1
    const act = meta.act === 'mixed' ? MIX[(h - 1) % 6] : meta.act
    const base = workerBase(h, meta.row, meta.rp)
    // destino de la caja: Human-Only → zona de carga; Human-Robot → punto de entrega (del log si existe, si no, calculado)
    const logged = lg && lg.boxes.find((b) => b.h === h)
    const box = meta.robot ? (logged ? [logged.x, logged.y] : boxXY(base, meta.row, meta.placement)) : [CARGO.wp[0], CARGO.wp[1]]
    return { h, act, base, box, prod: new Float32Array(n), work: new Float32Array(n), flag: new Uint8Array(n) }
  })
  rows.forEach((r, i) => {
    series.t[i] = g(r, 'Time_s')
    series.cargo[i] = g(r, 'Total_product_cargo')
    series.total[i] = g(r, 'Total_product')
    series.robot[i] = g(r, 'Total_product_robot')
    series.work[i] = g(r, 'Total_workload')
    workers.forEach((w) => {
      w.prod[i] = g(r, `Production_H${w.h}`)
      w.work[i] = g(r, `Workload_H${w.h}`)
      w.flag[i] = g(r, `ActivityFlag_H${w.h}`)
    })
  })
  // tasa metabólica en ventana de 10 s (kcal/s) y su escala
  const all = []
  workers.forEach((w) => {
    w.rate = metabolicRate(w.work, dt, all)
    w.track = workerTrack(w.flag, w.base, w.box)
    const lh = w.act === 'ladder' ? ladderHeights(w.flag) : null
    if (lh) for (let i = 0; i < n; i++) w.track[i * 4 + 2] = lh[i]
  })
  const rateMax = rateScale(all)
  let robot = null
  if (lg) {
    robot = { pos: robotTrack(lg.key, n), picks: lg.picks, boxes: lg.boxes, unloads: lg.unloads }
    // contenido a bordo en cada fila (cultivo recogido y aún no descargado)
    const ev = [...robot.picks.map((p) => ({ idx: p.idx, d: +p.amount, k: 'p' })), ...robot.unloads.map((u) => ({ idx: u.idx, k: 'u' }))].sort(
      (a, b) => a.idx - b.idx || (a.k === 'u' ? -1 : 1),
    )
    robot.onboard = new Float32Array(n)
    let v = 0,
      e = 0
    for (let i = 0; i < n; i++) {
      while (e < ev.length && ev[e].idx <= i) {
        if (ev[e].k === 'p') v += ev[e].d
        else v = 0
        e++
      }
      robot.onboard[i] = v
    }
  }
  return { meta, n, dt, series, workers, robot, rateMax, name, rowAt: (t) => Math.min(n - 1, Math.max(0, Math.floor(t / dt))) }
}

// Contenido a bordo del robot (cultivo) en la fila i
export function onboard(run, i) {
  return run.robot ? run.robot.onboard[Math.min(i, run.n - 1)] : 0
}
