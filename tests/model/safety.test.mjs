// Fase 3: regla de seguridad SSM del perfil hri (velocidad y separación, ISO/TS 15066).
import test from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { HRSim } from '../../src/hrsim/engine.js'
import { resolveParams, profileDefaults } from '../../src/hrsim/common.js'
import { protectionDistance, SSM_DEFAULTS } from '../../src/hrsim/ssm.js'
import { SISTEMAS } from '../../src/hrsim/huertos/index.js'
import { ROBOTS } from '../../src/hrsim/robots.js'
import { FIS } from '../helpers.mjs'

const RUNS = Number(process.env.PBT_RUNS || 12)
const SEED = Number(process.env.PBT_SEED) || 20261019
const ATTENDING = new Set([10, 11, 12])
const GENERADOS = Object.keys(SISTEMAS).filter((k) => k !== 'matlab-2026')

// verifica la invariante en todos los ticks: devuelve el número de ticks en movimiento revisados
function checkInvariant(sim, rx = sim.rec.rx, ry = sim.rec.ry, rst = sim.rec.rst) {
  const r = sim.rec,
    dt = sim.dt,
    s = sim.p.ssm
  let moving = 0
  for (let i = 1; i < r.t.length; i++) {
    const v = Math.hypot(rx[i] - rx[i - 1], ry[i] - ry[i - 1]) / dt
    if (v < 1e-9) continue
    moving++
    assert.ok(rst[i] === 0 || rst[i] === 4, `tick ${i}: se mueve con rst=${rst[i]}`)
    if (rst[i] === 4) assert.ok(v <= s.vSlow + 1e-9, `tick ${i}: velocidad reducida ${v} > ${s.vSlow}`)
    const dx = rx[i] - rx[i - 1],
      dy = ry[i] - ry[i - 1]
    for (let h = 0; h < sim.NH; h++) {
      if (ATTENDING.has(r.wst[h][i])) continue
      // velocidad de acercamiento a este trabajador (componente hacia él, desde la pose antes de moverse)
      const ux = r.wx[h][i] - rx[i - 1],
        uy = r.wy[h][i] - ry[i - 1],
        du = Math.hypot(ux, uy)
      const vc = Math.max(0, (dx * ux + dy * uy) / du / dt)
      const d = Math.hypot(r.wx[h][i] - rx[i], r.wy[h][i] - ry[i])
      const sp = protectionDistance(vc, s)
      assert.ok(d >= sp - 1e-9, `tick ${i}: H${h + 1} a ${d.toFixed(3)} m < S_p(${vc.toFixed(2)}) = ${sp.toFixed(3)} m`)
    }
  }
  return moving
}

// los mismos parámetros de seguridad al azar en todas las pruebas property-based
const SSM_AL_AZAR = {
  a: fc.double({ min: 0.5, max: 3, noNaN: true }),
  vh: fc.double({ min: 0.5, max: 2, noNaN: true }),
  warn: fc.double({ min: 0, max: 2, noNaN: true }),
  vSlow: fc.double({ min: 0.1, max: 0.8, noNaN: true }),
  tResume: fc.constantFrom(0, 0.5, 1, 2),
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

// el caso que encontró el job semanal (semilla 41477858183): el robot avanza pegado al borde superior del mapa, el
// recorte cambia la dirección de su avance y la velocidad de acercamiento real sale mayor que la comandada
test('borde del mapa: la regla mide el avance recortado, no el comandado', () => {
  const ssm = { a: 0.5, vh: 1.3528882746323927, warn: 0, vSlow: 0.36854258748555024, tResume: 0 }
  const s = new HRSim({ nw: 3, row: 3, act: 'picker', rp: 1, duration: 600, profile: 'hri', ssm }, FIS).run()
  const techo = s.huerto.limites.h - 0.05
  assert.ok(
    s.rec.ry.some((y, i) => i > 0 && y >= techo - 1e-9 && s.rec.rx[i] !== s.rec.rx[i - 1]),
    'el robot llega a moverse pegado al borde',
  )
  assert.ok(checkInvariant(s) > 0)
})

// con flota se ve más: este robot recorre la cabecera, pegado al borde inferior del mapa
test('borde del mapa, con flota: ningún robot se acerca más de lo que midió la regla', () => {
  const ssm = { a: 0.5595225347205997, vh: 1.9023654429474846, warn: 1.5906988279893994, vSlow: 0.25357825027313086, tResume: 2 }
  const flota = { n: 3, estrategia: 'desfase' }
  const s = new HRSim({ huerto: 'arandano', robotTipo: 'warthog', nw: 11, act: 'ground', duration: 300, profile: 'hri', ssm, flota }, FIS).run()
  for (let i = 0; i < flota.n; i++) checkInvariant(s, s.rec.fx[i], s.rec.fy[i], s.rec.fst[i])
})

test(`property-based: la invariante de seguridad se cumple con parámetros al azar (${RUNS} casos)`, () => {
  fc.assert(
    fc.property(
      fc.record({
        nw: fc.integer({ min: 1, max: 16 }),
        row: fc.constantFrom(1, 2, 3),
        act: fc.constantFrom('ground', 'ladder', 'picker', 'mixed'),
        rp: fc.constantFrom(0, 1),
        ...SSM_AL_AZAR,
      }),
      ({ nw, row, act, rp, ...ssm }) => {
        const s = new HRSim({ nw, row, act, rp, duration: 600, profile: 'hri', ssm }, FIS).run()
        checkInvariant(s)
      },
    ),
    { numRuns: RUNS, seed: SEED },
  )
})

test(`property-based: la invariante también en los huertos generados (${RUNS} casos)`, () => {
  fc.assert(
    fc.property(
      fc.record({
        huerto: fc.constantFrom(...GENERADOS),
        robot: fc.constantFrom(...Object.keys(ROBOTS)),
        nw: fc.integer({ min: 1, max: 24 }),
        act: fc.constantFrom('ground', 'mixed'),
        ...SSM_AL_AZAR,
      }),
      ({ huerto, robot, nw, act, ...ssm }) => {
        const s = new HRSim({ huerto, robotTipo: robot, nw, act, duration: 600, profile: 'hri', ssm }, FIS).run()
        checkInvariant(s)
      },
    ),
    { numRuns: RUNS, seed: SEED },
  )
})

test(`property-based: la invariante en cada robot de una flota (${RUNS} casos)`, () => {
  fc.assert(
    fc.property(
      fc.record({
        huerto: fc.constantFrom(...GENERADOS),
        robot: fc.constantFrom(...Object.keys(ROBOTS)),
        n: fc.constantFrom(2, 3),
        estrategia: fc.constantFrom('zonas', 'opuestas', 'desfase'),
        nw: fc.integer({ min: 1, max: 24 }),
        act: fc.constantFrom('ground', 'mixed'),
        ...SSM_AL_AZAR,
      }),
      ({ huerto, robot, n, estrategia, nw, act, ...ssm }) => {
        const s = new HRSim({ huerto, robotTipo: robot, nw, act, duration: 300, profile: 'hri', ssm, flota: { n, estrategia } }, FIS).run()
        for (let i = 0; i < n; i++) checkInvariant(s, s.rec.fx[i], s.rec.fy[i], s.rec.fst[i])
      },
    ),
    { numRuns: RUNS, seed: SEED },
  )
})
