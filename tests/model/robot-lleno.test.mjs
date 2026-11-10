// Motor 0.9.0: el robot lleno en huertos generados. Dos defectos corregidos:
//  1. con acopiador, el robot insertaba un segundo desvío al acopio mientras esperaba que lo descargaran;
//  2. una pila mayor que lo que cabía en el robot no se recogía nunca (recogida todo o nada). Ahora el robot recibe las
//     cajas enteras que caben y vuelve por el resto.
import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { FIS } from '../helpers.mjs'

// escenario chico: con 3 cajas de capacidad las pilas superan al robot a los pocos minutos
const CHICO = { huerto: 'palta-alta-densidad', nw: 12, act: 'mixed', profile: 'hri', capacityBoxes: 3, duration: 2700 }

// corre tick a tick y junta lo que las pruebas miran
function seguir(o) {
  const s = new HRSim(o, FIS)
  const cap = s.p.capacityBoxes * s.p.maxProd
  const m = { maxABordo: 0, maxPila: 0, desviosEsperando: 0, ticksVacioYendo: 0, esperoAcopiador: false, recogidas: [] }
  const en11 = s.W.map(() => 0) // ticks de cada cosechero cargando el robot desde su última recogida
  let nEv = 0,
    nPk = 0
  for (;;) {
    const antes = s.W.map((w) => w.nBoxes)
    const esperaba = s.R.map((r) => r.acopioWait)
    if (!s.step()) break
    s.R.forEach((r, k) => {
      m.maxABordo = Math.max(m.maxABordo, r.prodRobot)
      if (r.acopioWait) m.esperoAcopiador = true
      // «va a descargar» sin nada a bordo: solo vale mientras el acopiador todavía tiene su carga
      if (r.goingToUnload && r.prodRobot === 0) m.ticksVacioYendo++
      if (k === 0) for (; nEv < s.events.length; nEv++) if (/Robot FULL/.test(s.events[nEv].msg) && esperaba[0]) m.desviosEsperando++
    })
    s.W.forEach((w, h) => {
      m.maxPila = Math.max(m.maxPila, w.nBoxes)
      if (w.state === 11) en11[h]++
    })
    for (; nPk < s.ev.picks.length; nPk++) {
      const pk = s.ev.picks[nPk],
        h = pk.h - 1
      m.recogidas.push({ h: pk.h, cajas: pk.amount / s.p.maxProd, pilaAntes: antes[h], pilaDespues: s.W[h].nBoxes, cargando_s: en11[h] * s.dt })
      en11[h] = 0
    }
  }
  return { s, cap, m, sm: s.summary() }
}

for (const [nombre, extra] of [
  ['con acopiador', { acopio: {} }],
  ['sin acopiador', {}],
]) {
  test(`robot lleno, ${nombre}: un solo desvío por descarga y nunca «va a descargar» vacío`, () => {
    const { m, sm } = seguir({ ...CHICO, ...extra })
    assert.ok(sm.unloads >= 3, 'el robot descarga varias veces en este escenario')
    if (extra.acopio) assert.ok(m.esperoAcopiador, 'el robot espera al acopiador con la carga a bordo')
    assert.equal(m.desviosEsperando, 0, 'ningún desvío se inserta mientras espera al acopiador')
    assert.equal(m.ticksVacioYendo, 0, 'la bandera goingToUnload no queda encendida con el robot vacío')
  })
}

