// Biblioteca de corridas: manifiesto (public/data/manifest.json) + archivos cargados por el usuario.
// Una "configuración" es (nw, row, act, rp); cada una puede tener una corrida Solo-humano (HO) y otra Humano-Robot (HR).
import { buildRun, parseName, INPUT_LIMITS } from './run.js'
import { analyzeHRI } from './hri.js'

const cache = new Map()

export const makeRun = (args) => {
  const r = buildRun(args)
  if (r.robot) r.hri = analyzeHRI(r)
  return r
}

export const cfgKey = (m) => `${m.nw}|${m.row}|${m.act}|${m.rp}`

export async function loadManifest(base) {
  try {
    const r = await fetch(`${base}data/manifest.json`)
    if (!r.ok) return []
    const j = await r.json()
    return (j.runs || []).map((e) => ({ ...e, source: 'manifest' }))
  } catch {
    return []
  }
}

// Construye (y guarda en caché) la corrida de una entrada del catálogo
export async function realize(entry, base) {
  if (cache.has(entry.id)) return cache.get(entry.id)
  let csvText, logText
  if (entry.text) {
    csvText = entry.text.csv
    logText = entry.text.log
  } else {
    const get = (f) => fetch(`${base}data/${f}`).then((r) => (r.ok ? r.text() : ''))
    ;[csvText, logText] = await Promise.all([get(entry.csv), entry.log ? get(entry.log) : Promise.resolve('')])
    if (!csvText.replace(/^\uFEFF/, '').startsWith('Time_s')) throw new Error(`No se pudo leer ${entry.csv}`)
  }
  const name = entry.csv.replace(/_timeseries\.csv$/i, '')
  const run = makeRun({ csvText, logText: logText && logText.startsWith('idx=') ? logText : null, name })
  run.entryId = entry.id
  cache.set(entry.id, run)
  return run
}

// Archivos elegidos por el usuario: se agrupan por corrida (mismo prefijo) y se registran como entradas del catálogo
export async function entriesFromFiles(files) {
  const fl = [...files]
  const csvs = fl.filter((f) => /_timeseries\.csv$/i.test(f.name) || /\.csv$/i.test(f.name))
  if (!csvs.length) throw new Error('Selecciona al menos un *_timeseries.csv (y opcionalmente su *_robot_status_log.txt).')
  const out = []
  for (const csv of csvs) {
    const stem = csv.name.replace(/_timeseries\.csv$/i, '').replace(/\.csv$/i, '')
    const m = parseName(stem)
    if (!m)
      throw new Error(
        `No reconozco el nombre "${csv.name}". Debe ser del tipo HUMAN_ROBOT_12_ROW3_harv_mixed_RP0_…_timeseries.csv (fila 1–3, RP 0–1, hasta ${INPUT_LIMITS.maxWorkers} trabajadores).`,
      )
    const mb = (f) => (f.size / 1048576).toFixed(0)
    for (const f of [csv, ...fl.filter((x) => /\.txt$/i.test(x.name) && x.name.startsWith(stem))])
      if (f.size > INPUT_LIMITS.maxBytes) throw new Error(`"${f.name}" pesa ${mb(f)} MB; el máximo es ${INPUT_LIMITS.maxBytes / 1048576} MB.`)
    const log = fl.find((f) => /\.txt$/i.test(f.name) && f.name.startsWith(stem))
    const id = `file-${stem}-${csv.size}`
    cache.delete(id)
    out.push({ id, ...m, csv: csv.name, log: log ? log.name : null, source: 'archivo', text: { csv: await csv.text(), log: log ? await log.text() : null } })
  }
  return out
}

export const ACTS = ['ground', 'ladder', 'picker', 'mixed']
