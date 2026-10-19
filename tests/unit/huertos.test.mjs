// Sistemas de huerto (H1): el mapa del estudio como dato; nada cambia respecto de MATLAB.
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHuerto, SISTEMAS } from '../../src/hrsim/huertos/index.js'
import { resolveParams } from '../../src/hrsim/common.js'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { FIS } from '../helpers.mjs'

test('el huerto por defecto es el mapa del estudio', () => {
  const p = resolveParams({})
  assert.equal(p.huerto, 'matlab-2026')
  const h = buildHuerto(p)
  assert.equal(h.arboles.length, 12)
  assert.ok(
    h.arboles.every((a) => a.carga === Infinity),
    'los árboles no se agotan',
  )
  assert.equal(h.calles, null, 'se camina en línea recta')
  assert.deepEqual(h.acopio, [15, 2])
  assert.equal(h.vueltaRobot.length, 9)
  assert.equal(h.puestos.length, p.nw)
})

test('sistema desconocido da un error claro', () => {
  assert.throws(() => resolveParams({ huerto: 'otro' }), /sistema de huerto "otro" desconocido/)
  assert.ok(Object.keys(SISTEMAS).includes('matlab-2026'))
})

test('las simulaciones usan el huerto y lo dejan en los metadatos', () => {
  const cfg = { nw: 4, row: 2, act: 'ground', rp: 1, duration: 60 }
  const hr = new HRSim(cfg, FIS),
    ho = new HOSim(cfg)
  assert.equal(hr.huerto.sistema, 'matlab-2026')
  assert.deepEqual(hr.initPose, [15, 2, 0])
  assert.deepEqual(ho.cargo, [15, 2])
  const run = simToRun(hr.run(), { robot: true })
  assert.equal(run.meta.params.huerto, 'matlab-2026')
})

test('cada fila genera su vuelta del robot y los puestos de su disposición', () => {
  const a = buildHuerto(resolveParams({ row: 1, rp: 0 })),
    b = buildHuerto(resolveParams({ row: 3, rp: 1 }))
  assert.equal(a.vueltaRobot[2][1], 9)
  assert.equal(b.vueltaRobot[2][1], 24)
  assert.notDeepEqual(a.puestos[4].start, b.puestos[4].start)
})
