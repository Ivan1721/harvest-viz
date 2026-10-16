// Corre todas las configuraciones de los resúmenes de MATLAB, compara métricas y mide tiempo/recursos.
// uso: node scripts/bench_compare.mjs <carpeta NuevaVersion> [salida.json]
import fs from 'fs'
import { HRSim } from '../src/hrsim/engine.js'
import { HOSim } from '../src/hrsim/humanonly.js'
const fis = fs.readFileSync(new URL('../src/hrsim/goal_seeking.fis', import.meta.url), 'utf8')
const dir = process.argv[2], outF = process.argv[3] || 'bench.json'
const M = ['TimeWeightedAverageMetabolicRate_kcal', 'AverageHumanProduction_crop_units', 'TotalHumanWorkload_kcal', 'TotalProductionCargoZone_crop_units', 'RemainingCropsHumanBags_crop_units', 'RemainingCropsBoxes_crop_units', 'RemainingCropsRobot_crop_units', 'TotalRecollectedCrops_crop_units']
const res = []
const cpu0 = process.cpuUsage(), wall0 = performance.now()
let peakRss = 0
for (const [kind, sub, pre] of [['HO', 'simulation_outputs_human_only', 'human_only'], ['HR', 'simulation_outputs_human_robot', 'human_robot']])
  for (const suf of ['results', 'results_extended', 'scaling']) {
    const f = `${dir}/${sub}/${pre}_${suf}.csv`
    const L = fs.readFileSync(f, 'utf8').trim().split(/\r?\n/), H = L[0].split(',')
    for (const l of L.slice(1)) {
      const r = l.split(','), g = (n) => r[H.indexOf(n)]
      const cfg = { nw: +g('Humans'), row: +g('ROW_N'), rp: +g('LayoutPos'), act: g('MainActivity').replace('harv_', '') }
      const t0 = performance.now()
      const sim = (kind === 'HO' ? new HOSim(cfg) : new HRSim(cfg, fis)).run()
      const ms = performance.now() - t0
      const s = sim.summary()
      const err = {}
      for (const m of M) err[m] = s[m] - +g(m)
      peakRss = Math.max(peakRss, process.memoryUsage().rss)
      res.push({ kind, file: suf, ...cfg, ms, ticks: sim.rec.t.length, err, matlab: Object.fromEntries(M.map((m) => [m, +g(m)])), js: Object.fromEntries(M.map((m) => [m, s[m]])) })
    }
  }
const cpu = process.cpuUsage(cpu0), wall = performance.now() - wall0
const mu = process.memoryUsage()
fs.writeFileSync(outF, JSON.stringify({ res, wall, cpu, peakRss, heapUsed: mu.heapUsed }))
console.log(`configs ${res.length}  wall ${(wall / 1000).toFixed(1)} s  cpu user ${(cpu.user / 1e6).toFixed(1)} s  peakRSS ${(peakRss / 1048576).toFixed(0)} MB  heap ${(mu.heapUsed / 1048576).toFixed(0)} MB`)
