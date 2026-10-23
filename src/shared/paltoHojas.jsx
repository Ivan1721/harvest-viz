// Paltos con hojas (R3 del diseño «escena 3D más realista», calidad Alta). Sobre el palto de siempre (avocadoParts:
// esferas de follaje en domo) se ponen tarjetas con racimos de hojas de palto dibujadas en un canvas (sin imágenes
// externas); las esferas quedan adentro, más chicas y oscuras, como la sombra del interior de una copa densa. Se eligió
// en el prototipo (prototipos/r3) frente a ez-tree: forma de palto Hass y ~58 cuadros/s con 1.125 árboles.
//
// - Variantes: VARIANTES paltos distintos se generan una vez y se instancian en todo el huerto (pocas llamadas de dibujo).
// - Nivel de detalle: si un racimo ocupa menos de ~1,5 px (huerto grande o cámara lejos) se ven las esferas de siempre.
// - Opacidad del follaje: el control recorta cuántos racimos se dibujan (prefijo al azar del índice) y vuelve
//   translúcido el interior; así se sigue viendo a los cosecheros bajo la copa.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { avocadoParts, GREENS } from './realistic.jsx'

const R0 = 3.25, // radio de copa del palto modelo (mapa del estudio)
  H0 = 5.6 // altura del palto modelo
export const VARIANTES = 6
const RACIMO_M = 0.75 // lado de una tarjeta de racimo en el palto modelo [m]
const PX_MIN = 1.5 // bajo este tamaño en pantalla, el racimo es ruido: se ven las esferas

const mulberry = (a) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Hoja de palto Hass en un canvas: elíptica y entera, ápice agudo, nervio central y nervios laterales. */
function dibujarHoja() {
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
  g.lineTo(W / 2, H)
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
  g.strokeStyle = '#4a5a2a'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(W / 2, H - 22)
  g.lineTo(W / 2, H - 2)
  g.stroke()
  return c
}

let texRacimo = null
/** Racimo: ~16 hojas de palto en distintas posiciones, giros y tonos sobre una tarjeta (técnica de follaje de juegos). */
export function texturaRacimo() {
  if (texRacimo) return texRacimo
  const hoja = dibujarHoja()
  const S = 512
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d'),
    rnd = mulberry(99)
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2,
      d = Math.sqrt(rnd()) * S * 0.3
    g.save()
    g.translate(S / 2 + Math.cos(a) * d, S / 2 + Math.sin(a) * d)
    g.rotate(a + Math.PI / 2 + (rnd() - 0.5) * 0.8)
    const k = 0.75 + rnd() * 0.45
    g.filter = `brightness(${0.75 + rnd() * 0.45})`
    g.drawImage(hoja, (-hoja.width * k) / 2, -hoja.height * k, hoja.width * k, hoja.height * k)
    g.restore()
  }
  texRacimo = new THREE.CanvasTexture(c)
  texRacimo.colorSpace = THREE.SRGBColorSpace
  texRacimo.anisotropy = 4
  return texRacimo
}

/** Tronco y cinco ramas principales que entran en la copa (se ven entre los racimos). */
function corteza(seed) {
  const rnd = mulberry(seed * 13 + 5)
  const piezas = [new THREE.CylinderGeometry(0.17, 0.3, 1.9, 10).translate(0, 0.95, 0)]
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd() * 0.6,
      tilt = 0.5 + rnd() * 0.35,
      len = 2.0 + rnd() * 0.9
    const g = new THREE.CylinderGeometry(0.06, 0.14, len, 7).translate(0, len / 2, 0)
    g.rotateZ(-Math.cos(a) * tilt)
    g.rotateX(Math.sin(a) * tilt)
    g.translate(0, 1.8, 0)
    piezas.push(g)
  }
  return mergeGeometries(piezas)
}

/**
 * Un palto con hojas en unidades del palto modelo (radio R0, alto H0). `racimos`: tarjetas de racimo; `frutos`: cuántos
 * de sus 90 frutos se dibujan. Devuelve geometrías listas para instanciar.
 */
