// H6–H8: experimentos en lote — expansión del diseño, filas, efectos contra «sin robot» y contra 1 robot, resumen y CSV.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  COLS,
  EFECTO_COLS,
  RESUMEN_COLS,
  SIN_ROBOT,
  aCSV,
  cartesiano,
  celdas,
  clave,
  conEfectos,
  correr,
  deCSV,
  opciones,
  resumen,
} from '../../scripts/experimentos/lib.mjs'
import { FIS } from '../helpers.mjs'

test('cartesiano: todas las combinaciones, la última clave varía más rápido', () => {
  assert.deepEqual(cartesiano({ a: [1, 2], b: ['x', 'y'] }), [
    { a: 1, b: 'x' },
    { a: 1, b: 'y' },
    { a: 2, b: 'x' },
    { a: 2, b: 'y' },
  ])
  assert.deepEqual(cartesiano({}), [{}])
})

test('el diseño de H6 tiene 266 celdas deterministas y 1050 repeticiones con semilla', () => {
  const d = JSON.parse(fs.readFileSync(new URL('../../experimentos/h6.json', import.meta.url), 'utf8'))
  const [A, B] = d.bloques.map(celdas)
  assert.equal(A.filter((c) => c.semilla == null).length, 210)
  assert.equal(B.length, 56)
  assert.equal(A.filter((c) => c.semilla != null).length, 105 * 10)
  assert.ok(
    A.filter((c) => c.semilla != null).every((c) => c.duration === 2700),
    'las repeticiones son solo de 45 min',
  )
  // sin robot el perfil no aplica: una sola celda por escenario
  assert.ok(A.filter((c) => c.robot === SIN_ROBOT).every((c) => c.profile === 'matlab-2026'))
  // factores anidados: la pendiente va dentro de huertoParams
  assert.deepEqual(B[0].huertoParams, { pendiente: 0, acopioEnCima: false })
  // las 7 celdas de B en plano con el acopio al pie son las de A (alta densidad, 12, 45 min): se corren una vez
  assert.equal(new Set([...A, ...B].map(clave)).size, 1316 - 7)
})

test('opciones y clave: el robot pasa a robotTipo; HO y HR no comparten clave', () => {
  const c = { bloque: 'A', huerto: 'arandano', nw: 6, act: 'mixed', duration: 600, profile: 'hri', robot: 'burro' }
  assert.deepEqual(opciones(c), { huerto: 'arandano', nw: 6, act: 'mixed', duration: 600, profile: 'hri', robotTipo: 'burro' })
  const ho = { ...c, robot: SIN_ROBOT, profile: 'matlab-2026' }
  assert.equal(opciones(ho).robotTipo, undefined)
  assert.match(clave(c), /\|HR\|[0-9a-f]{8}$/)
  assert.match(clave(ho), /\|HO\|/)
  assert.notEqual(clave(c), clave({ ...c, semilla: 1 }))
})

test('correr: una fila por corrida, con métricas de robot solo cuando hay robot; efectos contra «sin robot»', () => {
  const base = { bloque: 'T', huerto: 'palta-alta-densidad', nw: 6, act: 'mixed', duration: 600, profile: 'matlab-2026' }
  const ho = correr({ ...base, robot: SIN_ROBOT }, FIS),
    hr = correr({ ...base, robot: 'burro' }, FIS)
  for (const f of [ho, hr]) assert.deepEqual(Object.keys(f), COLS)
  assert.equal(ho.energia_Wh, '')
  assert.ok(hr.energia_Wh > 0)
  assert.equal(hr.robot, 'burro')
  assert.ok(hr.cosecha_kg > 0 && ho.cosecha_kg > 0)
  assert.equal(hr.kg_por_cosechero_8h, +(((hr.cosecha_kg / 6) * 8 * 3600) / 600).toFixed(1))
  const [e0, e1] = conEfectos([ho, hr])
  assert.equal(e0.efecto_entregado_pct, '')
  assert.equal(e1.efecto_cosecha_pct, +((100 * (hr.cosecha_kg - ho.cosecha_kg)) / ho.cosecha_kg).toFixed(2))
  // ida y vuelta por CSV (la caché del script)
  const cols = [...COLS, ...EFECTO_COLS]
  const back = deCSV(aCSV([e0, e1], cols))
  assert.equal(back.length, 2)
  assert.equal(back[1].clave, hr.clave)
  assert.equal(+back[1].efecto_cosecha_pct, e1.efecto_cosecha_pct)
  assert.deepEqual(deCSV(''), [])
})

