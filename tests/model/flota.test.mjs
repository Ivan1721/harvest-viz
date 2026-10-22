// H8, fase A: flota de 2 o 3 robots (zonas, direcciones opuestas y desfase) con sus reglas de convivencia.
import test from 'node:test'
import assert from 'node:assert/strict'
import fc from 'fast-check'
import { HRSim } from '../../src/hrsim/engine.js'
import { resolveParams, paramsHash } from '../../src/hrsim/common.js'
import { repartirZonas, invertir, estacionamiento, jain, FLOTA_ESTRATEGIAS } from '../../src/hrsim/flota.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { FIS } from '../helpers.mjs'
import { checkInvariants } from './check.mjs'

const AD = 'palta-alta-densidad'
const RUNS = Number(process.env.PBT_RUNS) || 8

/**
 * Corre la simulación tick a tick y verifica en cada uno las reglas de convivencia: ningún robot dentro de una calle sin
 * haberla reservado, nunca dos con la misma calle y cada caja con a lo más un robot asignado.
 */
function correr(opts) {
  const s = new HRSim(opts, FIS)
  while (s.step()) {
    const dentro = s.R.filter((r) => s._calleDe(r.rpose) != null).map((r) => r.carril)
    if (dentro.some((c) => c == null)) assert.fail(`robot dentro de una calle sin reservarla en t=${s.idx * s.dt}`)
    if (new Set(dentro).size < dentro.length) assert.fail(`dos robots en la misma calle en t=${s.idx * s.dt}`)
    for (let h = 0; h < s.NH; h++) if (s.R.filter((r) => r.boxInserted[h]).length > 1) assert.fail(`la caja de H${h + 1} con dos robots en t=${s.idx * s.dt}`)
  }
  return s
}

test('parámetros: sin flota no hay clave nueva; con 1 robot o en el mapa de MATLAB, tampoco; validación', () => {
  const p = resolveParams({ huerto: AD })
  assert.equal('flota' in p, false)
  assert.equal(paramsHash(resolveParams({ huerto: AD, flota: { n: 1, estrategia: 'opuestas' } })), paramsHash(p))
  assert.equal('flota' in resolveParams({ flota: { n: 2 } }), false, 'matlab-2026 no tiene flota')
  assert.equal('flota' in resolveParams({ huerto: AD, robot: false, flota: { n: 2 } }), false, 'sin robot no hay flota')
  assert.deepEqual(resolveParams({ huerto: AD, flota: { n: 2 } }).flota, { estrategia: 'zonas', ceder: 2, reserva: 3, esperaAcopio: 3, n: 2 })
  assert.throws(() => resolveParams({ huerto: AD, flota: { n: 4 } }), /flota.n/)
  assert.throws(() => resolveParams({ huerto: AD, flota: { n: 2.5 } }), /flota.n/)
  assert.throws(() => resolveParams({ huerto: AD, flota: { n: 2, estrategia: 'otra' } }), /flota.estrategia/)
  assert.throws(() => resolveParams({ huerto: AD, flota: { n: 2, ceder: 0 } }), /flota.ceder/)
})

test('zonas: grupos contiguos que cubren todas las calles, con peso parejo; con menos calles que robots, sobran', () => {
  const ejes = [2, 6, 10, 14, 18, 22]
  const g = repartirZonas(ejes, () => 1, 2)
  assert.deepEqual(g, [
    [2, 6, 10],
    [14, 18, 22],
  ])
  // el peso manda: una calle muy cargada queda sola
  assert.deepEqual(
    repartirZonas(ejes, (e) => (e === 2 ? 10 : 1), 2),
    [[2], [6, 10, 14, 18, 22]],
  )
  const g3 = repartirZonas(ejes, () => 1, 3)
  assert.deepEqual(g3.flat(), ejes, 'contiguas y sin calles repetidas')
  assert.ok(g3.every((x) => x.length === 2))
  assert.deepEqual(
    repartirZonas([2], () => 1, 3),
    [[2], [], []],
  )
  assert.deepEqual(
    repartirZonas([], () => 1, 2),
    [[], []],
  )
})

