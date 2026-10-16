// Reúne los CSV resumen de MATLAB (HR y HO: principal, extended, scaling) en public/data/matlab_summary.json
import fs from 'fs'
const dir = process.argv[2]
const M = ['TimeWeightedAverageMetabolicRate_kcal', 'AverageHumanProduction_crop_units', 'TotalHumanWorkload_kcal', 'TotalProductionCargoZone_crop_units', 'RemainingCropsHumanBags_crop_units', 'RemainingCropsBoxes_crop_units', 'RemainingCropsRobot_crop_units', 'TotalRecollectedCrops_crop_units']
const out = {}
for (const [kind, sub, pre] of [['HR', 'simulation_outputs_human_robot', 'human_robot'], ['HO', 'simulation_outputs_human_only', 'human_only']])
  for (const suf of ['results', 'results_extended', 'scaling']) {
    const f = `${dir}/${sub}/${pre}_${suf}.csv`
    if (!fs.existsSync(f)) continue
    const L = fs.readFileSync(f, 'utf8').trim().split(/\r?\n/), H = L[0].split(',')
    const ix = (n) => H.indexOf(n)
    if ([ 'Humans', 'ROW_N', 'LayoutPos', 'MainActivity', ...M].some((n) => ix(n) < 0)) { console.log('omitido', f); continue }
    for (const l of L.slice(1)) {
      const r = l.split(',')
      const key = `${kind}|${r[ix('Humans')]}|${r[ix('ROW_N')]}|${r[ix('MainActivity')].replace('harv_', '')}|${r[ix('LayoutPos')]}`
      out[key] = Object.fromEntries(M.map((m) => [m.replace(/_crop_units|_kcal/, ''), +(+r[ix(m)]).toFixed(4)]))
    }
  }
fs.writeFileSync('public/data/matlab_summary.json', JSON.stringify(out))
console.log(Object.keys(out).length, 'configuraciones')