test('el diseño de H7: 2125 celdas, 2000 corridas distintas (las celdas repetidas entre bloques se corren una vez)', () => {
  const d = JSON.parse(fs.readFileSync(new URL('../../experimentos/h7.json', import.meta.url), 'utf8'))
  const [A, B, C] = d.bloques.map(celdas)
  assert.equal(A.length, 320 + 160 * 5)
  assert.equal(B.length, 270 + 135 * 5)
  assert.equal(C.length, 60)
  assert.equal(new Set([...A, ...B, ...C].map(clave)).size, 2000)
  // opciones ausentes (null, avance 0) no cambian la clave: son la corrida de siempre
  const c = { bloque: 'X', huerto: 'uva-parron', nw: 12, act: 'mixed', duration: 600, profile: 'hri', robot: 'warthog' }
  assert.equal(clave({ ...c, acopio: null, carga: null, reparto: null, avance: 0 }), clave(c))
})

test('correr con las opciones de H7: acopio, carga, reparto y avance en la fila; efectos contra su propia corrida sin robot', () => {
  const base = {
    bloque: 'T',
    huerto: 'palta-alta-densidad',
    nw: 6,
    act: 'mixed',
    duration: 600,
    profile: 'hri',
    acopio: {},
    carga: {},
    avance: 0.5,
    reparto: { modo: 'frente' },
  }
  const ho = correr({ ...base, robot: SIN_ROBOT }, FIS),
    hr = correr({ ...base, robot: 'warthog' }, FIS)
  assert.equal(hr.acopiador, 1)
  assert.equal(hr.carga_variable, 1)
  assert.equal(hr.reparto, 'frente')
  assert.equal(hr.avance_pct, 50)
  assert.ok(hr.caminata_media_m > 0 && ho.caminata_media_m > 0)
  assert.ok(hr.calles_robot >= 1)
  assert.ok(hr.acopiador_ocupado_pct >= 0 && hr.despachado_kg >= 0)
  assert.equal(ho.calles_robot, '')
  // la referencia sin robot de una corrida con avance es la del mismo avance (no la de avance 0)
  const otro = correr({ ...base, avance: 0, robot: SIN_ROBOT }, FIS)
  const [, e] = conEfectos([otro, ho, hr])
  assert.equal(e.efecto_cosecha_pct, '', 'la fila sin robot no tiene efecto')
  const conE = conEfectos([otro, ho, hr]).at(-1)
  assert.equal(conE.efecto_cosecha_pct, +((100 * (hr.cosecha_kg - ho.cosecha_kg)) / ho.cosecha_kg).toFixed(2))
})

test('el diseño de H8: 3240 corridas en el bloque A y 288 más en el de sensibilidad (sus referencias son las de A)', () => {
  const d = JSON.parse(fs.readFileSync(new URL('../../experimentos/h8.json', import.meta.url), 'utf8'))
  const [A, S] = d.bloques.map(celdas)
  // 6 huertos × (sin robot + 2 tipos × 7 flotas) × 3 avances × 2 cuadrillas, cada una con la corrida de siempre y 5 semillas
  assert.equal(A.length, 6 * 15 * 3 * 2 * 6)
  assert.ok(A.every((c) => c.duration === 14400))
  // sin robot la flota no aplica: una sola celda por escenario
  assert.ok(A.filter((c) => c.robot === SIN_ROBOT).every((c) => !('flota' in c)))
  assert.equal(A.filter((c) => c.robot === SIN_ROBOT).length, 6 * 3 * 2 * 6)
  assert.equal(S.length, 2 * 16 * 2 * 6)
  const kA = new Set(A.map(clave))
  assert.equal(kA.size, A.length)
  assert.equal(new Set([...A, ...S].map(clave)).size, 3240 + 2 * 12 * 2 * 6)
  // la flota de 1 robot es la corrida de siempre: misma clave que sin la opción
  const c = { bloque: 'X', huerto: 'cerezo-ufo', nw: 12, act: 'mixed', duration: 600, profile: 'hri', robot: 'warthog' }
  assert.equal(clave({ ...c, flota: null }), clave(c))
  assert.notEqual(clave({ ...c, flota: { n: 2, estrategia: 'zonas' } }), clave(c))
})

