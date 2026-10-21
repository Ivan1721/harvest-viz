// H7, fase B: carga variable por árbol (lognormal), ritmo que cae al vaciarse el lado y regla para dejar el árbol.
import test from 'node:test'
import assert from 'node:assert/strict'
import { CARGA_DEFAULTS, cvDe, ritmoRel, fMinima, periodoMedio, factoresCarga, prepararCarga } from '../../src/hrsim/carga.js'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { resolveParams, paramsHash } from '../../src/hrsim/common.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { FIS } from '../helpers.mjs'

test('curva del ritmo: k = 460 reproduce Roka y Hyman (52 % del ritmo con 5 % de la fruta); umbral 2 deja 4,5 %', () => {
  assert.equal(ritmoRel(1, 460), 1)
  assert.ok(Math.abs(ritmoRel(0.05, 460) - 5.4 / 10.4) < 0.01)
  assert.equal(ritmoRel(0.3, 0), 1, 'k = 0: sin caída')
  const f = fMinima(460, 2)
  assert.ok(Math.abs(ritmoRel(f, 460) - 0.5) < 1e-9, 'al dejar el lado el ritmo es la mitad (periodo 2 × T₀)')
  assert.ok(f > 0.04 && f < 0.05)
  assert.equal(fMinima(0, 2), 0)
  assert.equal(periodoMedio(0, 2), 1)
  const m = periodoMedio(460, 2)
  assert.ok(m > 1 && m < 2, `periodo medio ${m}`)
  // con un umbral más alto se cosecha más fruta, a un periodo medio mayor
  assert.ok(fMinima(460, 3) < f && periodoMedio(460, 3) > m)
})

