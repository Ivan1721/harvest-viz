// H4: ladera (pendiente a lo largo de las hileras): marcha de Tobler, gasto de Pandolf y frenada del robot cuesta abajo.
import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { tobler, pandolf, factorGasto, paso } from '../../src/hrsim/huertos/pendiente.js'
import { protectionDistance } from '../../src/hrsim/ssm.js'
import { FIS } from '../helpers.mjs'

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`)

test('Tobler: 1 en plano, máxima en bajada suave (−5 %), menor subiendo que bajando', () => {
  near(tobler(0), 1)
  near(tobler(0.2), Math.exp(-0.7))
  near(tobler(-0.2), Math.exp(-0.35))
  assert.ok(tobler(-0.05) > 1)
  assert.ok(tobler(0.2) < tobler(-0.2))
})

test('Pandolf: valor de referencia y factor de gasto (1 en plano y en bajada, > 1 subiendo, más con caja)', () => {
  // 70 kg sin carga a 1 m/s en plano, tierra (η = 1,1): 1,5·70 + 1,1·70·1,5 = 220,5 W
  near(pandolf(70, 0, 1, 0, 1.1), 220.5)
  near(factorGasto(0, 0.75, false), 1)
  near(factorGasto(-20, 0.75, true), 1)
  assert.ok(factorGasto(20, 0.37, false) > 1.5)
  assert.ok(factorGasto(20, 0.37, true) > factorGasto(20, 0.37, false) - 1e-12)
  // sin pendiente, el paso es exactamente el del plano (la réplica no cambia)
  assert.deepEqual(paso({ terreno: { pendiente: 0 } }, [0, 0], [1, 1], 0.75, true), { v: 0.75, k: 1 })
  assert.deepEqual(paso(null, [0, 0], [1, 1], 0.75), { v: 0.75, k: 1 })
})

test('con pendiente 0, la ladera da exactamente lo mismo que la alta densidad', () => {
  const o = { nw: 6, act: 'mixed', duration: 900 }
  const a = new HOSim({ ...o, huerto: 'palta-ladera', huertoParams: { pendiente: 0 } }).run().summary()
  const b = new HOSim({ ...o, huerto: 'palta-alta-densidad' }).run().summary()
  assert.deepEqual(a, b)
  const c = new HRSim({ ...o, huerto: 'palta-ladera', huertoParams: { pendiente: 0 } }, FIS).run().summary()
  const d = new HRSim({ ...o, huerto: 'palta-alta-densidad' }, FIS).run().summary()
  assert.deepEqual(c, d)
})

test('ladera 20 %: los árboles siguen el terreno, subir es más lento y cosechar sin robot cuesta más por kg', () => {
  const o = { nw: 12, act: 'mixed', duration: 2700 }
  const L = new HOSim({ ...o, huerto: 'palta-ladera' }).run()
  const P = new HOSim({ ...o, huerto: 'palta-alta-densidad' }).run()
  const a = L.huerto.arboles[40]
  near(a.z, 0.2 * a.y)
  const kpk = (s) => s.summary().TotalHumanWorkload_kcal / s.summary().TotalRecollectedCrops_crop_units
  assert.ok(L.summary().TotalRecollectedCrops_crop_units < P.summary().TotalRecollectedCrops_crop_units)
  assert.ok(kpk(L) > 1.2 * kpk(P))
  // velocidad medida en pasos de marcha con componente hacia arriba: v = 0,75·Tobler(S), S = 0,2·(Δy / paso)
  const r = L.rec
  let found = false
  for (let k = 0; k < L.NH && !found; k++)
    for (let i = 2; i < r.t.length; i++) {
      const dx = r.wx[k][i] - r.wx[k][i - 1],
        dy = r.wy[k][i] - r.wy[k][i - 1],
        st = Math.hypot(dx, dy)
      if (r.wst[k][i] === 5 && r.wst[k][i - 1] === 5 && dy > 0.9 * st && st > 1e-6) {
        const S = (0.2 * dy) / st
        // el último paso de un tramo puede ser más corto (llega al waypoint): se acepta ≤
        assert.ok(st / L.dt <= 0.75 * tobler(S) + 1e-9)
        if (Math.abs(st / L.dt - 0.75 * tobler(S)) < 1e-9) found = true
      }
    }
  assert.ok(found, 'hay tramos subiendo')
})

test('robot cuesta abajo: frena peor (a − g·senθ), así que se detiene antes', () => {
  const s = new HRSim({ nw: 1, duration: 10, profile: 'hri', huerto: 'palta-ladera' }, FIS)
  s.rpose = [50, 50, 0]
  const w = s.W[0]
  w.state = 1
  const v = 1
  // trabajador a una distancia entre S_p(1) en plano y la necesaria cuesta abajo
  const d = protectionDistance(v, s.p.ssm) + v * s.dt + 0.3
  // bajando (−y, el acopio está al pie): debe parar
  w.pose = [50, 50 - d, 0]
  s.ssmStopped = false
  assert.equal(s._ssmScale(0, -v), 0)
  // subiendo, a la misma distancia: no para
  w.pose = [50, 50 + d, 0]
  s.ssmStopped = false
  assert.notEqual(s._ssmScale(0, v), 0)
})
