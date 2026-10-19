// H2: huertos generados (palta tradicional): geometría, caminos por calles e invariantes de la simulación.
import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { resolveParams } from '../../src/hrsim/common.js'
import { buildHuerto } from '../../src/hrsim/huertos/index.js'
import { generarRectangular, rutaCalles, PALTA_TRADICIONAL, ROBOT_ANCHO } from '../../src/hrsim/huertos/rectangular.js'
import { FIS } from '../helpers.mjs'

const PALTA = { huerto: 'palta-tradicional' }

test('palta tradicional: 16 × 15 árboles en 96 × 102 m, 15 calles de 1 m libre (el robot no entra)', () => {
  const h = buildHuerto(resolveParams({ ...PALTA, nw: 12 }))
  assert.equal(h.arboles.length, 240)
  assert.deepEqual(h.limites, { w: 96, h: 102 })
  assert.equal(h.calles.ejes.length, 15)
  assert.equal(h.calles.anchoLibre, 1)
  assert.equal(h.calles.robotCabe, false)
  assert.equal(
    h.arboles.reduce((s, a) => s + a.carga, 0),
    240 * 42,
  )
  assert.deepEqual(h.acopio, [48, 3])
  // parejas por calle, empezando por la que está frente al acopio
  assert.equal(h.tramos.length, 12)
  assert.equal(h.tramos[0].eje, 48)
  assert.equal(h.tramos[1].eje, 48)
  assert.notEqual(h.tramos[0].lado, h.tramos[1].lado)
  assert.equal(new Set(h.tramos.map((t) => t.eje)).size, 6)
  // el robot recorre la cabecera inferior pasando por la boca de las calles ocupadas
  assert.ok(h.vueltaRobot.every(([x, y]) => y === 2 || (x === 48 && y === 3)))
})

test('más cosecheros que lados de hilera: los lados se parten en tramos; la réplica no tiene parámetros de huerto', () => {
  const h = generarRectangular(PALTA_TRADICIONAL, { nw: 48, sistema: 'x' })
  assert.equal(h.tramos.length, 48)
  assert.ok(h.tramos.every((t) => t.arboles.length < 15))
  const idx = h.tramos.flatMap((t) => t.arboles.map((a) => `${a}${t.lado}`))
  assert.equal(new Set(idx).size, idx.length, 'ningún lado de árbol se asigna dos veces')
  assert.equal(resolveParams({}).huertoParams, undefined)
  assert.equal(resolveParams({ ...PALTA, huertoParams: { hileras: 8 } }).huertoParams.calle, 6, 'los parámetros parciales se combinan')
  assert.throws(() => resolveParams({ ...PALTA, huertoParams: { radioCopa: 3 } }), /radioCopa/)
  assert.throws(() => resolveParams({ ...PALTA, huertoParams: { hileras: 1 } }), /hileras/)
})

test('robot que cabe en las calles: recorre en zigzag las calles ocupadas', () => {
  const h = generarRectangular({ ...PALTA_TRADICIONAL, calle: 4, sobreHilera: 2, radioCopa: 1, hileras: 25, arbolesPorHilera: 45 }, { nw: 6, sistema: 'x' })
  assert.equal(h.calles.robotCabe, true)
  const xs = new Set(h.vueltaRobot.slice(1, -1).map(([x]) => x))
  assert.equal(xs.size, 3, 'pasa por las 3 calles ocupadas')
})

// distancia mínima de un segmento a un punto
function segDist(a, b, p) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    L = dx * dx + dy * dy
  const t = L < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L))
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1])
}

test('caminos por calles: ningún tramo atraviesa una copa', () => {
  const h = generarRectangular(PALTA_TRADICIONAL, { nw: 30, sistema: 'x' })
  const pts = [h.acopio, [10, 3], [80, 99]]
  for (const t of h.tramos) for (const k of [0, 7, 14]) pts.push(h.puesto(t.arboles[k], t.lado))
  for (const a of pts)
    for (const b of pts) {
      const path = [a, ...rutaCalles(h, a, b)]
      for (let i = 0; i < path.length - 1; i++)
        for (const tr of h.arboles) {
          // los puestos de cosecha están dentro del borde de su propia copa (0,9 R): se tolera solo junto a ellos
          const d = segDist(path[i], path[i + 1], [tr.x, tr.y])
          assert.ok(d >= 0.9 * tr.radio - 1e-9, `camino ${a} → ${b} pasa a ${d.toFixed(2)} m del árbol (${tr.x}, ${tr.y})`)
        }
      assert.deepEqual(path.at(-1), [b[0], b[1]])
    }
})

for (const [nw, act] of [
  [12, 'mixed'],
  [6, 'ladder'],
  [34, 'ground'],
]) {
  test(`simulación ${nw} cosecheros (${act}): la fruta se conserva, nadie cruza copas, el robot no entra a las calles`, () => {
    const o = { ...PALTA, nw, act, duration: 2700 }
    for (const s of [new HRSim(o, FIS).run(), new HOSim(o).run()]) {
      const sm = s.summary()
      assert.ok(
        s.cosecha.fruta.every((v) => v >= -1e-9),
        'ningún lado queda con carga negativa',
      )
      assert.ok(Math.abs(s.cosecha.inicial - s.cosecha.restante() - sm.TotalRecollectedCrops_crop_units) < 1e-6, 'cosechada + restante = inicial')
      const R = s.huerto.arboles[0].radio
      for (let k = 0; k < s.NH; k++)
        for (let i = 0; i < s.rec.t.length; i += 4) {
          const x = s.rec.wx[k][i],
            y = s.rec.wy[k][i]
          for (const a of s.huerto.arboles) assert.ok(Math.hypot(a.x - x, a.y - y) >= 0.9 * R - 1e-6, `H${k + 1} dentro de una copa en t=${s.rec.t[i]}`)
        }
      if (s.rec.ry) {
        assert.ok(Math.max(...s.rec.ry) <= s.huerto.calles.cabecera, 'el robot no sale de la cabecera')
        // ni su carrocería (medio ancho 0,69 m) toca una copa, tampoco al girar en U
        for (let i = 0; i < s.rec.t.length; i += 2)
          for (const a of s.huerto.arboles) assert.ok(Math.hypot(a.x - s.rec.rx[i], a.y - s.rec.ry[i]) - a.radio >= ROBOT_ANCHO / 2)
      }
    }
  })
}

test('calibración: 12 cosecheros (mixta) rinden 320–420 kg por persona en 8 h', () => {
  const s = new HOSim({ ...PALTA, nw: 12, act: 'mixed', duration: 2700 }).run()
  const kg8h = ((s.summary().TotalRecollectedCrops_crop_units / 12) * 8 * 3600) / 2700
  assert.ok(kg8h >= 320 && kg8h <= 420, `${kg8h.toFixed(0)} kg/día`)
})

test('al agotar su lado, el cosechero camina al siguiente árbol del tramo', () => {
  // árboles con poca fruta: se agotan en minutos
  const s = new HOSim({ ...PALTA, nw: 2, act: 'ground', duration: 900, huertoParams: { cargaArbol: 6 } }).run()
  assert.ok(s.rec.wst[0].includes(13), 'pasó por el estado «camina al siguiente árbol»')
  const ys = new Set(s.rec.wy[0].map((y) => Math.round(y)))
  assert.ok(
    [...ys].some((y) => y >= 15),
    'avanzó por la hilera',
  )
})
