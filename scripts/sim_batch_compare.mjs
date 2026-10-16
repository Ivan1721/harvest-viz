// Corre el simulador JS para cada configuración de un CSV resumen de MATLAB y compara las métricas finales.
// uso: node scripts/sim_batch_compare.mjs <resumen.csv> [duración_s=2700] [límite]
import fs from 'fs'
import { HRSim } from '../src/hrsim/engine.js'
import { HOSim } from '../src/hrsim/humanonly.js'
const fis = fs.readFileSync(new URL('../src/hrsim/goal_seeking.fis', import.meta.url), 'utf8')
const [file, dur = '2700', lim = '1000'] = process.argv.slice(2)
const HO = /human_only/i.test(file)
const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/)
const head = lines[0].split(','), rows = lines.slice(1).map((l) => l.split(','))
const g = (r, n) => r[head.indexOf(n)]
const M = ['TimeWeightedAverageMetabolicRate_kcal', 'AverageHumanProduction_crop_units', 'TotalHumanWorkload_kcal', 'TotalProductionCargoZone_crop_units', 'RemainingCropsHumanBags_crop_units', 'RemainingCropsBoxes_crop_units', 'RemainingCropsRobot_crop_units', 'TotalRecollectedCrops_crop_units']
const worst = Object.fromEntries(M.map((m) => [m, 0])); let exact = 0, n = 0; const bad = []
for (const r of rows.slice(0, +lim)) {
  const act = g(r, 'MainActivity').replace('harv_', '')
  const cfg = { nw: +g(r, 'Humans'), row: +g(r, 'ROW_N'), rp: +g(r, 'LayoutPos'), act, duration: +dur }
  const s = (HO ? new HOSim(cfg) : new HRSim(cfg, fis)).run().summary()
  let ok = true
  for (const m of M) { const d = Math.abs(s[m] - +g(r, m)); const rel = d / Math.max(1, Math.abs(+g(r, m))); worst[m] = Math.max(worst[m], rel); if (rel > 1e-6) ok = false }
  n++; if (ok) exact++; else bad.push(`${cfg.nw}-${cfg.row}-${act}-rp${cfg.rp}: entregado MATLAB ${g(r, 'TotalProductionCargoZone_crop_units')} JS ${s.TotalProductionCargoZone_crop_units}`)
}
console.log(`configuraciones ${n}  idénticas (rel<1e-6) ${exact}`)
console.log('peor error relativo por métrica:', Object.fromEntries(Object.entries(worst).map(([k, v]) => [k.replace(/_crop_units|_kcal/, ''), v.toExponential(2)])))
if (bad.length) console.log('discrepancias:\n' + bad.slice(0, 15).join('\n'))
