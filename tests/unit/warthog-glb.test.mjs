// R2: el Warthog de la escena (public/modelos/warthog.glb) mide lo que dice el manual, tiene sus ruedas como nodos y
// lleva el aviso de copyright de Clearpath (BSD-3).
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const buf = fs.readFileSync(new URL('../../public/modelos/warthog.glb', import.meta.url))

/** JSON del GLB (primer bloque) y posiciones mínima/máxima de cada malla. */
function leer(b) {
  assert.equal(b.readUInt32LE(0), 0x46546c67, 'firma glTF')
  assert.equal(b.readUInt32LE(4), 2, 'glTF 2.0')
  assert.equal(b.readUInt32LE(8), b.length, 'largo declarado')
  const n = b.readUInt32LE(12)
  assert.equal(b.readUInt32LE(16), 0x4e4f534a, 'bloque JSON')
  return JSON.parse(b.subarray(20, 20 + n).toString('utf8'))
}

test('Warthog: medidas del manual (1,52 × 1,38 m, neumático de 0,61 m), origen en el suelo y peso acotado', () => {
  const g = leer(buf)
  const pos = (m) => g.accessors[g.meshes[m].primitives[0].attributes.POSITION]
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity]
  const rueda = g.meshes.findIndex((m) => m.name === 'rueda')
  const caja = (a, t = [0, 0, 0]) => a.min.forEach((v, k) => ((min[k] = Math.min(min[k], v + t[k])), (max[k] = Math.max(max[k], a.max[k] + t[k]))))
  for (const nd of g.nodes) caja(pos(nd.mesh), nd.translation)
  const [largo, alto, ancho] = [0, 1, 2].map((k) => max[k] - min[k])
  assert.ok(Math.abs(largo - 1.52) < 0.02, `largo ${largo}`)
  assert.ok(Math.abs(ancho - 1.38) < 0.03, `ancho ${ancho}`)
  assert.ok(alto > 0.83 && alto < 1.2, `alto ${alto} (con antenas)`)
  assert.ok(Math.abs(min[1]) < 1e-3, 'el origen está en el suelo')
  const r = pos(rueda)
  assert.ok(Math.abs(r.max[1] - r.min[1] - 0.61) < 0.01, 'diámetro del neumático')
  assert.ok(buf.length < 700 * 1024, `${buf.length} bytes`)
})

test('Warthog: cuatro ruedas como nodos que comparten malla, a ±0,457 m y en los dos lados', () => {
  const g = leer(buf)
  const ruedas = g.nodes.filter((n) => n.name.startsWith('rueda_'))
  assert.equal(ruedas.length, 4)
  assert.equal(new Set(ruedas.map((n) => n.mesh)).size, 1)
  for (const n of ruedas) assert.ok(Math.abs(Math.abs(n.translation[0]) - 0.457367) < 1e-4, n.name)
  assert.deepEqual(ruedas.map((n) => Math.sign(n.translation[2])).sort(), [-1, -1, 1, 1])
  // izquierda del robot = −z (el lado derecho es +z, como en el modelo simple)
  for (const n of ruedas) assert.equal(n.name.endsWith('_der'), n.translation[2] > 0, n.name)
})

test('Warthog: lleva el aviso de copyright de Clearpath y su ficha la licencia BSD-3 completa', () => {
  assert.match(leer(buf).asset.copyright, /Clearpath Robotics Inc\. BSD-3-Clause/)
  const leeme = fs.readFileSync(new URL('../../public/modelos/LEEME.md', import.meta.url), 'utf8')
  assert.match(leeme, /Copyright 2021 Clearpath Robotics Inc\./)
  assert.match(leeme, /Neither the name of the copyright holder/)
})