test('pila mayor que la capacidad: el robot carga las cajas que caben, la pila baja y el resto se recoge después', () => {
  const { s, cap, m, sm } = seguir({ ...CHICO, acopio: {} })
  assert.ok(m.maxPila > s.p.capacityBoxes, 'hay pilas mayores que la capacidad del robot')
  assert.ok(sm.partialPickups > 0)
  assert.ok(m.maxABordo <= cap + 1e-9, 'lo que va a bordo nunca supera la capacidad')
  const parciales = m.recogidas.filter((r) => r.pilaDespues > 0)
  assert.equal(parciales.length, sm.partialPickups)
  for (const r of m.recogidas) {
    assert.ok(Number.isInteger(r.cajas) && r.cajas >= 1 && r.cajas <= s.p.capacityBoxes, 'cajas enteras, hasta la capacidad')
    assert.equal(r.pilaDespues, r.pilaAntes - r.cajas, 'la pila baja en lo que se cargó')
    // el cosechero carga solo las cajas que el robot recibe: cajas × loadTimePerBox, redondeado al tick
    assert.equal(r.cargando_s, Math.ceil((r.cajas * s.p.loadTimePerBox) / s.dt - 1e-9) * s.dt, `h${r.h}: ${r.cajas} cajas`)
  }
  // el resto de una pila se recoge en otra pasada: el mismo cosechero vuelve a entregar después de una parcial
  const k = m.recogidas.findIndex((r) => r.pilaDespues > 0)
  assert.ok(m.recogidas.slice(k + 1).some((r) => r.h === m.recogidas[k].h))
  // lo recogido es lo entregado más lo que va a bordo
  const recogido = s.ev.picks.reduce((a, e) => a + e.amount, 0)
  assert.ok(Math.abs(recogido - sm.TotalProductionCargoZone_crop_units - sm.RemainingCropsRobot_crop_units) < 1e-9)
  assert.ok(sm.TotalProductionCargoZone_crop_units >= 250, 'con la regla anterior este escenario entregaba 180 kg')
})

test('recogida parcial: la pila sigue en la escena y su espera se cuenta desde que se detectó', () => {
  const { s } = seguir({ ...CHICO, acopio: {} })
  // cada recogida cierra un evento de caja; tras una parcial queda otro abierto en el mismo punto
  const porH = (h) => s.ev.boxes.filter((b) => b.h === h)
  let vistas = 0
  for (const b of s.ev.boxes) {
    if (!Number.isFinite(b.picked)) continue
    const resto = porH(b.h).find((q) => q !== b && q.idx === b.idx && q.picked > b.picked)
    if (!resto) continue
    vistas++
    assert.deepEqual([resto.x, resto.y], [b.x, b.y])
  }
  assert.ok(vistas > 0)
  // en el visor: la caja se dibuja mientras idx <= i < picked, y no hay hueco entre la recogida parcial y la siguiente
  const run = simToRun(s, { robot: true })
  const b0 = run.robot.boxes.find((b) => run.robot.boxes.some((q) => q !== b && q.h === b.h && q.idx === b.idx && q.picked > b.picked))
  const visible = (i) => run.robot.boxes.some((b) => b.h === b0.h && i >= b.idx && i < b.picked)
  assert.ok(visible(b0.picked), 'tras la recogida parcial la pila sigue a la vista')
})

for (const [nombre, extra] of [
  ['un robot', {}],
  ['dos robots', { flota: { n: 2, estrategia: 'zonas' } }],
]) {
  test(`recogida parcial, ${nombre}: la fruta se conserva`, () => {
    const { s, cap, m, sm } = seguir({ ...CHICO, nw: 24, capacityBoxes: 4, duration: 1800, acopio: {}, carga: {}, ...extra })
    assert.ok(sm.partialPickups > 0)
    assert.ok(Math.abs(s.cosecha.inicial - s.cosecha.restante() - sm.TotalRecollectedCrops_crop_units) < 1e-6, 'cosechada = recolectada')
    assert.ok(m.maxABordo <= cap + 1e-9)
    assert.equal(m.ticksVacioYendo, 0)
    const recogido = s.ev.picks.reduce((a, e) => a + e.amount, 0)
    assert.ok(Math.abs(recogido - sm.TotalProductionCargoZone_crop_units - sm.RemainingCropsRobot_crop_units) < 1e-9)
    // con flota, el resto de una pila lo recoge el robot que la empezó
    if (extra.flota) {
      const dueño = new Map()
      for (const b of s.ev.boxes) {
        const k = `${b.h}|${b.idx}`
        if (dueño.has(k)) assert.equal(b.r, dueño.get(k), 'el resto sigue con el mismo robot')
        else dueño.set(k, b.r)
      }
    }
  })
}

test('mapa del estudio: se conserva la regla de MATLAB (todo o nada) y el resumen no cambia de forma', () => {
  const s = new HRSim({ nw: 12, row: 1, act: 'mixed', rp: 0, duration: 1200, capacityBoxes: 2 }, FIS).run()
  const sm = s.summary()
  assert.equal('partialPickups' in sm, false)
  assert.ok(sm.capacityBlocked > 0, 'el robot se llena')
  // cada recogida se lleva la pila completa
  assert.ok(s.ev.picks.length > 0 && s.ev.boxes.every((b) => s.ev.boxes.filter((q) => q.h === b.h && q.idx === b.idx).length === 1))
})
