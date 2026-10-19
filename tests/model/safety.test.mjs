// Fase 3: regla de seguridad SSM del perfil hri (velocidad y separación, ISO/TS 15066).
import test from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { HRSim } from '../../src/hrsim/engine.js'
import { resolveParams, profileDefaults } from '../../src/hrsim/common.js'
import { protectionDistance, SSM_DEFAULTS } from '../../src/hrsim/ssm.js'
import { FIS } from '../helpers.mjs'

const RUNS = Number(process.env.PBT_RUNS || 12)
const SEED = Number(process.env.PBT_SEED) || 20261019
const ATTENDING = new Set([10, 11, 12])

// verifica la invariante en todos los ticks: devuelve el número de ticks en movimiento revisados
function checkInvariant(sim) {
  const r = sim.rec,
    dt = sim.dt,
    s = sim.p.ssm
  let moving = 0
  for (let i = 1; i < r.t.length; i++) {
    const v = Math.hypot(r.rx[i] - r.rx[i - 1], r.ry[i] - r.ry[i - 1]) / dt
    if (v < 1e-9) continue
    moving++
    assert.ok(r.rst[i] === 0 || r.rst[i] === 4, `tick ${i}: se mueve con rst=${r.rst[i]}`)
    if (r.rst[i] === 4) assert.ok(v <= s.vSlow + 1e-9, `tick ${i}: velocidad reducida ${v} > ${s.vSlow}`)
    const dx = r.rx[i] - r.rx[i - 1],
      dy = r.ry[i] - r.ry[i - 1]
    for (let h = 0; h < sim.NH; h++) {
      if (ATTENDING.has(r.wst[h][i])) continue
      // velocidad de acercamiento a este trabajador (componente hacia él, desde la pose antes de moverse)
      const ux = r.wx[h][i] - r.rx[i - 1],
        uy = r.wy[h][i] - r.ry[i - 1],
        du = Math.hypot(ux, uy)
      const vc = Math.max(0, (dx * ux + dy * uy) / du / dt)
      const d = Math.hypot(r.wx[h][i] - r.rx[i], r.wy[h][i] - r.ry[i])
      const sp = protectionDistance(vc, s)
      assert.ok(d >= sp - 1e-9, `tick ${i}: H${h + 1} a ${d.toFixed(3)} m < S_p(${vc.toFixed(2)}) = ${sp.toFixed(3)} m`)
    }
  }
  return moving
}

test('parámetros: hri trae la regla encendida con los valores de la especificación; se validan', () => {
  const p = resolveParams({ profile: 'hri' })
  assert.deepEqual(p.ssm, { ...SSM_DEFAULTS, enabled: true })
  assert.deepEqual(profileDefaults('hri').ssm, p.ssm, 'el formulario muestra los mismos valores')
  assert.equal(resolveParams({ profile: 'hri', ssm: { a: 1 } }).ssm.a, 1, 'una opción parcial se combina con el perfil')
  assert.throws(() => resolveParams({ profile: 'hri', ssm: { a: 0 } }), /ssm\.a/)
  assert.throws(() => resolveParams({ profile: 'hri', ssm: { warn: -1 } }), /ssm\.warn/)
})

test('réplica 12 trabajadores, fila 3, mixta: nadie (salvo quien viene a cargar) queda dentro de S_p(v) con el robot en movimiento', () => {
  const s = new HRSim({ nw: 12, row: 3, act: 'mixed', rp: 0, duration: 2700, profile: 'hri' }, FIS).run()
  assert.ok(checkInvariant(s) > 1000)
  const sm = s.summary()
  assert.ok(sm.safetyStops > 0, 'la regla actúa')
  assert.ok(sm.TotalProductionCargoZone_crop_units > 0, 'el robot sigue entregando (no queda bloqueado)')
  // cada parada dura al menos t_reanudar antes de volver a moverse
  const st = s.rec.rst,
    minTicks = Math.round(s.p.ssm.tResume / s.dt)
  for (let i = 0; i < st.length; i++)
    if (st[i] === 3) {
      let j = i
      while (j + 1 < st.length && st[j + 1] === 3) j++
      if (j + 1 < st.length && (st[j + 1] === 0 || st[j + 1] === 4)) assert.ok(j - i + 1 >= minTicks, `parada de ${j - i + 1} ticks en ${i}`)
      i = j
    }
})

test(`property-based: la invariante de seguridad se cumple con parámetros al azar (${RUNS} casos)`, () => {
  fc.assert(
    fc.property(
      fc.record({
        nw: fc.integer({ min: 1, max: 16 }),
        row: fc.constantFrom(1, 2, 3),
        act: fc.constantFrom('ground', 'ladder', 'picker', 'mixed'),
        rp: fc.constantFrom(0, 1),
        a: fc.double({ min: 0.5, max: 3, noNaN: true }),
        vh: fc.double({ min: 0.5, max: 2, noNaN: true }),
        warn: fc.double({ min: 0, max: 2, noNaN: true }),
        vSlow: fc.double({ min: 0.1, max: 0.8, noNaN: true }),
        tResume: fc.constantFrom(0, 0.5, 1, 2),
      }),
      ({ nw, row, act, rp, ...ssm }) => {
        const s = new HRSim({ nw, row, act, rp, duration: 600, profile: 'hri', ssm }, FIS).run()
        checkInvariant(s)
      },
    ),
    { numRuns: RUNS, seed: SEED },
  )
})
