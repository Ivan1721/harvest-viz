// H5: uva de mesa en parrón, arándano y cerezo peatonal (mismo generador; cambian planta, marco, carga y unidad).
import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { resolveParams } from '../../src/hrsim/common.js'
import { buildHuerto } from '../../src/hrsim/huertos/index.js'
import { ROBOTS } from '../../src/hrsim/robots.js'
import { FIS } from '../helpers.mjs'

const CULTIVOS = {
  'uva-parron': { plantas: 756, kg: 9, kgh: [36, 44] },
  arandano: { plantas: 3135, kg: 2, dia: [50, 70] },
  'cerezo-ufo': { plantas: 1612, kg: 5, kgh: [36, 56] },
}

// distancia de un punto al borde de la planta más cercana (busca solo en las 3 × 3 plantas vecinas: miles de plantas)
function margen(h, x, y) {
  const g = h.params,
    nA = g.arbolesPorHilera
  const r0 = Math.round(x / g.calle - 0.5),
    t0 = Math.round((y - g.cabecera) / g.sobreHilera - 0.5)
  let m = Infinity
  for (let r = r0 - 1; r <= r0 + 1; r++)
    for (let t = t0 - 1; t <= t0 + 1; t++) {
      if (r < 0 || r >= g.hileras || t < 0 || t >= nA) continue
      const a = h.arboles[r * nA + t]
      m = Math.min(m, Math.hypot(a.x - x, a.y - y) - a.radio)
    }
  return m
}

for (const [huerto, c] of Object.entries(CULTIVOS)) {
  test(`${huerto}: plantas, unidad de cosecha y capacidad del robot en kg`, () => {
    const p = resolveParams({ huerto, nw: 12 })
    assert.equal(buildHuerto(p).arboles.length, c.plantas)
    assert.equal(p.maxProd, c.kg)
    for (const robotTipo of Object.keys(ROBOTS)) {
      const q = resolveParams({ huerto, robotTipo })
      assert.equal(q.capacityBoxes, Math.floor(ROBOTS[robotTipo].cargaKg / c.kg + 1e-9))
    }
    assert.ok(
      new HOSim({ ...p, duration: 10, act: 'ladder' }).W.every((w) => w.ladder === 0),
      'sin escalera',
    )
  })

  test(`${huerto}: calibración del ritmo de cosecha (sin robot, cuadrilla mixta)`, () => {
    const s = new HOSim({ huerto, nw: 12, act: 'mixed', duration: 2700 }).run()
    const kg = s.summary().TotalRecollectedCrops_crop_units
    if (c.dia) {
      const kg8 = ((kg / 12) * 8 * 3600) / 2700
      assert.ok(kg8 >= c.dia[0] && kg8 <= c.dia[1], `${kg8.toFixed(0)} kg por persona en 8 h`)
    } else {
      let n = 0
      s.rec.wst.forEach((a) => a.forEach((x) => (n += x === 1 ? 1 : 0)))
      const kgh = kg / ((n * s.dt) / 3600)
      assert.ok(kgh >= c.kgh[0] && kgh <= c.kgh[1], `${kgh.toFixed(1)} kg/h cosechando`)
    }
  })

  test(`${huerto}: con los tres robots la fruta se conserva, nadie atraviesa plantas y el robot no las roza`, () => {
    for (const robotTipo of Object.keys(ROBOTS)) {
      const o = { huerto, nw: 12, act: 'mixed', duration: 1800, robotTipo }
      for (const s of [new HRSim(o, FIS).run(), robotTipo === 'warthog' ? new HOSim(o).run() : null].filter(Boolean)) {
        const sm = s.summary(),
          h = s.huerto,
          r = s.rec
        assert.ok(Math.abs(s.cosecha.inicial - s.cosecha.restante() - sm.TotalRecollectedCrops_crop_units) < 1e-6, 'conservación')
        const R = h.arboles[0].radio
        for (let k = 0; k < s.NH; k++) for (let i = 0; i < r.t.length; i += 4) assert.ok(margen(h, r.wx[k][i], r.wy[k][i]) >= -0.1 * R - 1e-6)
        if (r.ry) {
          const rb = ROBOTS[robotTipo]
          assert.ok(Math.max(...r.onboard) <= rb.cargaKg)
          for (let i = 0; i < r.t.length; i += 2) {
            assert.ok(margen(h, r.rx[i], r.ry[i]) >= rb.ancho / 2, `${robotTipo} a ${r.rx[i].toFixed(2)}, ${r.ry[i].toFixed(2)}`)
            if (rb.carro) assert.ok(margen(h, r.cx[i], r.cy[i]) >= rb.carro.ancho / 2, 'carro')
          }
        }
      }
    }
  })
}

test('arándano: el Warthog no cabe en la calle de 1,8 m y recorre la cabecera; el Burro entra', () => {
  assert.equal(buildHuerto(resolveParams({ huerto: 'arandano' })).calles.robotCabe, false)
  assert.equal(buildHuerto(resolveParams({ huerto: 'arandano', robotTipo: 'burro' })).calles.robotCabe, true)
  assert.equal(buildHuerto(resolveParams({ huerto: 'uva-parron' })).params.forma, 'parron')
})