test('carga por árbol: lognormal de media 1, CV pedido, reproducible y sin cambiar la carga total', () => {
  const a = factoresCarga(20000, 0.5, 3)
  const n = a.length,
    mean = a.reduce((s, v) => s + v, 0) / n,
    sd = Math.sqrt(a.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
  assert.ok(Math.abs(mean - 1) < 1e-9, 'la carga total no cambia')
  assert.ok(Math.abs(sd - 0.5) < 0.02, `CV ${sd.toFixed(3)}`)
  assert.ok(
    a.every((v) => v > 0),
    'sin cargas negativas',
  )
  assert.deepEqual(factoresCarga(50, 0.5, 3), factoresCarga(50, 0.5, 3))
  assert.notDeepEqual(factoresCarga(50, 0.5, 3), factoresCarga(50, 0.5, 4))
  assert.ok(factoresCarga(10, 0, 1).every((v) => v === 1))
  assert.equal(prepararCarga({ cv: 0, k: 0, umbral: 2 }, 4).escala, 1)
})

test('parámetros: sin carga no hay claves nuevas (la réplica no cambia); con carga, CV por cultivo y validación', () => {
  assert.equal('carga' in resolveParams({ huerto: 'palta-tradicional' }), false)
  assert.equal('carga' in resolveParams({ carga: {} }), false, 'el mapa de MATLAB no tiene fruta por árbol')
  assert.equal(
    paramsHash(resolveParams({ huerto: 'palta-tradicional', carga: { enabled: false } })),
    paramsHash(resolveParams({ huerto: 'palta-tradicional' })),
  )
  assert.deepEqual(resolveParams({ huerto: 'palta-tradicional', carga: {} }).carga, { cv: 0.5, ...CARGA_DEFAULTS, enabled: true })
  assert.equal(resolveParams({ huerto: 'uva-parron', carga: {} }).carga.cv, 0.3)
  assert.equal(cvDe('palta-ladera'), 0.5)
  assert.throws(() => resolveParams({ huerto: 'palta-tradicional', carga: { umbral: 1 } }), /carga.umbral/)
  assert.throws(() => resolveParams({ huerto: 'palta-tradicional', carga: { k: -1 } }), /carga.k/)
  assert.throws(() => resolveParams({ huerto: 'palta-tradicional', carga: { cv: -0.1 } }), /carga.cv/)
})

test('CV 0 y k = 0 dan exactamente lo mismo que sin la opción', () => {
  const o = { huerto: 'palta-tradicional', nw: 6, act: 'ground', duration: 1200, huertoParams: { cargaArbol: 8 } }
  const a = new HOSim(o).run(),
    b = new HOSim({ ...o, carga: { cv: 0, k: 0 } }).run()
  assert.deepEqual(b.rec.wst, a.rec.wst)
  assert.equal(b.summary().TotalRecollectedCrops_crop_units, a.summary().TotalRecollectedCrops_crop_units)
  assert.equal(b.summary().carga.dejado, 0)
})

for (const [nombre, mk] of [
  ['con robot', (o) => new HRSim(o, FIS).run()],
  ['sin robot', (o) => new HOSim(o).run()],
]) {
  test(`${nombre}: la fruta se conserva y la dejada en los árboles se cuenta`, () => {
    // árboles con poca fruta: se dejan varios lados en pocos minutos
    const o = { huerto: 'palta-tradicional', nw: 6, act: 'mixed', duration: 1500, huertoParams: { cargaArbol: 10 }, carga: {} }
    const s = mk(o),
      sm = s.summary()
    assert.ok(Math.abs(s.cosecha.inicial - s.cosecha.restante() - sm.TotalRecollectedCrops_crop_units) < 1e-6, 'cosechada = inicial − en árboles')
    assert.ok(sm.carga.dejado > 0 && sm.carga.dejado < s.cosecha.restante())
    assert.ok(sm.carga.ritmo_kgh.every((v) => v >= 0) && sm.carga.ritmo_kgh.some((v) => v > 0))
    const run = simToRun(s, { robot: nombre === 'con robot' })
    assert.equal(run.carga.dej.at(-1), Math.fround(sm.carga.dejado))
    assert.equal(run.carga.ritmo.length, 6)
    assert.equal(run.carga.cfg.k, 460)
    // como llega del worker: el resumen ya calculado en vez del motor
    const delWorker = simToRun(
      { ...s, p: s.p, rec: s.rec, W: s.W, summary: sm, type: s.type, NH: s.NH, dt: s.dt, ev: s.ev, events: s.events },
      { robot: nombre === 'con robot' },
    )
    assert.deepEqual(delWorker.carga.ritmo, run.carga.ritmo)
  })
}

test('la carga total del cuartel no cambia y los árboles difieren', () => {
  const o = { huerto: 'palta-tradicional', nw: 2, duration: 1 }
  const a = new HOSim(o),
    b = new HOSim({ ...o, carga: {} })
  assert.ok(Math.abs(a.cosecha.inicial - b.cosecha.inicial) < 1e-6)
  const lados = new Set(Array.from(b.cosecha.fruta, (v) => v.toFixed(3)))
  assert.ok(lados.size > 100)
})

// calibración: con la caída de ritmo, los rendimientos siguen en los rangos de H2–H5
const RANGOS = {
  'palta-tradicional': { kg8: [320, 420] },
  'palta-alta-densidad': { kg8: [1000, 1600] },
  'uva-parron': { kgh: [36, 44] },
  'cerezo-ufo': { kgh: [36, 56] },
  arandano: { kg8: [50, 70] },
}
for (const [huerto, r] of Object.entries(RANGOS))
  test(`calibración con carga variable y ritmo que cae: ${huerto}`, () => {
    const s = new HOSim({ huerto, nw: 12, act: 'mixed', duration: 2700, carga: {} }).run()
    const kg = s.summary().TotalRecollectedCrops_crop_units
    if (r.kg8) {
      const kg8 = ((kg / 12) * 8 * 3600) / 2700
      assert.ok(kg8 >= r.kg8[0] && kg8 <= r.kg8[1], `${kg8.toFixed(0)} kg por persona en 8 h`)
    } else {
      let n = 0
      s.rec.wst.forEach((a) => a.forEach((x) => (n += x === 1 ? 1 : 0)))
      const kgh = kg / ((n * s.dt) / 3600)
      assert.ok(kgh >= r.kgh[0] && kgh <= r.kgh[1], `${kgh.toFixed(1)} kg/h cosechando`)
    }
  })
