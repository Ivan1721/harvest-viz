import fs from 'node:fs'
export const FIS = fs.readFileSync(new URL('../src/hrsim/goal_seeking.fis', import.meta.url), 'utf8')
export const MATLAB = JSON.parse(fs.readFileSync(new URL('../public/data/matlab_summary.json', import.meta.url), 'utf8'))
export const norm = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.replace(/_crop_units|_kcal/, ''), v]))
// Configuraciones HR que difieren de MATLAB más que la tolerancia normal (1e-3 relativo) por el empate de
// punto flotante en movePose (ver docs/simulador.md). Para cada una, la diferencia absoluta máxima admitida por
// métrica, fijada al valor observado: si el motor cambia y la diferencia crece, la prueba falla.
export const KNOWN_HR_DEVIATIONS = new Map([
  [
    '7|3|mixed|0',
    {
      TimeWeightedAverageMetabolicRate: 0.01,
      AverageHumanProduction: 1,
      TotalHumanWorkload: 0.5,
      TotalProductionCargoZone: 30,
      RemainingCropsHumanBags: 5,
      RemainingCropsBoxes: 30,
      RemainingCropsRobot: 60,
      TotalRecollectedCrops: 5,
    },
  ],
  ['24|1|picker|0', { AverageHumanProduction: 0.2, TotalHumanWorkload: 0.35, RemainingCropsHumanBags: 4, TotalRecollectedCrops: 4 }],
  ['24|1|picker|1', { AverageHumanProduction: 0.2, TotalHumanWorkload: 0.35, RemainingCropsHumanBags: 4, TotalRecollectedCrops: 4 }],
])
