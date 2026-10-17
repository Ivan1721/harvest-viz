// Invariantes en un barrido de configuraciones representativas y con parámetros generados al azar (property-based).
import test from 'node:test'
import fc from 'fast-check'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { FIS } from '../helpers.mjs'
import { checkInvariants } from './check.mjs'

const ACTS = ['ground', 'ladder', 'picker', 'mixed']

for (const act of ACTS)
  for (const row of [1, 3])
    test(`invariantes · ${act} · fila ${row} · 1, 7 y 18 trabajadores`, () => {
      for (const nw of [1, 7, 18]) {
        const cfg = { nw, row, act, rp: nw % 2, duration: 900 }
        checkInvariants(new HOSim(cfg).run(), { robot: false })
        checkInvariants(new HRSim(cfg, FIS).run(), { robot: true })
      }
    })

const RUNS = Number(process.env.PBT_RUNS || 30)
const cfgArb = fc.record({
  nw: fc.integer({ min: 1, max: 24 }),
  row: fc.constantFrom(1, 2, 3),
  act: fc.constantFrom(...ACTS),
  rp: fc.constantFrom(0, 1),
  // corridas cortas (bordes) y de 5–15 min, donde el robot alcanza a llenarse, descargar y recibir cajas
  duration: fc.oneof(fc.integer({ min: 30, max: 120 }), fc.integer({ min: 300, max: 900 })),
  walkSpeed: fc.double({ min: 0.2, max: 2, noNaN: true }),
  ladderTime: fc.double({ min: 0.5, max: 15, noNaN: true }),
  maxProd: fc.integer({ min: 3, max: 30 }),
  loadTimePerBox: fc.double({ min: 0.25, max: 10, noNaN: true }),
  unloadTimePerBox: fc.double({ min: 0, max: 5, noNaN: true }),
  capacityBoxes: fc.integer({ min: 1, max: 100 }),
  maxBoxStopsPerLap: fc.integer({ min: 1, max: 20 }),
  waypointTimeout: fc.double({ min: 5, max: 120, noNaN: true }),
  detectorRange: fc.double({ min: 0.5, max: 8, noNaN: true }),
  metabolicMultiplier: fc.double({ min: 0.5, max: 2, noNaN: true }),
})

test(`property-based: Solo humano cumple las invariantes con parámetros al azar (${RUNS} casos)`, () => {
  fc.assert(
    fc.property(cfgArb, (cfg) => checkInvariants(new HOSim(cfg).run(), { robot: false })),
    { numRuns: RUNS, seed: Number(process.env.PBT_SEED) || 20261016 },
  )
})

test(`property-based: Humano-robot cumple las invariantes con parámetros al azar (${RUNS} casos)`, () => {
  fc.assert(
    fc.property(cfgArb, (cfg) => checkInvariants(new HRSim(cfg, FIS).run(), { robot: true })),
    { numRuns: RUNS, seed: Number(process.env.PBT_SEED) || 20261016 },
  )
})
