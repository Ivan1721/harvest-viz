// Análisis de sensibilidad local (uno a la vez, ±20 %) del simulador alrededor de una configuración base.
// Reporta la elasticidad de cada salida: (Δy / y) / (Δx / x), promediando la subida y la bajada.
// uso: npm run sensitivity [-- --nw 12 --row 3 --act mixed --rp 0 --delta 0.2 --out docs/sensibilidad.md]
import fs from 'node:fs'
import { HRSim } from '../src/hrsim/engine.js'
import { HOSim } from '../src/hrsim/humanonly.js'
import { DEFAULTS, ENGINE_VERSION } from '../src/hrsim/common.js'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 ? process.argv[i + 1] : d
}
const FIS = fs.readFileSync(new URL('../src/hrsim/goal_seeking.fis', import.meta.url), 'utf8')
const cfg = { nw: +arg('nw', 12), row: +arg('row', 3), act: arg('act', 'mixed'), rp: +arg('rp', 0) }
const delta = +arg('delta', 0.2)
const out = arg('out', null)

// [clave, etiqueta, getter/setter sobre los parámetros]
const P = [
  ['walkSpeed', 'Velocidad de caminata'],
  ['ladderTime', 'Tiempo de escalera'],
  ['loadTimePerBox', 'Carga al robot por caja'],
  ['unloadTimePerBox', 'Descarga del robot por caja'],
  ['capacityBoxes', 'Capacidad del robot'],
  ['maxProd', 'Unidades por caja'],
  ['maxBoxStopsPerLap', 'Paradas máx. por vuelta'],
  ['waypointTimeout', 'Tiempo máx. en waypoint'],
  ['detectorRange', 'Alcance del detector'],
  ['prodPeriod', 'Periodo de cosecha (todas las actividades)'],
  ['costs.walking', 'Costo: caminar'],
  ['costs.walkingCarrying', 'Costo: caminar con caja'],
  ['costs.harvestGround', 'Costo: cosechar suelo'],
  ['costs.harvestLadder', 'Costo: cosechar escalera'],
  ['costs.harvestPicker', 'Costo: cosechar gancho'],
  ['costs.ladderClimb', 'Costo: subir escalera'],
  ['costs.ladderDown', 'Costo: bajar escalera'],
]
const INT = new Set(['capacityBoxes', 'maxProd', 'maxBoxStopsPerLap'])
function scaled(key, f) {
  const p = JSON.parse(JSON.stringify(DEFAULTS))
  if (key === 'prodPeriod') for (const k of Object.keys(p.prodPeriod)) p.prodPeriod[k] = Math.round(p.prodPeriod[k] * f * 4) / 4
  else if (key.startsWith('costs.')) p.costs[key.slice(6)] *= f
  else p[key] = INT.has(key) ? Math.max(1, Math.round(p[key] * f)) : p[key] * f
  return p
}
const realF = (key, p) => {
  const b = key === 'prodPeriod' ? DEFAULTS.prodPeriod[1] : key.startsWith('costs.') ? DEFAULTS.costs[key.slice(6)] : DEFAULTS[key]
  const v = key === 'prodPeriod' ? p.prodPeriod[1] : key.startsWith('costs.') ? p.costs[key.slice(6)] : p[key]
  return v / b - 1
}
const Y = [
  ['delivered', 'Entregado', (s) => s.TotalProductionCargoZone_crop_units],
  ['work', 'Carga total', (s) => s.TotalHumanWorkload_kcal],
  ['kcalPerUnit', 'kcal por unidad entregada', (s) => s.TotalHumanWorkload_kcal / Math.max(1, s.TotalProductionCargoZone_crop_units)],
]
const runs = { HO: (p) => new HOSim({ ...p, ...cfg }).run().summary(), HR: (p) => new HRSim({ ...p, ...cfg }, FIS).run().summary() }
const lines = []
const t0 = performance.now()
for (const [kind, run] of Object.entries(runs)) {
  const base = run(DEFAULTS)
  const rows = []
  for (const [key, label] of P) {
    if (kind === 'HO' && ['loadTimePerBox', 'unloadTimePerBox', 'capacityBoxes', 'maxBoxStopsPerLap', 'waypointTimeout', 'detectorRange'].includes(key))
      continue
    const el = Y.map(([, , g]) => {
      const e = []
      for (const f of [1 + delta, 1 - delta]) {
        const p = scaled(key, f),
          dx = realF(key, p)
        if (Math.abs(dx) < 1e-9) continue
        e.push((g(run(p)) / g(base) - 1) / dx)
      }
      return e.length ? e.reduce((a, b) => a + b, 0) / e.length : 0
    })
    rows.push([label, ...el])
  }
  rows.sort((a, b) => Math.abs(b[1]) + Math.abs(b[3]) - (Math.abs(a[1]) + Math.abs(a[3])))
  lines.push(`\n### ${kind === 'HO' ? 'Solo humano' : 'Humano-robot'}\n`)
  lines.push(`Base: entregado ${Y[0][2](base).toFixed(0)} u, carga ${Y[1][2](base).toFixed(1)} kcal, ${Y[2][2](base).toFixed(3)} kcal/u.\n`)
  lines.push(`| Parámetro | ${Y.map(([, l]) => `Elasticidad: ${l}`).join(' | ')} |`)
  lines.push(`|---|${Y.map(() => '---:').join('|')}|`)
  for (const [l, ...e] of rows) lines.push(`| ${l} | ${e.map((v) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2))).join(' | ')} |`)
}
const head = `# Sensibilidad del simulador (uno a la vez, ±${delta * 100} %)\n\nConfiguración: ${cfg.nw} trabajadores, fila ${cfg.row}, ${cfg.act}, RP${cfg.rp}, 45 min. Motor ${ENGINE_VERSION}. Generado con \`npm run sensitivity\` (${((performance.now() - t0) / 1000).toFixed(0)} s).\n\nElasticidad = cambio relativo de la salida / cambio relativo del parámetro (1 = proporcional; 0 = no influye; negativo = efecto inverso). Ordenado por influencia sobre lo entregado y la eficiencia (kcal/u). Los parámetros enteros (capacidad, unidades por caja, paradas) se redondean, así que su cambio real puede diferir de ±${delta * 100} %.\n`
const md = head + lines.join('\n') + '\n'
if (out) {
  fs.writeFileSync(out, md)
  console.log(`escrito ${out}`)
} else console.log(md)
