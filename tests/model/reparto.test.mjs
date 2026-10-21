// H7, fase C: reparto de la cuadrilla («frente» y «repartida»), avance del bloque, ruta del robot que sigue a la
// cuadrilla y estado de cada planta.
import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { resolveParams, paramsHash } from '../../src/hrsim/common.js'
import { buildHuerto } from '../../src/hrsim/huertos/index.js'
import { vueltaPorCalles } from '../../src/hrsim/huertos/rectangular.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { FIS } from '../helpers.mjs'

const AD = 'palta-alta-densidad'
const huerto = (o) => buildHuerto(resolveParams({ huerto: AD, nw: 12, ...o }))

test('parámetros: sin reparto ni avance no hay claves nuevas; el mapa de MATLAB los ignora; validación', () => {
  const p = resolveParams({ huerto: AD })
  assert.equal('reparto' in p, false)
  assert.equal('avance' in p, false)
  assert.equal(paramsHash(resolveParams({ huerto: AD, reparto: { modo: 'acopio' }, avance: 0 })), paramsHash(p))
  assert.equal('reparto' in resolveParams({ reparto: { modo: 'frente' } }), false)
  assert.equal('avance' in resolveParams({ avance: 0.5 }), false)
  assert.deepEqual(resolveParams({ huerto: AD, reparto: { modo: 'frente' } }).reparto, { modo: 'frente', tramo: 4 })
  assert.throws(() => resolveParams({ huerto: AD, reparto: { modo: 'otro' } }), /reparto.modo/)
  assert.throws(() => resolveParams({ huerto: AD, reparto: { modo: 'frente', tramo: 0 } }), /reparto.tramo/)
  assert.throws(() => resolveParams({ huerto: AD, avance: 0.95 }), /avance/)
})

test('reparto de siempre: parejas en las 6 calles centrales, un lado entero cada uno', () => {
  const h = huerto({})
  assert.equal(new Set(h.tramos.map((t) => t.eje)).size, 6)
  assert.ok(h.tramos.every((t) => t.arboles.length === 45))
  assert.equal(h.cosechados.length, 0)
})

test('frente: uno por calle sobre 12 calles, tramos de 4 árboles a la misma altura; la reserva sigue por altura', () => {
  const h = huerto({ reparto: { modo: 'frente' } })
  assert.equal(new Set(h.tramos.map((t) => t.eje)).size, 12)
  assert.ok(h.tramos.every((t) => t.arboles.length === 4 && t.arboles[0] % 45 === 0))
  const nivel = (t) => Math.floor((t.arboles[0] % 45) / 4)
  for (let k = 1; k < h.reserva.length; k++) assert.ok(nivel(h.reserva[k]) >= nivel(h.reserva[k - 1]))
  // tramo más largo
  assert.ok(huerto({ reparto: { modo: 'frente', tramo: 10 } }).tramos.every((t) => t.arboles.length === 10))
  // la vuelta del robot pasa por las 12 calles
  assert.equal(new Set(h.vueltaRobot.slice(1, -1).map((q) => q[0])).size, 12)
})

test('repartida: parejas en calles espaciadas a todo el ancho', () => {
  const h = huerto({ reparto: { modo: 'repartida' } })
  const ejes = [...new Set(h.tramos.map((t) => t.eje))].sort((a, b) => a - b)
  assert.equal(ejes.length, 6)
  assert.ok(ejes.at(-1) - ejes[0] >= 0.75 * h.limites.w, `de ${ejes[0]} a ${ejes.at(-1)} m`)
  assert.ok(h.tramos.every((t) => t.arboles.length === 45))
})

test('avance del bloque: los lados cercanos al acopio ya están cosechados y la cuadrilla parte más afuera', () => {
  const h = huerto({ avance: 0.5 })
  const nLados = 2 * h.calles.ejes.length
  assert.equal(h.cosechados.length, (nLados / 2) * 45)
  const hechos = new Set(h.cosechados.map(([i, l]) => `${i}${l}`))
  for (const t of [...h.tramos, ...h.reserva]) for (const i of t.arboles) assert.equal(hechos.has(`${i}${t.lado}`), false)
  const dCentro = (hh) => Math.min(...hh.tramos.map((t) => Math.abs(t.eje - hh.acopio[0])))
  assert.ok(dCentro(h) > dCentro(huerto({})) + 20)
  const s = new HOSim({ huerto: AD, nw: 12, act: 'mixed', duration: 600, avance: 0.5 })
  // los lados exteriores de las hileras de los bordes no dan a ninguna calle: no se cuentan en el avance
  assert.ok(Math.abs(s.cosecha.inicial - (1125 * 9 - h.cosechados.length * 4.5)) < 1e-6)
})