export function variantePalto(seed, { racimos = 700, frutos = 90 } = {}) {
  const a = avocadoParts(R0, seed)
  const rnd = mulberry(seed * 31 + 7)
  // interior: las esferas más chicas y oscuras (dan volumen y tapan los huecos entre racimos)
  const esferaIn = new THREE.SphereGeometry(0.88, 10, 8)
  const interior = mergeGeometries(
    a.blobs.map((b) =>
      esferaIn
        .clone()
        .scale(b.r, b.r * b.sy, b.r)
        .translate(b.x, b.y, b.z),
    ),
  )
  // lejos: las esferas de siempre, opacas, con su color (nivel de detalle)
  const esferaLe = new THREE.SphereGeometry(1, 12, 9)
  const piezasLejos = a.blobs.map((b) =>
    esferaLe
      .clone()
      .scale(b.r, b.r * b.sy, b.r)
      .translate(b.x, b.y, b.z),
  )
  const col = []
  piezasLejos.forEach((g, i) => {
    const c = new THREE.Color(GREENS[a.blobs[i].c])
    for (let k = 0; k < g.attributes.position.count; k++) col.push(c.r, c.g, c.b)
  })
  const lejos = mergeGeometries(piezasLejos)
  lejos.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  // racimos: en la superficie de las esferas (proporcional al área), sesgados hacia arriba y hacia afuera, caídos
  const tarjeta = new THREE.PlaneGeometry(RACIMO_M, RACIMO_M).translate(0, RACIMO_M * 0.4, 0)
  const area = a.blobs.map((b) => b.r * b.r),
    total = area.reduce((s, x) => s + x, 0)
  const piezas = [],
    n = new THREE.Vector3(),
    q = new THREE.Quaternion(),
    giro = new THREE.Quaternion(),
    m = new THREE.Matrix4(),
    up = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i < racimos; i++) {
    let u = rnd() * total,
      k = 0
    while (u > area[k] && k < area.length - 1) u -= area[k++]
    const b = a.blobs[k]
    const th = rnd() * 2 * Math.PI,
      z = 2 * Math.pow(rnd(), 0.7) - 1
    n.set(Math.sqrt(1 - z * z) * Math.cos(th), z, Math.sqrt(1 - z * z) * Math.sin(th))
    const p = new THREE.Vector3(b.x + n.x * b.r, b.y + n.y * b.r * b.sy, b.z + n.z * b.r)
    const dir = n
      .clone()
      .add(new THREE.Vector3((rnd() - 0.5) * 0.9, -0.35 - rnd() * 0.4, (rnd() - 0.5) * 0.9))
      .normalize()
    q.setFromUnitVectors(up, dir).multiply(giro.setFromAxisAngle(up, rnd() * Math.PI * 2))
    const s = 0.8 + rnd() * 0.5
    piezas.push(tarjeta.clone().applyMatrix4(m.compose(p, q, new THREE.Vector3(s, s, s))))
  }
  // el orden de los racimos es al azar: dibujar solo los primeros (opacidad baja) es una muestra pareja de la copa
  const hojas = mergeGeometries(piezas)
  // frutos colgando en la superficie de la copa
  const fruto = new THREE.SphereGeometry(1, 8, 6)
  const fs = a.fruits.filter((_, i) => i % Math.max(1, Math.round(90 / frutos)) === 0)
  const frutosG = mergeGeometries(fs.map((f) => fruto.clone().scale(0.04, 0.056, 0.04).rotateY(f.rot).translate(f.x, f.y, f.z)))
  return { hojas, interior, lejos, corteza: corteza(seed), frutos: frutosG, racimos }
}

const m4 = new THREE.Matrix4(),
  qy = new THREE.Quaternion(),
  ejeY = new THREE.Vector3(0, 1, 0)

/** Instancias de un grupo de árboles: posición, giro según su semilla y escala del sistema (k en planta, ky en altura). */
function useMatrices(ref, arboles, k, ky) {
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    arboles.forEach((t, i) => {
      qy.setFromAxisAngle(ejeY, (t.seed * 2.399) % (2 * Math.PI))
      im.setMatrixAt(i, m4.compose(new THREE.Vector3(t.x, 0, t.z), qy, new THREE.Vector3(k, ky, k)))
    })
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
  }, [ref, arboles, k, ky])
}

