// I2: enlace reproducible — la URL describe la corrida y al leerla se obtienen los mismos parámetros.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readRunState, writeRunState } from '../../src/workload/urlState.js'
import { profileDefaults, paramsHash, resolveParams } from '../../src/hrsim/common.js'

const CFG0 = { nw: 12, row: 3, act: 'mixed', rp: 0 }

test('ida y vuelta: parámetros modificados (también anidados) y configuración', () => {
  const p = profileDefaults('hri', 'palta-alta-densidad', 'burro')
  p.duration = 600
  p.maxBoxStopsPerLap = 7
  p.huertoParams = { ...p.huertoParams, pendiente: 12, acopioEnCima: true }
  p.ssm = { ...p.ssm, vh: 2 }
  p.costs = { ...p.costs, walking: 0.05 }
  const cfg = { nw: 8, row: 3, act: 'ground', rp: 0 }
  const sp = writeRunState(new URLSearchParams('look=schem&huerto=viejo&lang=en'), p, cfg)
  assert.equal(sp.get('look'), 'schem', 'las demás claves se conservan')
  assert.equal(sp.get('lang'), 'en')
  assert.equal(sp.get('huerto'), 'palta-alta-densidad')
  assert.equal(sp.get('robot'), 'burro')
  assert.equal(sp.get('perfil'), 'hri')
  assert.equal(sp.get('dur'), '600')
  assert.equal(sp.has('row'), false, 'fila y disposición solo en el mapa del estudio')
  assert.match(sp.get('ajustes'), /^[A-Za-z0-9_-]+$/, 'base64url, sin caracteres que escapar')
  const r = readRunState(new URLSearchParams(sp.toString()), CFG0)
  assert.equal(r.error, null)
  assert.deepEqual(r.params, p)
  assert.deepEqual(r.cfg, cfg)
  // misma corrida: mismos parámetros resueltos
  assert.equal(paramsHash(resolveParams({ ...r.params, ...r.cfg })), paramsHash(resolveParams({ ...p, ...cfg })))
})

test('sin cambios no hay «ajustes»; el mapa del estudio guarda fila y disposición', () => {
  const p = profileDefaults('matlab-2026')
  const sp = writeRunState(new URLSearchParams(), p, { nw: 6, row: 1, act: 'ladder', rp: 1 })
  assert.equal(sp.has('ajustes'), false)
  assert.equal(sp.has('robot'), false)
  assert.equal(sp.get('row'), '1')
  const r = readRunState(sp, CFG0)
  assert.deepEqual(r.params, p)
  assert.deepEqual(r.cfg, { nw: 6, row: 1, act: 'ladder', rp: 1 })
})

test('una URL sin corrida devuelve null; ?perfil=hri sola sigue abriendo el perfil HRI', () => {
  assert.equal(readRunState(new URLSearchParams('look=schem'), CFG0), null)
  const r = readRunState(new URLSearchParams('perfil=hri'), CFG0)
  assert.deepEqual(r.params, profileDefaults('hri'))
  assert.deepEqual(r.cfg, CFG0)
})

test('valores inválidos se ignoran y se informan', () => {
  const r = readRunState(new URLSearchParams('huerto=marte&perfil=x&robot=tractor&nw=99&row=7&rp=2&act=volar&dur=-5&ajustes=%%%'), CFG0)
  assert.deepEqual(r.params, profileDefaults('matlab-2026'))
  assert.deepEqual(r.cfg, CFG0)
  assert.deepEqual(r.error.sort(), ['act', 'ajustes', 'dur', 'huerto', 'nw', 'perfil', 'robot', 'row', 'rp'].sort())
  // un ajuste de una clave desconocida o de las que viajan aparte no entra
  const aj = Buffer.from(JSON.stringify({ inventado: 1, huerto: 'arandano', walkSpeed: 0.9 })).toString('base64url')
  const r2 = readRunState(new URLSearchParams(`huerto=uva-parron&ajustes=${aj}`), CFG0)
  assert.equal(r2.params.huerto, 'uva-parron')
  assert.equal(r2.params.walkSpeed, 0.9)
  assert.equal('inventado' in r2.params, false)
})

test('H7: el acopio y la carga (opciones ausente en los valores de partida) viaja en `ajustes` y vuelve igual', async () => {
  const { ACOPIO_DEFAULTS } = await import('../../src/hrsim/acopio.js')
  const p = profileDefaults('hri', 'palta-alta-densidad', 'warthog')
  p.acopio = { ...ACOPIO_DEFAULTS, camionBins: 6 }
  p.carga = { cv: 0.4, k: 460, umbral: 2.5 }
  p.reparto = { modo: 'frente', tramo: 6 }
  p.avance = 0.25
  const sp = writeRunState(new URLSearchParams(), p, CFG0)
  const r = readRunState(new URLSearchParams(sp.toString()), CFG0)
  assert.equal(r.error, null)
  assert.deepEqual(r.params.acopio, p.acopio)
  assert.deepEqual(r.params.carga, p.carga)
  assert.deepEqual(r.params.reparto, p.reparto)
  assert.equal(r.params.avance, 0.25)
  assert.equal(paramsHash(resolveParams(r.params)), paramsHash(resolveParams(p)))
  // sin acopio no aparece
  delete p.acopio
  delete p.carga
  delete p.reparto
  delete p.avance
  const r2 = readRunState(new URLSearchParams(writeRunState(new URLSearchParams(), p, CFG0).toString()), CFG0)
  assert.equal('acopio' in r2.params, false)
})
