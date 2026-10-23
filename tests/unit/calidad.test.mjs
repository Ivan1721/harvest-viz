// R1: calidad de la escena 3D (alta / básica) y su detección de WebGL por software.
import test from 'node:test'
import assert from 'node:assert/strict'
import { calidadInicial, esSoftware, guardarCalidad, opacidadInicial } from '../../src/workload/calidad.js'

const memoria = (inicial = {}) => {
  const m = new Map(Object.entries(inicial))
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }
}
const qs = (s) => new URLSearchParams(s)

test('WebGL por software: SwiftShader (CI, Chrome sin GPU), llvmpipe (Linux) y el adaptador básico de Windows', () => {
  for (const r of [
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'Google SwiftShader',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
    'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)',
  ])
    assert.equal(esSoftware(r), true, r)
  for (const r of ['ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Ti (0x00002182) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'Apple M2', 'Mali-G78'])
    assert.equal(esSoftware(r), false, r)
})

test('calidad al abrir: ?calidad= manda, luego la guardada y, si no, la que permite el equipo', () => {
  const gpu = 'NVIDIA GeForce GTX 1660 Ti',
    sw = 'Google SwiftShader'
  assert.equal(
    calidadInicial(qs(''), () => memoria(), gpu),
    'alta',
  )
  assert.equal(
    calidadInicial(qs(''), () => memoria(), sw),
    'basica',
  )
  assert.equal(
    calidadInicial(qs(''), () => memoria(), null),
    'basica',
    'sin WebGL',
  )
  assert.equal(
    calidadInicial(qs(''), () => memoria({ 'hv-calidad': 'basica' }), gpu),
    'basica',
    'la elegida antes',
  )
  assert.equal(
    calidadInicial(qs('calidad=alta'), () => memoria({ 'hv-calidad': 'basica' }), sw),
    'alta',
    'la URL manda',
  )
  assert.equal(
    calidadInicial(qs('calidad=otra'), () => memoria({ 'hv-calidad': 'rara' }), gpu),
    'alta',
    'valores inválidos se ignoran',
  )
  const roto = () => {
    throw new Error('sin almacenamiento')
  }
  assert.equal(calidadInicial(qs(''), roto, gpu), 'alta')
  assert.doesNotThrow(() => guardarCalidad(roto, 'alta'))
  const st = memoria()
  guardarCalidad(() => st, 'basica')
  assert.equal(st.m.get('hv-calidad'), 'basica')
})

test('follaje: más opaco de partida en alta (decisión 4 del diseño 3D)', () => {
  assert.equal(opacidadInicial('alta'), 0.8)
  assert.equal(opacidadInicial('basica'), 0.42)
})