function Variante({ v, arboles, k, ky, mats, lejos }) {
  const rH = useRef(),
    rI = useRef(),
    rL = useRef(),
    rC = useRef(),
    rF = useRef()
  useMatrices(rH, arboles, k, ky)
  useMatrices(rI, arboles, k, ky)
  useMatrices(rL, arboles, k, ky)
  useMatrices(rC, arboles, k, ky)
  useMatrices(rF, arboles, k, ky)
  const n = arboles.length
  return (
    <group>
      <group ref={lejos.cerca}>
        <instancedMesh ref={rH} args={[v.hojas, mats.hojas, n]} castShadow receiveShadow />
        <instancedMesh ref={rI} args={[v.interior, mats.interior, n]} castShadow />
      </group>
      <instancedMesh ref={rL} args={[v.lejos, mats.lejos, n]} castShadow visible={false} userData={{ lejos: true }} />
      <instancedMesh ref={rC} args={[v.corteza, mats.corteza, n]} castShadow />
      <instancedMesh ref={rF} args={[v.frutos, mats.frutos, n]} />
    </group>
  )
}

/** trees: [{ x, z, seed }] en coordenadas de mundo; R y H del sistema de huerto; canopy: { v } opacidad del follaje. */
export function PaltoHojas({ trees, R = R0, H, canopy }) {
  const k = R / R0,
    ky = H ? H / H0 : 1,
    muchos = trees.length > 400
  const variantes = useMemo(
    () => Array.from({ length: VARIANTES }, (_, i) => variantePalto(3 + i * 8, muchos ? { racimos: 400, frutos: 22 } : { racimos: 700, frutos: 90 })),
    [muchos],
  )
  useEffect(() => () => variantes.forEach((v) => Object.values(v).forEach((g) => g?.dispose?.())), [variantes])
  const mats = useMemo(
    () => ({
      hojas: new THREE.MeshStandardMaterial({ map: texturaRacimo(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55 }),
      interior: new THREE.MeshStandardMaterial({ color: '#33602b', roughness: 0.9 }),
      lejos: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }),
      corteza: new THREE.MeshStandardMaterial({ color: '#5f4a35', roughness: 1 }),
      frutos: new THREE.MeshStandardMaterial({ color: '#2f3a22', roughness: 0.55 }),
    }),
    [],
  )
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats])
  const grupos = useMemo(() => Array.from({ length: VARIANTES }, (_, i) => trees.filter((t) => ((t.seed % VARIANTES) + VARIANTES) % VARIANTES === i)), [trees])
  const raiz = useRef()
  const cercas = useMemo(() => Array.from({ length: VARIANTES }, () => ({ current: null })), [])
  const estado = useRef({ cerca: null, v: null })
  useFrame(({ camera }) => {
    // nivel de detalle: tamaño de un racimo en pantalla (cámara ortográfica: zoom = píxeles por metro)
    const px = RACIMO_M * k * (camera.zoom || 1)
    const cerca = px >= PX_MIN
    const v = canopy ? canopy.v : 0.8
    const st = estado.current
    if (st.cerca !== cerca) {
      st.cerca = cerca
      for (const c of cercas) if (c.current) c.current.visible = cerca
      raiz.current?.traverse((o) => o.userData?.lejos && (o.visible = !cerca))
    }
    if (st.v !== v) {
      st.v = v
      // opacidad → densidad de racimos (todos desde 0,8) e interior translúcido bajo 0,97; lejos, la opacidad de siempre
      const dens = Math.min(1, 0.1 + (0.9 * Math.max(0, v - 0.15)) / 0.65)
      for (const vr of variantes) vr.hojas.setDrawRange(0, Math.floor((vr.hojas.index.count * dens) / 6) * 6)
      for (const m of [mats.interior, mats.lejos]) {
        m.transparent = v < 0.97
        m.opacity = m === mats.interior ? Math.min(1, v * 0.9) : v
        m.depthWrite = v >= 0.97
        m.needsUpdate = true
      }
    }
  })
  return (
    <group ref={raiz}>
      {variantes.map((v, i) => grupos[i].length > 0 && <Variante key={i} v={v} arboles={grupos[i]} k={k} ky={ky} mats={mats} lejos={{ cerca: cercas[i] }} />)}
    </group>
  )
}