test('direcciones opuestas: la misma vuelta al revés, de acopio a acopio; jain', () => {
  const lap = [
    [0, 0],
    [1, 0],
    [1, 5],
    [2, 5],
    [0, 0],
  ]
  assert.deepEqual(invertir(lap), [
    [0, 0],
    [2, 5],
    [1, 5],
    [1, 0],
    [0, 0],
  ])
  assert.equal(jain([3, 3, 3]), 1)
  assert.ok(Math.abs(jain([1, 0]) - 0.5) < 1e-12)
})

for (const estrategia of FLOTA_ESTRATEGIAS)
  for (const [huerto, n] of [
    [AD, 2],
    [AD, 3],
    ['palta-tradicional', 3],
  ])
    test(`convivencia · ${estrategia} · ${n} robots · ${huerto}: invariantes, una calle y una caja por robot, nadie se bloquea`, () => {
      const s = correr({ nw: 12, huerto, duration: 3600, flota: { n, estrategia } })
      checkInvariants(s, { robot: true })
      const f = s.summary().flota
      assert.equal(f.robots.length, n)
      // ningún robot queda bloqueado: todos atienden cajas (o esperan estacionados sin zona)
      for (const [i, q] of f.robots.entries()) assert.ok(q.cajas > 0 || q.estacionado_s > 0, `RB-0${i + 1} sin cajas ni espera`)
      assert.equal(
        f.robots.reduce((a, q) => a + q.entregado, 0),
        s.summary().TotalProductionCargoZone_crop_units,
        'lo entregado por cada robot suma lo del acopio',
      )
      // con un robot dentro de una calle, ningún otro a menos de 1 m (en la cabecera y el acopio se adelantan: modelo de punto)
      if (f.distMinCalle_m != null) assert.ok(f.distMinCalle_m >= 1, `distancia mínima con uno en la calle: ${f.distMinCalle_m}`)
    })

test('zonas: al empezar, las calles de cada robot no se repiten y van de izquierda a derecha', () => {
  const s = new HRSim({ nw: 24, huerto: AD, duration: 60, flota: { n: 3, estrategia: 'zonas' } }, FIS)
  const z = s.R.map((r) => r.rutaEjes)
  assert.ok(z.every((x) => x.length > 0))
  assert.deepEqual(
    z.flat(),
    [...z.flat()].sort((a, b) => a - b),
    'contiguas y ordenadas',
  )
  assert.equal(new Set(z.flat()).size, z.flat().length)
})

test('un solo cosechero con dos robots en zonas: el segundo espera estacionado y se entrega lo mismo que con uno', () => {
  for (const huerto of [AD, 'palta-tradicional', 'cerezo-ufo']) {
    const a = new HRSim({ nw: 1, huerto, duration: 2700 }, FIS).run()
    const b = new HRSim({ nw: 1, huerto, duration: 2700, flota: { n: 2, estrategia: 'zonas' } }, FIS).run()
    // la trayectoria del primero difiere solo en el regreso por la última calle (densificar en flota.js)
    assert.equal(b.rec.delivered.at(-1), a.rec.delivered.at(-1), huerto)
    const r2 = b.summary().flota.robots[1]
    assert.equal(r2.cajas, 0)
    const pk = estacionamiento(b.huerto, 1)
    assert.ok(Math.hypot(b.rec.fx[1].at(-1) - pk[0], b.rec.fy[1].at(-1) - pk[1]) < 1, `${huerto}: estacionado`)
    assert.ok(
      b.rec.fx[1].every((x, i) => b._calleDe([x, b.rec.fy[1][i]]) == null),
      `${huerto}: nunca entra a una calle`,
    )
  }
})

test('sin zona: con más robots que calles ocupadas, los que sobran esperan estacionados (estado 6) y se suman después', () => {
  const s = correr({ nw: 2, huerto: AD, duration: 1800, flota: { n: 3, estrategia: 'zonas' } })
  const f = s.summary().flota
  assert.ok(f.robots[2].estacionado_s > 1500, 'el tercero casi todo el turno estacionado')
  assert.ok(s.rec.fst[2].filter((v) => v === 6).length * s.dt > 1500)
  assert.ok(f.robots[0].cajas > 0)
})

