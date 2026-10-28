// H8, fase B: la flota en el visor (conversión a `run.flota` y análisis por robot).
import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { simToRun } from '../../src/hrsim/toRun.js'
import { analyzeHRI } from '../../src/workload/hri.js'
import {
  analizarFlota,
  vistaRobot,
  filasFlota,
  robotsDeRun,
  selRobot,
  robotDeSel,
  ESTRATEGIAS,
  COLORES_ROBOT,
  colorRobot,
  etiquetaRobot,
} from '../../src/workload/flota.js'
import { nombreFlota } from '../../src/workload/variantes.js'
import { posesCSV } from '../../src/hrsim/export.js'
import { FIS } from '../helpers.mjs'

const AD = 'palta-alta-densidad'
const corrida = (opts) => simToRun(new HRSim({ nw: 12, huerto: AD, duration: 900, ...opts }, FIS).run(), { robot: true })
const cerca = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} ≠ ${b}`)

test('sin flota: la corrida no trae flota y el análisis es el de siempre', () => {
  const run = corrida({})
  assert.equal(run.flota, null)
  const a = analyzeHRI(run)
  assert.equal(a.porRobot, undefined)
  assert.equal(a.fluency.robotTime.calle, 0)
  assert.equal(a.fluency.robotTime.cede, 0)
})

test('con flota: series por robot; el robot 1 es el de run.robot y cada caja es de un solo robot', () => {
  const run = corrida({ flota: { n: 3, estrategia: 'zonas' } })
  const f = run.flota
  assert.equal(f.n, 3)
  assert.equal(f.estrategia, 'zonas')
  assert.equal(f.robots.length, 3)
  assert.deepEqual(Array.from(f.robots[0].pos), Array.from(run.robot.pos))
  assert.deepEqual(Array.from(f.robots[0].status), Array.from(run.robot.status))
  for (const [k, r] of f.robots.entries()) {
    assert.equal(r.id, k)
    assert.equal(r.pos.length, run.n * 3)
    assert.equal(r.status.length, run.n)
    assert.equal(r.onboard.length, run.n)
    assert.equal(r.energy.length, run.n)
    assert.equal(r.rutas[0].idx, 0, 'cada robot tiene su ruta desde el inicio')
    // lo entregado por cada robot es lo que dice el resumen del motor
    cerca(r.cargo.at(-1), f.resumen.robots[k].entregado, 1e-2, `entregado de RB-0${k + 1}`)
    assert.ok(r.boxes.every((b) => b.r === k) && r.picks.every((e) => e.r === k) && r.unloads.every((u) => u.r === k))
  }
  assert.equal(
    f.robots.reduce((s, r) => s + r.boxes.length, 0),
    run.robot.boxes.length,
  )
  assert.equal(
    f.robots.reduce((s, r) => s + r.picks.length, 0),
    run.robot.picks.length,
  )
  cerca(
    f.robots.reduce((s, r) => s + r.cargo.at(-1), 0),
    run.series.cargo.at(-1),
    1e-2,
    'lo entregado por la flota',
  )
  // a bordo: la serie global es la suma de la de cada robot
  for (const i of [0, 100, 400, run.n - 1])
    cerca(
      f.robots.reduce((s, r) => s + r.onboard[i], 0),
      run.robot.onboard[i],
      1e-2,
      `a bordo en ${i}`,
    )
})

test('con Burro con carro: cada robot trae la pose de su propio carro', () => {
  const run = corrida({ robotTipo: 'burro-carro', flota: { n: 2, estrategia: 'zonas' }, duration: 600 })
  const [a, b] = run.flota.robots
  for (const r of [a, b]) {
    assert.equal(r.trailer.x.length, run.n)
    assert.ok(Number.isFinite(r.trailer.x.at(-1)) && Number.isFinite(r.trailer.th.at(-1)))
  }
  assert.notDeepEqual(Array.from(a.trailer.x), Array.from(b.trailer.x), 'son dos carros distintos')
  assert.deepEqual(Array.from(a.trailer.x), Array.from(run.robot.trailer.x), 'el del robot 1 es el de run.robot')
  // un robot sin carro (Warthog) no trae serie de carro
  assert.equal(corrida({ robotTipo: 'warthog', flota: { n: 2, estrategia: 'zonas' }, duration: 120 }).flota.robots[1].trailer, null)
})

test('análisis de la flota: la geometría va hacia el robot más cercano; lo propio de cada robot se suma', () => {
  const run = corrida({ flota: { n: 2, estrategia: 'zonas' }, duration: 1800 })
  const h = analizarFlota(run)
  assert.equal(h.porRobot.length, 2)
  // distancia a las personas: la del robot más cercano de los dos
  for (let i = 0; i < run.n; i += 29) {
    assert.equal(h.minD[i], Math.min(...h.porRobot.map((a) => a.minD[i])), `minD en ${i}`)
    for (let k = 0; k < run.workers.length; k++)
      assert.equal(h.dist[i * run.workers.length + k], Math.min(...h.porRobot.map((a) => a.dist[i * run.workers.length + k])))
  }
  // cada robot reparte todo su tiempo entre los estados
  for (const a of h.porRobot) {
    const { exact, ...rt } = a.fluency.robotTime
    assert.ok(exact)
    cerca(
      Object.values(rt).reduce((s, v) => s + v, 0),
      1,
      1e-9,
      'fracciones del tiempo',
    )
  }
  // y la flota, el promedio de los dos
  const rt = h.fluency.robotTime
  for (const k of ['move', 'wait', 'calle', 'cede', 'acopio'])
    cerca(rt[k], (h.porRobot[0].fluency.robotTime[k] + h.porRobot[1].fluency.robotTime[k]) / 2, 1e-12, k)
  // energía: la de toda la flota, por kg de lo que entregó toda la flota
  const [e0, e1] = h.porRobot.map((a) => a.fluency.energia)
  const e = h.fluency.energia
  cerca(e.wh, e0.wh + e1.wh, 1e-6, 'Wh de la flota')
  cerca(e.whPorKg, e.wh / run.series.cargo.at(-1), 1e-9, 'Wh por kg de la flota')
  cerca(e.bateriaPct, Math.min(e0.bateriaPct, e1.bateriaPct), 1e-9, 'batería del que más gastó')
  assert.equal(e.descargas, e0.descargas + e1.descargas)
  // lo que cada robot gastó es lo que dice el resumen del motor
  run.flota.resumen.robots.forEach((q, k) => cerca(h.porRobot[k].fluency.energia.wh, q.energyWh, 0.5, `Wh de RB-0${k + 1}`))
  // las cajas: la espera de la flota es la de todas las cajas; las esperas de calle y de cesión quedan en los estados 7 y 8
  assert.equal(h.assign.n + h.assign.pending, run.robot.boxes.length)
  const t7 = run.flota.robots.map((r) => r.status.filter((s) => s === 7).length * run.dt)
  t7.forEach((s, k) => cerca(s, run.flota.resumen.robots[k].esperaCalle_s, 1e-6, `espera de calle de RB-0${k + 1}`))
  // paradas y eventos de protección de la flota: los de cada robot, con el número del robot
  assert.equal(
    h.fluency.safetyStops.length,
    h.porRobot.reduce((s, a) => s + a.fluency.safetyStops.length, 0),
  )
  assert.ok(h.fluency.protection.events.every((ev) => ev.r === 0 || ev.r === 1))
})

test('vistaRobot: el análisis de un robot solo ve lo suyo', () => {
  const run = corrida({ flota: { n: 2, estrategia: 'opuestas' }, duration: 600 })
  const v = vistaRobot(run, 1)
  assert.equal(v.flota, null)
  assert.equal(v.robot.pos, run.flota.robots[1].pos)
  assert.equal(v.robot.boxes, run.flota.robots[1].boxes)
  assert.equal(v.series.cargo.at(-1), run.flota.robots[1].cargo.at(-1))
  // la corrida original no se toca: sigue con las cajas de todos los robots
  assert.equal(
    run.robot.boxes.length,
    run.flota.robots.reduce((s, r) => s + r.boxes.length, 0),
  )
  assert.ok(run.flota)
})

test('con 3 robots y 2 cosecheros, dos robots quedan sin zona: estacionados, sin atender ninguna caja', () => {
  const run = corrida({ nw: 2, flota: { n: 3, estrategia: 'zonas' }, duration: 600 })
  const h = analizarFlota(run)
  assert.equal(h.porRobot.length, 3)
  const [, b, c] = h.porRobot
  for (const a of [b, c]) assert.ok(a.fluency.robotTime.move < 0.01 && a.fluency.robotTime.acopio > 0.98, 'estacionado: no se mueve y figura esperando')
  assert.deepEqual(
    run.flota.robots.map((r) => r.boxes.length > 0),
    [true, false, false],
  )
})

test('colores y etiquetas de los robots', () => {
  assert.deepEqual([0, 1, 2].map(etiquetaRobot), ['RB-01', 'RB-02', 'RB-03'])
  assert.equal(new Set(COLORES_ROBOT).size, 3)
  assert.equal(colorRobot(0), COLORES_ROBOT[0])
  assert.equal(colorRobot(3), COLORES_ROBOT[0], 'si hubiera más robots, los colores se repiten')
})

test('filasFlota: un valor por robot y el de la flota; la fila de S_p solo con la regla de seguridad', () => {
  const run = corrida({ flota: { n: 2, estrategia: 'zonas' }, duration: 1800 })
  run.hri = analizarFlota(run)
  const filas = filasFlota(run)
  const f = (k) => filas.find((x) => x.key === k)
  for (const x of filas) assert.equal(x.robots.length, 2, x.key)
  assert.equal(f('cajas').flota, f('cajas').robots[0] + f('cajas').robots[1])
  cerca(f('entregado').flota, run.series.cargo.at(-1), 1e-2, 'entregado por la flota')
  cerca(f('energia').flota, f('energia').robots[0] + f('energia').robots[1], 1e-6, 'energía de la flota')
  cerca(f('mov').flota, (f('mov').robots[0] + f('mov').robots[1]) / 2, 1e-9, 'movimiento medio')
  assert.equal(f('sp'), undefined, 'sin regla de seguridad no hay fila de S_p')
  assert.equal(f('parado'), undefined, 'ninguno quedó estacionado: la fila opcional se omite')
  const hri = corrida({ profile: 'hri', flota: { n: 2, estrategia: 'zonas' }, duration: 600 })
  hri.hri = analizarFlota(hri)
  assert.ok(filasFlota(hri).some((x) => x.key === 'sp'))
  // dos cosecheros y tres robots: dos quedan estacionados y la fila aparece
  const sin = corrida({ nw: 2, flota: { n: 3, estrategia: 'zonas' }, duration: 600 })
  sin.hri = analizarFlota(sin)
  const p = filasFlota(sin).find((x) => x.key === 'parado')
  assert.ok(p.robots[1] > 500 && p.robots[2] > 500 && p.robots[0] === 0)
})

test('selección de robots en la escena y en la lista', () => {
  assert.deepEqual([0, 1, 2].map(selRobot), ['robot', 'robot:1', 'robot:2'])
  assert.deepEqual(['robot', 'robot:1', 'robot:2', 5, null, 'robot:x', 'robot:12'].map(robotDeSel), [0, 1, 2, -1, -1, -1, -1])
  const run = corrida({ flota: { n: 2, estrategia: 'zonas' }, duration: 300 })
  assert.equal(robotsDeRun(run).length, 2)
  assert.equal(robotsDeRun(corrida({ duration: 300 })).length, 1)
  assert.deepEqual(robotsDeRun(null), [])
})

test('los textos de la flota están traducidos al inglés y al portugués', async () => {
  const en = (await import('../../src/i18n/en/index.js')).default
  const pt = (await import('../../src/i18n/pt/index.js')).default
  const run = corrida({ nw: 2, profile: 'hri', flota: { n: 3, estrategia: 'zonas' }, duration: 600 })
  run.hri = analizarFlota(run)
  const claves = new Set([
    ...Object.values(ESTRATEGIAS).flat(),
    ...[1, 2, 3].map(nombreFlota),
    ...filasFlota(run).map((x) => x.nombre),
    ...[
      'Cantidad de robots',
      'Cómo se reparten',
      'Otra cantidad de robots',
      'Cantidad de robots de la comparación',
      'Flota',
      'Cada robot y la flota',
      'Detalle de',
    ],
    ...[
      'Cultivo a bordo de cada robot',
      'Equilibrio de cajas entre robots (Jain)',
      'Distancia mínima entre robots (toda la corrida)',
      'La mínima de toda la corrida suele darse al salir del acopio o en la cabecera, donde los robots sí pueden cruzarse.',
      'Distancia mínima entre robots (con alguno en una calle)',
    ],
    ...[
      'Esperando calle libre',
      'Cediendo el paso',
      'Entregado por la flota',
      'Calles recorridas por la flota',
      'Energía de la flota por kg entregado',
      'Estado',
    ],
  ])
  const faltan = []
  for (const k of claves) for (const [n, d] of Object.entries({ en, pt })) if (!(k in d)) faltan.push(n + ': ' + k)
  assert.deepEqual(faltan, [])
})

test('exportar: con flota, las poses de los robots 2 y 3 van en columnas propias; con un robot no cambia', () => {
  const dos = corrida({ flota: { n: 2, estrategia: 'zonas' }, duration: 120 })
  const [cab, ...filas] = posesCSV(dos).trim().split('\n')
  const cols = cab.split(',')
  assert.deepEqual(cols.slice(1, 9), ['Robot_x', 'Robot_y', 'Robot_theta_rad', 'Robot_status', 'Robot2_x', 'Robot2_y', 'Robot2_theta_rad', 'Robot2_status'])
  assert.equal(cols.includes('Robot3_x'), false)
  assert.equal(filas.length, dos.n)
  assert.ok(filas.every((f) => f.split(',').length === cols.length))
  // la fila del último tick lleva la pose del robot 2
  const ult = filas.at(-1).split(',')
  assert.equal(Number(ult[5]), Math.round(dos.flota.robots[1].pos[(dos.n - 1) * 3] * 1e6) / 1e6)
  const uno = corrida({ duration: 120 })
  assert.equal(posesCSV(uno).split('\n')[0].includes('Robot2_x'), false)
})
