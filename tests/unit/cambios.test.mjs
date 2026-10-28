// ui-p1: qué cambió desde la última simulación (P1-c) y formato de números y duraciones (P2).
import test from 'node:test'
import assert from 'node:assert/strict'
import { camposCambiados } from '../../src/workload/cambios.js'
import { profileDefaults } from '../../src/hrsim/common.js'
import { fmtDur, fmtFix, setLang } from '../../src/i18n/index.js'

const AD = profileDefaults('matlab-2026', 'palta-alta-densidad', 'warthog')
const clave = (p, cfg = { nw: 12, row: 3, act: 'mixed', rp: 0 }, cmp = 'sinrobot') => ({ ...p, ...cfg, cmp })

test('sin cambios, nada; la cuadrilla se nombra primero y sin repetir', () => {
  assert.deepEqual(camposCambiados(clave(AD), clave(AD)), [])
  assert.deepEqual(camposCambiados(null, clave(AD)), [])
  const ahora = clave({ ...AD, duration: 600 }, { nw: 16, row: 3, act: 'ground', rp: 0 })
  assert.deepEqual(camposCambiados(clave(AD), ahora), ['Cosecheros', 'Actividad', 'Duración (s)'])
})

test('los objetos anidados se nombran por campo; activarlos o quitarlos, por su nombre', () => {
  const hp = { ...AD, huertoParams: { ...AD.huertoParams, hileras: 3, pendiente: 10 } }
  assert.deepEqual(camposCambiados(clave(AD), clave(hp)), ['Hileras', 'Pendiente a lo largo de las hileras (%)'])
  assert.deepEqual(camposCambiados(clave(AD), clave({ ...AD, acopio: { binKg: 400 } })), ['Acopio'])
  assert.deepEqual(camposCambiados(clave({ ...AD, acopio: { binKg: 400 } }), clave({ ...AD, acopio: { binKg: 500 } })), ['Capacidad del bin (kg)'])
  assert.deepEqual(camposCambiados(clave(AD), clave(AD, undefined, 'perfil')), ['Comparar con'])
  // un campo sin etiqueta conocida se nombra por su clave
  assert.deepEqual(camposCambiados(clave(AD), clave({ ...AD, inventado: { x: 2 } })), ['inventado'])
  // flota de robots (H8): activarla o quitarla se nombra por su etiqueta; luego, por campo
  const dos = { ...AD, flota: { n: 2, estrategia: 'zonas' } }
  assert.deepEqual(camposCambiados(clave(AD), clave(dos)), ['Cantidad de robots'])
  assert.deepEqual(camposCambiados(clave(dos), clave({ ...dos, flota: { n: 3, estrategia: 'zonas' } })), ['Cantidad de robots'])
  assert.deepEqual(camposCambiados(clave(dos), clave({ ...dos, flota: { n: 2, estrategia: 'desfase' } })), ['Cómo se reparten'])
  assert.deepEqual(camposCambiados(clave(dos), clave(dos, undefined, 'flota:1')), ['Comparar con'])
})

test('con otro huerto, sus medidas no se nombran aparte; el robot y su energía son un solo nombre', () => {
  const otro = profileDefaults('matlab-2026', 'palta-tradicional', 'warthog')
  assert.equal(camposCambiados(clave(AD), clave(otro)).includes('Hileras'), false)
  assert.equal(camposCambiados(clave(AD), clave(otro))[0], 'Sistema')
  const burro = profileDefaults('matlab-2026', 'palta-alta-densidad', 'burro')
  const c = camposCambiados(clave(AD), clave(burro))
  assert.equal(c.filter((x) => x === 'Robot').length, 1)
})

test('duraciones con una sola regla y decimales en el formato del idioma', () => {
  setLang('es')
  assert.equal(fmtDur(48.2), '48 s')
  assert.equal(fmtDur(59.6), '1 min')
  assert.equal(fmtDur(750), '12,5 min')
  assert.equal(fmtDur(3599), '1 h 00 min')
  assert.equal(fmtDur(7500), '2 h 05 min')
  assert.equal(fmtDur(NaN), '—')
  assert.equal(fmtFix(0.4949, 2), '0,49')
  assert.equal(fmtFix(3, 1), '3,0')
  setLang('en')
  assert.equal(fmtDur(750), '12.5 min')
  assert.equal(fmtFix(0.4949, 2), '0.49')
  setLang('es')
})