test('desfase: el segundo sale del acopio cuando el primero lleva media vuelta', () => {
  const s = new HRSim({ nw: 12, huerto: AD, duration: 1800, flota: { n: 2, estrategia: 'desfase' } }, FIS).run()
  const sale = s.rec.fx[1].findIndex((x, i) => x !== s.rec.fx[1][0] || s.rec.fy[1][i] !== s.rec.fy[1][0])
  assert.ok(sale > 0, 'sale en algún momento')
  assert.ok(
    s.rec.fst[1].slice(1, sale).every((v) => v === 6),
    'espera en el acopio',
  )
  const lap = s.ev.rutasFlota.find((q) => q.r === 0).puntos
  let L = 0
  for (let i = 1; i < lap.length; i++) L += Math.hypot(lap[i][0] - lap[i - 1][0], lap[i][1] - lap[i - 1][1])
  let odo = 0
  for (let i = 1; i < sale; i++) odo += Math.hypot(s.rec.fx[0][i] - s.rec.fx[0][i - 1], s.rec.fy[0][i] - s.rec.fy[0][i - 1])
  assert.ok(Math.abs(odo - L / 2) < 1, `sale con el primero a media vuelta (${odo.toFixed(1)} de ${L.toFixed(1)} m)`)
})

test('direcciones opuestas: el segundo robot recorre la vuelta del primero al revés', () => {
  const s = new HRSim({ nw: 12, huerto: AD, duration: 60, flota: { n: 2, estrategia: 'opuestas' } }, FIS)
  const [a, b] = s.ev.rutasFlota.map((q) => q.puntos)
  assert.deepEqual(b, invertir(a))
})

test('palta alta densidad, 4 h: un segundo robot en zonas rompe el límite de transporte de H7, con carga pareja', () => {
  const uno = new HRSim({ nw: 12, huerto: AD, duration: 14400 }, FIS).run().summary()
  const dos = new HRSim({ nw: 12, huerto: AD, duration: 14400, flota: { n: 2, estrategia: 'zonas' } }, FIS).run().summary()
  const frac = (m) => m.TotalProductionCargoZone_crop_units / m.TotalRecollectedCrops_crop_units
  assert.ok(frac(uno) < 0.75, `un robot: ${(100 * frac(uno)).toFixed(0)} %`)
  assert.ok(frac(dos) > 0.9, `dos robots: ${(100 * frac(dos)).toFixed(0)} %`)
  assert.ok(dos.flota.jainCajas > 0.95, `equidad entre robots ${dos.flota.jainCajas}`)
  // las zonas se reparten al terminar la vuelta de cada robot, no al mismo tiempo: se solapan un rato, y la reserva lo resuelve
  assert.ok(dos.flota.esperaCalle_s < 0.01 * 2 * 14400, `espera por calle ${dos.flota.esperaCalle_s} s`)
})

test('la corrida con flota pasa al visor (robot 1 en la escena; lo entregado, de toda la flota)', () => {
  const s = new HRSim({ nw: 12, huerto: AD, duration: 600, flota: { n: 2, estrategia: 'zonas' } }, FIS).run()
  const run = simToRun(s, { robot: true })
  assert.equal(run.series.cargo.at(-1), Math.fround(s.summary().TotalProductionCargoZone_crop_units))
  assert.ok(s.ev.picks.every((e) => e.r === 0 || e.r === 1))
})

const flotaArb = fc.record({
  huerto: fc.constantFrom(AD, 'palta-tradicional', 'palta-ladera', 'uva-parron', 'arandano', 'cerezo-ufo'),
  nw: fc.integer({ min: 1, max: 24 }),
  duration: fc.integer({ min: 300, max: 1500 }),
  flota: fc.record({ n: fc.constantFrom(2, 3), estrategia: fc.constantFrom(...FLOTA_ESTRATEGIAS) }),
  profile: fc.constantFrom('matlab-2026', 'hri'),
  acopio: fc.constantFrom(undefined, { enabled: true }),
  robotTipo: fc.constantFrom('warthog', 'burro', 'burro-carro'),
})

test(`property-based: con flota se cumplen las invariantes y las reglas de convivencia (${RUNS} casos)`, () => {
  fc.assert(
    fc.property(flotaArb, (o) => checkInvariants(correr(o), { robot: true })),
    { numRuns: RUNS, seed: Number(process.env.PBT_SEED) || 8 },
  )
})
