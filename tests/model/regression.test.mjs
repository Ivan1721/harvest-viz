// Regresión contra los resúmenes de MATLAB (public/data/matlab_summary.json).
// Por defecto corre una muestra fija; con FULL=1 corre las 720 configuraciones.
import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { FIS, MATLAB, norm, KNOWN_HR_DEVIATIONS } from '../helpers.mjs'

const FULL = process.env.FULL === '1'
const keys = Object.keys(MATLAB).sort()
// muestra determinista: 1 de cada 12 claves + todas las desviaciones conocidas
const sample = FULL ? keys : keys.filter((k, i) => i % 12 === 0 || (k.startsWith('HR|') && KNOWN_HR_DEVIATIONS.has(k.slice(3))))

for (const key of sample) {
  const [kind, nw, row, act, rp] = key.split('|')
  const cfg = { nw: +nw, row: +row, act, rp: +rp }
  const known = kind === 'HR' && KNOWN_HR_DEVIATIONS.has(`${nw}|${row}|${act}|${rp}`)
  test(`${key}${known ? ' (desviación conocida)' : ''}`, () => {
    const s = norm((kind === 'HO' ? new HOSim(cfg) : new HRSim(cfg, FIS)).run().summary())
    const total = MATLAB[key].TotalRecollectedCrops
    for (const [m, ref] of Object.entries(MATLAB[key])) {
      // desviación conocida: hasta 1,5 % de la métrica + 2 % de la cosecha total (reparto entre bolsas/cajas/robot)
      const tol = known ? 0.015 * Math.max(1, Math.abs(ref)) + 0.02 * total : 1e-3 * Math.max(1, Math.abs(ref))
      assert.ok(Math.abs(s[m] - ref) <= tol, `${m}: simulador ${s[m]} vs MATLAB ${ref}`)
    }
  })
}
