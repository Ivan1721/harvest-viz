// Prototipo R3 (diseño «escena 3D más realista»): tres formas de dibujar un palto, para comparar.
//   actual: el palto de hoy (esferas de follaje, src/shared/realistic.jsx)
//   ezt:    ez-tree (MIT) con parámetros de palto: ramas reales y tarjetas de hoja
//   propio: nuestro generador + tarjetas de hoja sobre la superficie de las esferas (las esferas, más oscuras, dan volumen)
// Cada uno devuelve geometrías unidas por material para instanciarlas: el huerto entero cuesta pocas llamadas de dibujo.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Tree } from '@dgreenheck/ez-tree'
import { avocadoParts } from '../../src/shared/realistic.jsx'

const R0 = 3.25 // radio de copa del palto modelo (mapa del estudio)
const H0 = 5.6 // altura del palto modelo

const mulberry = (a) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Hoja de palto Hass dibujada en un canvas: elíptica y entera, ápice agudo, nervio central y nervios laterales. */
export function texturaHoja() {
  const W = 128,
    H = 256
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const hoja = new Path2D()
  hoja.moveTo(W / 2, 6)
  hoja.bezierCurveTo(W * 0.98, H * 0.2, W * 0.95, H * 0.72, W / 2, H - 22)
  hoja.bezierCurveTo(W * 0.05, H * 0.72, W * 0.02, H * 0.2, W / 2, 6)
  const gr = g.createLinearGradient(0, 0, W, 0)
  gr.addColorStop(0, '#3d6b30')
  gr.addColorStop(0.5, '#5a8f42')
  gr.addColorStop(1, '#386329')
  g.fillStyle = gr
  g.fill(hoja)
  g.save()
  g.clip(hoja)
  g.strokeStyle = 'rgba(190,210,120,0.55)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(W / 2, 8)
  g.lineTo(W / 2, H) // nervio central y pecíolo
  g.stroke()
  g.lineWidth = 1.2
  g.strokeStyle = 'rgba(190,210,120,0.3)'
  for (let k = 1; k < 9; k++) {
    const y = 24 + k * 22
    for (const s of [-1, 1]) {
      g.beginPath()
      g.moveTo(W / 2, y)
      g.quadraticCurveTo(W / 2 + s * 30, y - 6, W / 2 + s * 52, y - 22)
      g.stroke()
    }
  }
  g.restore()
  // pecíolo bajo la lámina
  g.strokeStyle = '#4a5a2a'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(W / 2, H - 22)
  g.lineTo(W / 2, H - 2)
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** Racimo: una tarjeta con ~14 hojas de palto dibujadas en distintas posiciones y giros (técnica de follaje de juegos). */
export function texturaRacimo(hoja) {
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d'),
    rnd = mulberry(99)
  const img = hoja.image
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2,
      d = Math.sqrt(rnd()) * S * 0.3
    g.save()
    g.translate(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d)
    g.rotate(a + Math.PI / 2 + (rnd() - 0.5) * 0.8)
    const k = 0.75 + rnd() * 0.45
    g.globalAlpha = 1
    g.filter = `brightness(${0.75 + rnd() * 0.45})`
    g.drawImage(img, (-img.width * k) / 2, -img.height * k, img.width * k, img.height * k)
    g.restore()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

const matHoja = (map) => new THREE.MeshStandardMaterial({ map, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0 })
const matCorteza = () => new THREE.MeshStandardMaterial({ color: '#5f4a35', roughness: 1 })

/** Palto de hoy: esferas de follaje, ramas y tronco (sin frutos para comparar solo el follaje). */
export function paltoActual(seed) {
  const a = avocadoParts(R0, seed)
  const esfera = new THREE.SphereGeometry(1, 14, 10)
  const blobs = a.blobs.map((b) =>
    esfera
      .clone()
      .scale(b.r, b.r * b.sy, b.r)
      .translate(b.x, b.y, b.z),
  )
  const verdes = ['#4a8a42', '#56994a', '#63a552', '#3f7c3c', '#5a9d4c']
  const col = []
  blobs.forEach((g, i) => {
    const c = new THREE.Color(verdes[a.blobs[i].c])
    for (let k = 0; k < g.attributes.position.count; k++) col.push(c.r, c.g, c.b)
  })
  const follaje = mergeGeometries(blobs)
  follaje.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return [
    { geo: follaje, mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, transparent: true, opacity: 0.8, depthWrite: false }) },
    { geo: troncoYRamas(a), mat: matCorteza() },
  ]
}

function troncoYRamas(a) {
  const piezas = [new THREE.CylinderGeometry(0.16, 0.28, 1.9, 10).translate(0, 0.95, 0)]
  for (const l of a.limbs) {
    const g = new THREE.CylinderGeometry(0.07, 0.14, l.len, 8).translate(0, l.len / 2, 0)
    g.rotateZ(-Math.cos(l.a) * l.tilt)
    g.rotateX(Math.sin(l.a) * l.tilt)
    g.translate(0, 1.85, 0)
    piezas.push(g)
  }
  return mergeGeometries(piezas)
}

/**
 * Nuestro generador + hojas: miles de tarjetas de hoja sobre la superficie de las esferas, orientadas hacia afuera con
 * giro al azar; las esferas quedan adentro, opacas y más oscuras (la sombra del interior de una copa densa).
 */
