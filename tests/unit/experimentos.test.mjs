// H6: experimentos en lote — expansión del diseño, filas, efectos contra «sin robot» y CSV.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { COLS, EFECTO_COLS, SIN_ROBOT, aCSV, cartesiano, celdas, clave, conEfectos, correr, deCSV, opciones } from '../../scripts/experimentos/lib.mjs'
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
