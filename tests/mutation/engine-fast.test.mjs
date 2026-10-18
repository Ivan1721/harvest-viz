// Oráculo rápido para la mutación del motor: sesiones cortas (5 min) comparadas con resultados guardados.
// Cualquier cambio de comportamiento del motor cambia alguna huella y la prueba falla.
// Si el cambio es intencional (sube ENGINE_VERSION): UPDATE_GOLDEN=1 node --test tests/mutation/engine-fast.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { FIS } from '../helpers.mjs'
import { checkInvariants } from '../model/check.mjs'

const FILE = new URL('./golden.json', import.meta.url)
const CASES = [
  { nw: 4, row: 1, act: 'ground', rp: 0 },
  { nw: 6, row: 2, act: 'ladder', rp: 1 },
  { nw: 5, row: 3, act: 'picker', rp: 0 },
  { nw: 8, row: 2, act: 'mixed', rp: 1 },
  { nw: 3, row: 1, act: 'mixed', rp: 0, capacityBoxes: 2, fixRecallLoop: true },
].map((c) => ({ duration: 300, ...c }))

const r6 = (x) => Math.round(x * 1e6) / 1e6
const sum = (a) => r6(a.reduce((s, v) => s + v, 0))
// huella de una corrida: resumen + sumas de series (detecta desvíos en cualquier tick)
function fingerprint(sim, robot) {
  const r = sim.rec,
    s = sim.summary()
  const fp = { summary: Object.fromEntries(Object.entries(s).map(([k, v]) => [k, r6(v)])), work: sum(r.work), delivered: sum(r.delivered) }
  fp.prod = r.prod.map(sum)
  fp.flag = r.flag.map(sum)
  fp.wx = r.wx.map(sum)
  fp.wy = r.wy.map(sum)
  if (robot) Object.assign(fp, { onboard: sum(r.onboard), rx: sum(r.rx), ry: sum(r.ry), rst: sum(r.rst) })
  return fp
}

const runs = () =>
  Object.fromEntries(
    CASES.flatMap((c) => {
      const k = `${c.nw}|${c.row}|${c.act}|${c.rp}${c.fixRecallLoop ? '|fix' : ''}`
      const ho = new HOSim(c).run(),
        hr = new HRSim(c, FIS).run()
      checkInvariants(ho, { robot: false })
      checkInvariants(hr, { robot: true })
      return [
        [`HO|${k}`, fingerprint(ho, false)],
        [`HR|${k}`, fingerprint(hr, true)],
      ]
    }),
  )

if (process.env.UPDATE_GOLDEN === '1') {
  fs.writeFileSync(FILE, JSON.stringify(runs(), null, 1) + '\n')
  console.log('golden.json actualizado')
}
const golden = JSON.parse(fs.readFileSync(FILE, 'utf8'))

test('motor: sesiones cortas idénticas a la huella guardada (oráculo de mutación)', () => {
  const now = runs()
  for (const [k, fp] of Object.entries(golden)) assert.deepEqual(now[k], fp, k)
})