test('frente y repartida: la fruta se conserva con y sin robot', () => {
  for (const reparto of [{ modo: 'frente' }, { modo: 'repartida' }]) {
    const o = { huerto: AD, nw: 12, act: 'mixed', duration: 900, reparto, avance: 0.25 }
    for (const s of [new HRSim(o, FIS).run(), new HOSim(o).run()]) {
      const sm = s.summary()
      assert.ok(Math.abs(s.cosecha.inicial - s.cosecha.restante() - sm.TotalRecollectedCrops_crop_units) < 1e-6, reparto.modo)
    }
  }
})

test('vuelta por calles: zigzag si el robot cabe, cabecera si no', () => {
  const c = { yb: 2, yt: 98, robotCabe: true, w: 100 }
  const z = vueltaPorCalles(c, [50, 2], [60, 40])
  assert.deepEqual(z[0], [50, 2])
  assert.deepEqual(z.at(-1), [50, 2])
  assert.deepEqual([...new Set(z.slice(1, -1).map((q) => q[0]))], [40, 60])
  assert.deepEqual(vueltaPorCalles({ ...c, robotCabe: false }, [50, 2], [40, 60]), [
    [50, 2],
    [61.5, 2],
    [38.5, 2],
    [50, 2],
  ])
  assert.deepEqual(vueltaPorCalles(c, [50, 2], []), [
    [50, 2],
    [50, 2],
  ])
})

test('la ruta del robot sigue a la cuadrilla cuando cambia de calles (y si no cambia, no se toca)', () => {
  // hileras cortas y árboles con poca fruta: la cuadrilla termina sus lados y se muda en pocos minutos, y la vuelta
  // del robot (que se recalcula al terminar cada vuelta, en el acopio) es corta
  const o = { huerto: AD, nw: 12, act: 'mixed', duration: 1500, huertoParams: { arbolesPorHilera: 12, cargaArbol: 3 } }
  const s = new HRSim(o, FIS).run()
  assert.ok(s.ev.rutas.length > 1, 'se recalculó')
  const ult = s.ev.rutas.at(-1)
  const ejes = new Set(ult.puntos.slice(1, -1).map((q) => q[0]))
  assert.ok(ejes.size > 0)
  // cada recálculo deja la ruta en calles donde había gente o cajas, y nunca entre copas
  const h = s.huerto,
    R = h.arboles[0].radio
  for (const r of s.ev.rutas)
    for (const [x, y] of r.puntos) if (y > h.calles.cabecera && y < h.limites.h - h.calles.cabecera) assert.ok(h.calles.ejes.includes(x))
  for (let i = 0; i < s.rec.rx.length; i += 4) {
    let m = Infinity
    for (const a of h.arboles) m = Math.min(m, Math.hypot(a.x - s.rec.rx[i], a.y - s.rec.ry[i]) - a.radio)
    assert.ok(m >= -0.05 * R, `robot a ${m.toFixed(2)} m de una copa`)
  }
  const sm = s.summary()
  assert.ok(Math.abs(s.cosecha.inicial - s.cosecha.restante() - sm.TotalRecollectedCrops_crop_units) < 1e-6)
  // la misma corrida corta en un huerto donde nadie se muda: una sola ruta
  assert.equal(new HRSim({ huerto: 'uva-parron', nw: 12, act: 'mixed', duration: 600 }, FIS).run().ev.rutas.length, 1)
})

test('estado de cada planta, caminata y calles del robot en la corrida', () => {
  const o = { huerto: AD, nw: 12, act: 'mixed', duration: 900, avance: 0.25 }
  const s = new HRSim(o, FIS).run()
  const run = simToRun(s, { robot: true })
  const { ini, fin } = run.plantas
  assert.equal(ini.length, 1125)
  // avance: los lados ya cosechados cuentan desde antes de la corrida
  const previas = [...fin].filter((v) => v === -1).length
  assert.ok(previas > 0)
  for (let i = 0; i < ini.length; i++) assert.ok(ini[i] <= fin[i])
  const tocadas = [...ini].filter((v) => v >= 0 && Number.isFinite(v)).length
  assert.ok(tocadas >= 12, `${tocadas} plantas empezadas en la corrida`)
  // caminata acumulada, no decreciente
  for (const w of run.workers) for (let i = 1; i < run.n; i += 50) assert.ok(w.dist[i] >= w.dist[i - 1])
  assert.ok(run.workers.every((w) => w.dist[run.n - 1] > 0))
  assert.ok(run.robot.calles >= 1 && run.robot.calles <= 24)
  assert.ok(run.robot.rutas.length >= 1)
  // como llega del worker: plantas ya calculadas
  const delWorker = simToRun(
    { ...s, p: s.p, rec: s.rec, W: s.W, summary: s.summary(), plantas: s.cosecha.estadoPlantas(), cosecha: undefined },
    { robot: true },
  )
  assert.deepEqual(delWorker.plantas.fin, fin)
})
