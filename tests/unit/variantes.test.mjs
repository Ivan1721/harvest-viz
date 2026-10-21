// I4: «Comparar con» — parámetros y nombres de la segunda corrida.
import test from 'node:test'
import assert from 'node:assert/strict'
import { CMP_DEFAULT, cmpValido, comportamiento, robotVariante, variante } from '../../src/workload/variantes.js'
import { profileDefaults, resolveParams } from '../../src/hrsim/common.js'
import { readRunState, writeRunState } from '../../src/workload/urlState.js'

const AD = profileDefaults('matlab-2026', 'palta-alta-densidad', 'warthog')

test('sin robot no hay variante; otro robot solo en huertos generados', () => {
  assert.equal(CMP_DEFAULT, 'sinrobot')
  assert.equal(variante('sinrobot', AD), null)
  assert.equal(cmpValido('robot:burro', profileDefaults('matlab-2026')), false)
  assert.equal(variante('robot:burro', profileDefaults('matlab-2026')), null)
  assert.equal(cmpValido('robot:tractor', AD), false)
  assert.equal(cmpValido('perfil', profileDefaults('matlab-2026')), true)
})

test('otro robot: cambia el robot, su capacidad real y su energía; el resto queda igual', () => {
  const p = { ...AD, walkSpeed: 0.9 }
  const v = variante('robot:burro-carro', p)
  assert.equal(v.params.robotTipo, 'burro-carro')
  assert.equal(v.params.capacityBoxes, 26)
  assert.equal(v.params.energia.paux, 30)
  assert.equal(v.params.walkSpeed, 0.9)
  assert.deepEqual(v.labels, { ho: 'Burro con carro', hr: 'Warthog' })
  resolveParams(v.params) // válido para el motor
  // si coincide con el robot principal, se toma el primero distinto
  assert.equal(robotVariante('robot:warthog', p), 'burro')
  assert.equal(robotVariante('', { ...p, robotTipo: 'burro' }), 'warthog')
})

test('otro comportamiento: el otro perfil con las modificaciones del usuario', () => {
  const p = { ...AD, loadTimePerBox: 5 }
  const v = variante('perfil', p)
  assert.equal(v.params.profile, 'hri')
  assert.equal(v.params.ssm.enabled, true)
  assert.equal(v.params.loadTimePerBox, 5, 'conserva lo modificado')
  assert.deepEqual(v.labels, { ho: 'Con regla de seguridad', hr: 'Como en MATLAB' })
  const vuelta = variante('perfil', profileDefaults('hri', 'palta-alta-densidad'))
  assert.equal(vuelta.params.profile, 'matlab-2026')
  assert.equal('ssm' in vuelta.params, false)
  assert.equal(comportamiento('hri'), 'Con regla de seguridad')
  resolveParams(v.params)
})

test('la comparación viaja en el enlace', () => {
  const sp = writeRunState(new URLSearchParams(), AD, { nw: 12, row: 3, act: 'mixed', rp: 0 }, 'robot:burro')
  assert.equal(sp.get('cmp'), 'robot:burro')
  assert.equal(readRunState(sp, { nw: 12, row: 3, act: 'mixed', rp: 0 }).cmp, 'robot:burro')
  assert.equal(writeRunState(new URLSearchParams(), AD, { nw: 12, row: 3, act: 'mixed', rp: 0 }).has('cmp'), false)
  const malo = readRunState(new URLSearchParams('huerto=arandano&cmp=robot:tractor'), { nw: 12, row: 3, act: 'mixed', rp: 0 })
  assert.equal(malo.cmp, 'sinrobot')
  assert.deepEqual(malo.error, ['cmp'])
})
