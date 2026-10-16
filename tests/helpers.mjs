import fs from 'node:fs'
export const FIS = fs.readFileSync(new URL('../src/hrsim/goal_seeking.fis', import.meta.url), 'utf8')
export const MATLAB = JSON.parse(fs.readFileSync(new URL('../public/data/matlab_summary.json', import.meta.url), 'utf8'))
export const norm = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/_crop_units|_kcal/, ''), v]))
// Configuraciones HR que difieren de MATLAB por un desfase de 1 tick en un traspaso poco frecuente (ver docs/simulador.md).
export const KNOWN_HR_DEVIATIONS = new Set([
  '6|3|mixed|0',
  '10|3|picker|1',
  '24|1|picker|0',
  '24|1|picker|1',
  '7|3|mixed|0',
  '14|2|ladder|1',
  '5|2|ground|0',
  '9|2|ground|0',
])
