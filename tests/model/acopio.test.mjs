// H7, fase A: acopio con acopiador, bins y camión.
import test from 'node:test'
import assert from 'node:assert/strict'
import { Acopio, ACOPIO_DEFAULTS, ACOPIADOR } from '../../src/hrsim/acopio.js'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { resolveParams, paramsHash } from '../../src/hrsim/common.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { FIS } from '../helpers.mjs'

const costo = { recibir: 0.1, cargar: 0.05 }
// avanza `s` segundos con un reloj que sigue corriendo entre llamadas
const correr = (a, s, dt = 1) => {
  a.reloj ??= 0
  for (let k = 0; k < s; k += dt) a.step((a.reloj += dt))
}

test('acopiador: atiende por orden, llena bins y el camión sale con su capacidad', () => {
  const a = new Acopio({ binKg: 100, camionBins: 2, viajeS: 50, intervaloS: 1e9, cargaBinS: 5, topeBins: 10 }, 1, costo)
  const hechos = []
  for (let k = 0; k < 5; k++) a.pedir({ kg: 50, dur: 2, onStart: () => hechos.push(`s${k}`), onDone: () => hechos.push(`d${k}`) })
  correr(a, 8)
  assert.deepEqual(hechos.slice(0, 4), ['s0', 'd0', 's1', 'd1'], 'por orden, uno a la vez')
  correr(a, 60)
  assert.equal(a.recibido, 250)
  // 2 bins llenos → se cargan y el camión sale con 200 kg; queda medio bin
  assert.equal(a.despachado, 200)
  assert.equal(a.viajes, 1)
  assert.equal(a.binActual, 50)
  assert.ok(a.work > 0 && a.ocupado > 0)
  assert.equal(a.enAcopio, 50)
})

test('tope de bins: con el camión de viaje, el acopio lleno no recibe más hasta que vuelve', () => {
  const a = new Acopio({ binKg: 10, camionBins: 1, viajeS: 100, intervaloS: 1e9, cargaBinS: 1, topeBins: 2 }, 1, costo)
  for (let k = 0; k < 6; k++) a.pedir({ kg: 10, dur: 1 })
  correr(a, 20)
  // un bin salió en el camión (que tarda 100 s); el acopio se llenó con 2 y quedan pedidos en cola
  assert.equal(a.despachado, 10)
  assert.equal(a.binsLlenos, 2)
  assert.ok(a.cola.length > 0)
  assert.equal(a.estado, ACOPIADOR.LIBRE)
  // camión de 1 bin con viajes de 100 s: los 6 bins salen o quedan en el acopio (tope 2) en unos 5 viajes
  correr(a, 700)
  assert.equal(a.cola.length, 0, 'al volver el camión se destraba')
  assert.equal(a.recibido, 60)
})

test('salida por intervalo: el camión sale con lo que tenga', () => {
  const a = new Acopio({ binKg: 10, camionBins: 4, viajeS: 1000, intervaloS: 30, cargaBinS: 1, topeBins: 10 }, 1, costo)
  a.pedir({ kg: 10, dur: 1 })
  correr(a, 40)
  assert.equal(a.despachado, 10)
  assert.equal(a.viajes, 1)
})

test('sin acopio no hay parámetros nuevos (la réplica no cambia); con acopio, valores de partida y validación', () => {
  assert.equal('acopio' in resolveParams({}), false)
  assert.equal(paramsHash(resolveParams({ acopio: null })), paramsHash(resolveParams({})))
  assert.equal(paramsHash(resolveParams({ acopio: { enabled: false } })), paramsHash(resolveParams({})))
  assert.deepEqual(resolveParams({ acopio: {} }).acopio, { ...ACOPIO_DEFAULTS })
  assert.throws(() => resolveParams({ acopio: { binKg: 0 } }), /acopio.binKg/)
})

for (const [nombre, mk] of [
  ['con robot', (o) => new HRSim(o, FIS).run()],
  ['sin robot', (o) => new HOSim(o).run()],
]) {
  test(`${nombre}: la fruta se conserva de punta a punta y lo despachado sale del acopio`, () => {
    const o = { huerto: 'palta-alta-densidad', nw: 12, act: 'mixed', duration: 3600, acopio: { camionBins: 2, viajeS: 900 } }
    const s = mk(o),
      sm = s.summary()
    assert.ok(Math.abs(s.cosecha.inicial - s.cosecha.restante() - sm.TotalRecollectedCrops_crop_units) < 1e-6, 'cosechada = recolectada')
    const a = sm.acopio
    assert.ok(a.despachado > 0 && a.despachado <= a.recibido + 1e-9)
    assert.equal(a.despachado % (2 * 380), 0, 'sale en camiones de 2 bins de 380 kg')
    assert.ok(Math.abs(a.recibido - sm.TotalProductionCargoZone_crop_units) <= o.duration && a.recibido <= sm.TotalProductionCargoZone_crop_units + 15 + 1e-9)
    assert.ok(a.kcal > 0 && a.ocupadoPct > 0)
    const run = simToRun(s, { robot: nombre === 'con robot' })
    assert.equal(run.acopio.desp.at(-1), a.despachado)
    assert.equal(run.acopio.cfg.camionBins, 2)
  })
}

test('con robot y un acopiador lento, el robot hace cola en el acopio (estado 6)', () => {
  const s = new HRSim(
    { huerto: 'palta-alta-densidad', nw: 24, act: 'mixed', duration: 2700, capacityBoxes: 4, acopio: { topeBins: 1, viajeS: 3000 } },
    FIS,
  ).run()
  assert.ok(s.rec.rst.includes(6))
  assert.ok(s.summary().acopio.esperaRobot_s > 0)
  const sinAcopio = new HRSim({ huerto: 'palta-alta-densidad', nw: 24, act: 'mixed', duration: 600 }, FIS).run()
  assert.equal(sinAcopio.rec.rst.includes(6), false)
  assert.equal(sinAcopio.acopio, null)
})