test('correr con flota (H8): robots, estrategia y métricas de la flota en la fila; efecto contra 1 robot; resumen de las semillas', () => {
  const base = { bloque: 'T', huerto: 'palta-alta-densidad', nw: 6, act: 'mixed', duration: 600, profile: 'hri' }
  const ho = correr({ ...base, robot: SIN_ROBOT }, FIS),
    uno = correr({ ...base, robot: 'warthog', flota: null }, FIS),
    dos = correr({ ...base, robot: 'warthog', flota: { n: 2, estrategia: 'zonas' } }, FIS)
  for (const f of [ho, uno, dos]) assert.deepEqual(Object.keys(f), COLS)
  assert.deepEqual([ho.robots, uno.robots, dos.robots], [0, 1, 2])
  assert.deepEqual([ho.estrategia, uno.estrategia, dos.estrategia], ['', '', 'zonas'])
  assert.deepEqual([dos.ceder_m, dos.reserva_m, dos.espera_acopio_dist_m], [2, 3, 3])
  assert.equal(uno.jain_cajas, '')
  assert.ok(dos.jain_cajas > 0 && dos.jain_cajas <= 1)
  assert.ok(dos.espera_calle_s >= 0 && dos.cede_s >= 0 && dos.estacionado_s >= 0 && dos.espera_acopio_s >= 0)
  assert.ok(uno.recorrido_m > 0 && dos.recorrido_m > 0)
  assert.equal(ho.recorrido_m, '')
  const [e0, e1, e2] = conEfectos([ho, uno, dos])
  assert.equal(e0.efecto1_entregado_pct, '')
  assert.equal(e1.efecto1_entregado_pct, '', '1 robot no se compara consigo mismo')
  assert.ok(e1.efecto_entregado_pct !== '')
  assert.equal(e2.efecto1_cosecha_pct, +((100 * (dos.cosecha_kg - uno.cosecha_kg)) / uno.cosecha_kg).toFixed(2))
  // resumen: una fila por celda (la semilla no la distingue), con media y rango
  const s1 = { ...e2, semilla: 1, entregado_kg: e2.entregado_kg + 10 }
  const res = resumen([e1, e2, s1])
  assert.equal(res.length, 2)
  assert.deepEqual(Object.keys(res[0]), RESUMEN_COLS)
  const r2 = res.find((r) => r.robots === 2)
  assert.equal(r2.corridas, 2)
  assert.equal(r2.entregado_kg_min, e2.entregado_kg)
  assert.equal(r2.entregado_kg_max, e2.entregado_kg + 10)
  assert.equal(r2.entregado_kg_media, +(e2.entregado_kg + 5).toFixed(3))
  assert.equal(r2.entregado_pct_min, +((100 * e2.entregado_kg) / e2.cosecha_kg).toFixed(3))
  assert.equal(res.find((r) => r.robots === 1).jain_cajas_media, '')
  // también desde la caché (CSV con texto)
  const back = deCSV(aCSV([e1, e2, s1], [...COLS, ...EFECTO_COLS]))
  assert.deepEqual(
    resumen(back).map((r) => r.entregado_kg_media),
    res.map((r) => r.entregado_kg_media),
  )
})
