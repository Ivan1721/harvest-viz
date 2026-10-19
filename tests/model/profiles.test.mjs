// Perfiles de modelo: matlab-2026 es la réplica congelada (por defecto); hri la extiende.
import test from 'node:test'
import assert from 'node:assert/strict'
import { HRSim } from '../../src/hrsim/engine.js'
import { HOSim } from '../../src/hrsim/humanonly.js'
import { DEFAULTS, PROFILES, profileDefaults, resolveParams, paramsHash } from '../../src/hrsim/common.js'
import { FIS } from '../helpers.mjs'

test('el perfil por defecto es la réplica de MATLAB', () => {
  assert.equal(DEFAULTS.profile, 'matlab-2026')
  assert.equal(resolveParams({}).profile, 'matlab-2026')
  assert.deepEqual(PROFILES['matlab-2026'].params, {}, 'el perfil congelado no cambia ningún parámetro de MATLAB')
  assert.equal(resolveParams({}).ssm, undefined, 'la réplica no tiene regla de seguridad (y su hash no cambia)')
})

test('orden de aplicación: DEFAULTS → perfil → opciones explícitas; perfil desconocido da error', () => {
  const p = resolveParams({ profile: 'hri', walkSpeed: 1.1 })
  assert.equal(p.profile, 'hri')
  assert.equal(p.walkSpeed, 1.1)
  assert.throws(() => resolveParams({ profile: 'otro' }), /perfil "otro" desconocido/)
  assert.equal(profileDefaults('hri').profile, 'hri')
  assert.notEqual(profileDefaults('hri'), profileDefaults('hri'), 'copia nueva cada vez (el formulario la modifica)')
})

test('el perfil queda en los parámetros y en el hash (trazabilidad)', () => {
  const a = resolveParams({}),
    b = resolveParams({ profile: 'hri' })
  assert.notEqual(paramsHash(a), paramsHash(b))
})

test('con sus extensiones apagadas (regla de seguridad y corrección del bucle de llamada), el perfil hri da exactamente lo mismo que matlab-2026', () => {
  const cfg = { nw: 6, row: 2, act: 'mixed', rp: 1, duration: 600 }
  const off = new HRSim({ ...cfg, profile: 'hri', ssm: { enabled: false }, fixRecallLoop: false }, FIS).run(),
    ref = new HRSim(cfg, FIS).run()
  assert.deepEqual(off.summary(), ref.summary())
  assert.deepEqual(off.rec.rx, ref.rec.rx)
  assert.deepEqual(off.rec.rst, ref.rec.rst)
  assert.deepEqual(new HOSim({ ...cfg, profile: 'hri' }).run().summary(), new HOSim(cfg).run().summary())
})