export function paltoPropio(seed, mapHoja, { hojas = 700 } = {}) {
  const a = avocadoParts(R0, seed)
  const rnd = mulberry(seed * 31 + 7)
  const esfera = new THREE.SphereGeometry(0.88, 10, 8)
  const interior = mergeGeometries(
    a.blobs.map((b) =>
      esfera
        .clone()
        .scale(b.r, b.r * b.sy, b.r)
        .translate(b.x, b.y, b.z),
    ),
  )
  const tarjeta = new THREE.PlaneGeometry(0.75, 0.75).translate(0, 0.3, 0) // racimo de ~75 cm (ver texturaRacimo)
  const area = a.blobs.map((b) => b.r * b.r)
  const total = area.reduce((s, x) => s + x, 0)
  const piezas = [],
    n = new THREE.Vector3(),
    q = new THREE.Quaternion(),
    m = new THREE.Matrix4(),
    up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < hojas; i++) {
    // esfera elegida en proporción a su superficie; punto en su superficie, sesgado hacia arriba y afuera (luz)
    let u = rnd() * total,
      k = 0
    while (u > area[k]) u -= area[k++]
    const b = a.blobs[k]
    const th = rnd() * 2 * Math.PI,
      z = 2 * Math.pow(rnd(), 0.7) - 1
    n.set(Math.sqrt(1 - z * z) * Math.cos(th), z, Math.sqrt(1 - z * z) * Math.sin(th))
    const p = new THREE.Vector3(b.x + n.x * b.r, b.y + n.y * b.r * b.sy, b.z + n.z * b.r)
    // la hoja apunta hacia afuera y cae un poco (el pecíolo sostiene una lámina inclinada)
    const dir = n
      .clone()
      .add(new THREE.Vector3((rnd() - 0.5) * 0.9, -0.35 - rnd() * 0.4, (rnd() - 0.5) * 0.9))
      .normalize()
    q.setFromUnitVectors(up, dir)
    q.multiply(new THREE.Quaternion().setFromAxisAngle(up, rnd() * Math.PI * 2))
    const s = 0.8 + rnd() * 0.5
    m.compose(p, q, new THREE.Vector3(s, s, s))
    piezas.push(tarjeta.clone().applyMatrix4(m))
  }
  return [
    { geo: mergeGeometries(piezas), mat: matHoja(mapHoja) },
    { geo: interior, mat: new THREE.MeshStandardMaterial({ color: '#33602b', roughness: 0.9 }) },
    { geo: troncoYRamas(a), mat: matCorteza() },
  ]
}

/** Parámetros de ez-tree para un palto: tronco corto, ramificación baja y abierta, copa en domo densa. */
export function opcionesPalto(seed) {
  return {
    seed,
    type: 'deciduous',
    bark: { type: 'oak', tint: 0x9a8a78, flatShading: false, textured: true, textureScale: { x: 1, y: 6 } },
    branch: {
      levels: 3,
      angle: { 1: 70, 2: 50, 3: 40 },
      children: { 0: 9, 1: 6, 2: 5 },
      force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.02 },
      gnarliness: { 0: 0.05, 1: 0.12, 2: 0.2, 3: 0.1 },
      length: { 0: 16, 1: 15, 2: 8, 3: 4 },
      radius: { 0: 1.4, 1: 0.6, 2: 0.6, 3: 0.8 },
      sections: { 0: 8, 1: 6, 2: 4, 3: 2 },
      segments: { 0: 8, 1: 5, 2: 3, 3: 3 },
      start: { 1: 0.22, 2: 0.15, 3: 0.1 },
      taper: { 0: 0.7, 1: 0.6, 2: 0.7, 3: 0.75 },
      twist: { 0: 0.1, 1: 0.1, 2: 0, 3: 0 },
    },
    leaves: { type: 'aspen', billboard: 'double', angle: 40, count: 26, start: 0, size: 1.9, sizeVariance: 0.5, tint: 0xffffff, alphaTest: 0.5 },
    trellis: { enabled: false },
  }
}

/** Palto de ez-tree escalado al palto modelo (radio y altura de copa), con nuestra hoja de palto. */
export function paltoEzt(seed, mapHoja) {
  const t = new Tree()
  t.options.copy(opcionesPalto(seed))
  t.generate()
  const ramas = t.branchesMesh.geometry.clone(),
    hojas = t.leavesMesh.geometry.clone()
  const bb = new THREE.Box3().setFromBufferAttribute(hojas.attributes.position).union(new THREE.Box3().setFromBufferAttribute(ramas.attributes.position))
  const tam = bb.getSize(new THREE.Vector3())
  // ancho y alto por separado (como el palto de hoy): copa de 2·R0 y altura H0
  // el ancho lo dan las hojas (las ramitas peladas de las puntas sobresalen y no son copa)
  const th = new THREE.Box3().setFromBufferAttribute(hojas.attributes.position).getSize(new THREE.Vector3())
  const k = (2 * R0) / Math.max(th.x, th.z),
    ky = H0 / tam.y
  for (const g of [ramas, hojas]) g.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2).scale(k, ky, k)
  const corteza = t.branchesMesh.material.clone()
  return {
    piezas: [
      { geo: hojas, mat: matHoja(mapHoja) },
      { geo: ramas, mat: corteza },
    ],
    escala: k,
    triangulos: t.branchesMesh.geometry.index.count / 3 + t.leavesMesh.geometry.index.count / 3,
  }
}
