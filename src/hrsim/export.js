import { toJSONSafe } from './common.js'
// Exporta una corrida simulada en el formato de MATLAB (*_timeseries.csv, recargable en «Datos MATLAB»)
// más las poses por tick y un JSON con los parámetros y la versión del motor (trazabilidad).
const stem = (run) => {
  const m = run.meta
  return `HUMAN_${m.robot ? 'ROBOT' : 'ONLY'}_${m.nw}_ROW${m.row}_harv_${m.act}_RP${m.rp}_SIM-${m.paramsHash}`
}
const r6 = (v) => Math.round(v * 1e6) / 1e6

/** CSV con las mismas columnas que MATLAB, muestreado cada `every` s (MATLAB exporta cada 1 s). */
export function timeseriesCSV(run, every = 1) {
  const head = ['Time_s', 'Total_product_cargo', 'Total_product', 'Total_product_robot', 'Total_workload']
  run.workers.forEach((w) => head.push(`Production_H${w.h}`, `Workload_H${w.h}`, `ActivityFlag_H${w.h}`))
  const step = Math.max(1, Math.round(every / run.dt)),
    lines = [head.join(',')]
  for (let i = 0; i < run.n; i += step) {
    const s = run.series,
      row = [r6(s.t[i]), r6(s.cargo[i]), r6(s.total[i]), r6(s.robot[i]), r6(s.work[i])]
    run.workers.forEach((w) => row.push(r6(w.prod[i]), r6(w.work[i]), w.flag[i]))
    lines.push(row.join(','))
  }
  return lines.join('\n') + '\n'
}

/** Poses por tick: robot y trabajadores (equivalente al parche EXPORT_POSE_LOG de MATLAB). Con flota (H8), también los robots 2 y 3. */
export function posesCSV(run) {
  const head = ['Time_s']
  if (run.robot) head.push('Robot_x', 'Robot_y', 'Robot_theta_rad', 'Robot_status')
  const otros = run.flota ? run.flota.robots.slice(1) : []
  otros.forEach((_, k) => head.push(`Robot${k + 2}_x`, `Robot${k + 2}_y`, `Robot${k + 2}_theta_rad`, `Robot${k + 2}_status`))
  run.workers.forEach((w) => head.push(`X_H${w.h}`, `Y_H${w.h}`, `Theta_H${w.h}_rad`, `State_H${w.h}`))
  const lines = [head.join(',')]
  for (let i = 0; i < run.n; i++) {
    const row = [r6(run.series.t[i])]
    if (run.robot) row.push(r6(run.robot.pos[i * 3]), r6(run.robot.pos[i * 3 + 1]), r6(run.robot.body[i]), run.robot.status[i])
    for (const r of otros) row.push(r6(r.pos[i * 3]), r6(r.pos[i * 3 + 1]), r6(r.body[i]), r.status[i])
    run.workers.forEach((w) => row.push(r6(w.track[i * 4]), r6(w.track[i * 4 + 1]), r6(w.track[i * 4 + 3]), w.state ? w.state[i] : 0))
    lines.push(row.join(','))
  }
  return lines.join('\n') + '\n'
}

export function metaJSON(run) {
  const { engineVersion, params, paramsHash } = run.meta
  return toJSONSafe({ engine: 'harvest-viz/hrsim', engineVersion, paramsHash, params, summary: run.summary || null, exportedAt: new Date().toISOString() }, 2)
}

/** Archivos de una corrida: [[nombre, contenido], ...]. */
export function runFiles(run) {
  const base = stem(run)
  return [
    [`${base}_timeseries.csv`, timeseriesCSV(run)],
    [`${base}_poses.csv`, posesCSV(run)],
    [`${base}_meta.json`, metaJSON(run)],
  ]
}

/** Descarga las corridas en un solo .zip (los navegadores bloquean varias descargas desde un clic). */
export async function downloadRuns(runs) {
  const { zipSync, strToU8 } = await import('fflate')
  const entries = {}
  for (const r of runs) for (const [name, text] of runFiles(r)) entries[name] = strToU8(text)
  const m = runs[runs.length - 1].meta
  const zipName = `harvest-viz_${m.nw}_ROW${m.row}_${m.act}_RP${m.rp}_SIM-${m.paramsHash}.zip`
  const url = URL.createObjectURL(new Blob([zipSync(entries, { level: 6 })], { type: 'application/zip' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: zipName })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export { stem as runStem }
