// Paltos con hojas (R3 del diseño «escena 3D más realista», calidad Alta). Sobre el palto de siempre (avocadoParts:
// esferas de follaje en domo) se ponen tarjetas con racimos de hojas de palto dibujadas en un canvas (sin imágenes
// externas); las esferas quedan adentro, más chicas y oscuras, como la sombra del interior de una copa densa. Se eligió
// en el prototipo (prototipos/r3) frente a ez-tree: forma de palto Hass y ~58 cuadros/s con 1.125 árboles.
//
// - Variantes: VARIANTES paltos distintos se generan una vez y se instancian en todo el huerto (pocas llamadas de dibujo);
//   cada árbol lleva además su giro, su escala (±6 %) y su tinte según su semilla.
// - Follaje (diseño «Follaje de paltos», etapa A): cuatro hojas distintas (adulta, ancha, joven y vista por el envés) en
//   un atlas de 2×2 racimos; cada tarjeta toma un racimo, un tinte según su altura y su lado de la copa, y la normal de
//   la copa (mezcla de la del plano con la de su esfera), para que la copa se ilumine como un volumen y no como cartones.
//   El material suma una luz a través de la hoja cuando el sol queda detrás.
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
export const VARIANTES = 8
export const ATLAS = 2 // racimos por lado del atlas (2×2)
const RACIMO_M = 0.75 // lado de una tarjeta de racimo en el palto modelo [m]
const PX_MIN = 1.5 // bajo este tamaño en pantalla, el racimo es ruido: se ven las esferas
const MEZCLA = 0.7 // peso de la normal de la copa frente a la del plano de la tarjeta

const mulberry = (a) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const frac = (x) => x - Math.floor(x)

// Las cuatro hojas del atlas: ancho relativo, colores del borde y del centro, y color de los nervios.
const HOJAS = {
  adulta: { ancho: 1, col: ['#3d6b30', '#5a8f42', '#386329'], nervio: 'rgba(190,210,120,', pec: '#4a5a2a' },
  ancha: { ancho: 1.18, col: ['#36622c', '#4f853c', '#325b27'], nervio: 'rgba(180,205,115,', pec: '#4a5a2a' },
  // hoja nueva del Hass: más chica y clara, con la base bronceada
  joven: { ancho: 0.86, col: ['#7d9a3f', '#a2b855', '#768f3a'], nervio: 'rgba(225,215,150,', pec: '#8a5a32', base: 'rgba(150,90,45,0.55)' },
  // vista desde abajo: verde grisáceo y mate, con el nervio central marcado
  enves: { ancho: 1, col: ['#5f7a54', '#7a9169', '#5a744f'], nervio: 'rgba(225,232,195,', pec: '#5d6640' },
}

/** Hoja de palto Hass en un canvas: elíptica y entera, ápice agudo, nervio central y laterales; `curva` la tuerce. */
function dibujarHoja(tipo, curva = 0) {
  const h = HOJAS[tipo]
  const W = 256,
    H = 512
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const a = Math.min(0.49, 0.48 * h.ancho),
    cx = W / 2,
    dx = curva * W * 0.12
  const hoja = new Path2D()
  hoja.moveTo(cx + dx, 12)
  hoja.bezierCurveTo(cx + W * a + dx, H * 0.2, cx + W * a * 0.94, H * 0.72, cx, H - 44)
  hoja.bezierCurveTo(cx - W * a * 0.94, H * 0.72, cx - W * a + dx, H * 0.2, cx + dx, 12)
  const gr = g.createLinearGradient(cx - W * a, 0, cx + W * a, 0)
  gr.addColorStop(0, h.col[0])
  gr.addColorStop(0.5, h.col[1])
  gr.addColorStop(1, h.col[2])
  g.fillStyle = gr
  g.fill(hoja)
  g.save()
  g.clip(hoja)
  if (h.base) {
    const gb = g.createLinearGradient(0, H * 0.55, 0, H)
    gb.addColorStop(0, 'rgba(0,0,0,0)')
    gb.addColorStop(1, h.base)
    g.fillStyle = gb
    g.fillRect(0, 0, W, H)
  }
  // nervio central (sigue la curva de la hoja) y 8 pares de laterales
  g.strokeStyle = `${h.nervio}${tipo === 'enves' ? 0.8 : 0.55})`
  g.lineWidth = tipo === 'enves' ? 8 : 6
  g.beginPath()
  g.moveTo(cx + dx, 16)
  g.quadraticCurveTo(cx + dx * 0.9, H * 0.45, cx, H)
  g.stroke()
  g.lineWidth = 2.4
  g.strokeStyle = `${h.nervio}${tipo === 'enves' ? 0.5 : 0.3})`
  for (let k = 1; k < 9; k++) {
    const y = 48 + k * 44,
      x0 = cx + dx * (1 - y / H)
    for (const s of [-1, 1]) {
      g.beginPath()
      g.moveTo(x0, y)
      g.quadraticCurveTo(x0 + s * 60 * h.ancho, y - 12, x0 + s * 104 * h.ancho, y - 44)
      g.stroke()
    }
  }
  g.restore()
  g.strokeStyle = h.pec
  g.lineWidth = 6
  g.beginPath()
  g.moveTo(cx, H - 44)
  g.lineTo(cx, H - 4)
  g.stroke()
  return c
}

// Los cuatro racimos del atlas (celda 0 abajo a la izquierda, como las coordenadas de textura): cuántas hojas de cada tipo
// lleva y cuán abierto es (radio relativo a la celda).
export const RACIMOS = [
  { hojas: { adulta: 14, ancha: 6 }, abierto: 0.3 }, // adulto denso
  { hojas: { adulta: 8, ancha: 5 }, abierto: 0.37 }, // adulto abierto
  { hojas: { adulta: 12, joven: 6 }, abierto: 0.32 }, // con brotes nuevos
  { hojas: { enves: 6, adulta: 10 }, abierto: 0.32 }, // visto desde abajo
]

let texRacimos = null
/**
 * Atlas de racimos: 2×2 celdas de 1.024 px, cada una con un racimo de hojas en distintas posiciones, giros, tamaños y
 * tonos (técnica de follaje de juegos). La etapa B del diseño reemplaza este canvas por un PNG dibujado a mano.
 */
export function texturaRacimos() {
  if (texRacimos) return texRacimos
  const rnd = mulberry(99)
  const variantes = {}
  for (const tipo of Object.keys(HOJAS)) variantes[tipo] = [-1, 0, 1].map((c) => dibujarHoja(tipo, c * 0.6))
  const C = 1024
  const c = document.createElement('canvas')
  c.width = c.height = C * ATLAS
  const g = c.getContext('2d')
  RACIMOS.forEach((r, i) => {
    const ox = (i % ATLAS) * C,
      oy = (ATLAS - 1 - Math.floor(i / ATLAS)) * C // el canvas va de arriba hacia abajo; la textura, al revés
    const lista = Object.entries(r.hojas).flatMap(([tipo, n]) => Array(n).fill(tipo))
    // en el orden de la lista: las hojas nuevas van al final y quedan encima
    for (const tipo of lista) {
      const hoja = variantes[tipo][Math.floor(rnd() * 3)]
      const a = rnd() * Math.PI * 2,
        d = Math.sqrt(rnd()) * C * r.abierto
      g.save()
      g.beginPath()
      g.rect(ox, oy, C, C)
      g.clip()
      g.translate(ox + C / 2 + Math.cos(a) * d, oy + C / 2 + Math.sin(a) * d)
      g.rotate(a + Math.PI / 2 + (rnd() - 0.5) * 0.8)
      const k = (tipo === 'joven' ? 0.55 : 0.75) + rnd() * 0.45
      g.filter = `brightness(${0.75 + rnd() * 0.45})`
      g.drawImage(hoja, (-hoja.width * k) / 2, -hoja.height * k, hoja.width * k, hoja.height * k)
      g.restore()
    }
  })
  texRacimos = new THREE.CanvasTexture(c)
  texRacimos.colorSpace = THREE.SRGBColorSpace
  texRacimos.anisotropy = 4
  return texRacimos
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
 * Tinte de una tarjeta (multiplica el color del atlas): más clara arriba y hacia afuera de la copa, más oscura abajo y
 * adentro, con ±8 % de brillo y un poco de matiz al azar. `alto` y `afuera` van de 0 a 1.
 */
export function tinteTarjeta(alto, afuera, rnd) {
  const b = 0.8 + 0.16 * alto + 0.08 * afuera + (rnd() - 0.5) * 0.16,
    h = (rnd() - 0.5) * 0.12
  return [b * (1 + h), b, b * (1 - 1.5 * h)]
}

/** Tinte y escala de cada árbol según su semilla (deterministas): ±6 % de brillo y de tamaño. */
export function rasgosArbol(seed) {
  const b = 0.94 + frac(seed * 0.754877) * 0.12,
    h = (frac(seed * 0.56984) - 0.5) * 0.08
  return { tinte: [b * (1 + h), b, b * (1 - h)], escala: 0.94 + frac(seed * 0.381966) * 0.12 }
}

/**
 * Un palto con hojas en unidades del palto modelo (radio R0, alto H0). `racimos`: tarjetas de racimo; `frutos`: cuántos
 * de sus 90 frutos se dibujan. Devuelve geometrías listas para instanciar.
 */
export function variantePalto(seed, { racimos = 700, frutos = 90 } = {}) {
  const a = avocadoParts(R0, seed)
  const rnd = mulberry(seed * 31 + 7),
    rnd2 = mulberry(seed * 53 + 11) // racimo del atlas y tinte: otra secuencia, así la forma de la copa no cambia
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
  tarjeta.setAttribute('color', new THREE.Float32BufferAttribute(new Array(4 * 3).fill(1), 3))
  const area = a.blobs.map((b) => b.r * b.r),
    total = area.reduce((s, x) => s + x, 0)
  const piezas = [],
    n = new THREE.Vector3(),
    nc = new THREE.Vector3(),
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
    const g = tarjeta.clone().applyMatrix4(m.compose(p, q, new THREE.Vector3(s, s, s)))
    // racimo del atlas: cada tarjeta lee su celda
    const celda = Math.floor(rnd2() * ATLAS * ATLAS),
      cu = celda % ATLAS,
      cv = Math.floor(celda / ATLAS)
    const uv = g.attributes.uv
    for (let j = 0; j < uv.count; j++) uv.setXY(j, (cu + uv.getX(j)) / ATLAS, (cv + uv.getY(j)) / ATLAS)
    // normal de la copa: la del plano vuelta hacia afuera, mezclada con la de la esfera
    const nor = g.attributes.normal
    nc.fromBufferAttribute(nor, 0)
    if (nc.dot(n) < 0) nc.negate()
    nc.multiplyScalar(1 - MEZCLA)
      .addScaledVector(n, MEZCLA)
      .normalize()
    for (let j = 0; j < nor.count; j++) nor.setXYZ(j, nc.x, nc.y, nc.z)
    // tinte: alto en la copa y cuán afuera está del eje del árbol
    const alto = Math.min(1, Math.max(0, (p.y - 1.9) / (H0 - 1.9))),
      afuera = Math.min(1, Math.hypot(p.x, p.z) / R0)
    const [r, gg, bb] = tinteTarjeta(alto, afuera, rnd2)
    const cl = g.attributes.color
    for (let j = 0; j < cl.count; j++) cl.setXYZ(j, r, gg, bb)
    piezas.push(g)
  }
  // el orden de los racimos es al azar: dibujar solo los primeros (opacidad baja) es una muestra pareja de la copa
  const hojas = mergeGeometries(piezas)
  // frutos colgando en la superficie de la copa
  const fruto = new THREE.SphereGeometry(1, 8, 6)
  const fs = a.fruits.filter((_, i) => i % Math.max(1, Math.round(90 / frutos)) === 0)
  const frutosG = mergeGeometries(fs.map((f) => fruto.clone().scale(0.04, 0.056, 0.04).rotateY(f.rot).translate(f.x, f.y, f.z)))
  return { hojas, interior, lejos, corteza: corteza(seed), frutos: frutosG, racimos }
}

/**
 * Material de los racimos: el atlas por el tinte de cada tarjeta. Las caras de atrás conservan la normal de la copa (sin
 * esto, la mitad de las tarjetas, vistas por detrás, se oscurecerían) y se suma la luz del sol que atraviesa la hoja.
 */
export function materialHojas(map) {
  const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55 })
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n\tnormal = normalize( vNormal );')
      .replace(
        '#include <opaque_fragment>',
        `#if NUM_DIR_LIGHTS > 0
	{
		vec3 L = directionalLights[ 0 ].direction;
		float tras = 0.6 * pow( saturate( dot( normalize( vViewPosition ), - L ) ), 3.0 ) + 0.25 * saturate( dot( - normal, L ) );
		outgoingLight += diffuseColor.rgb * directionalLights[ 0 ].color * vec3( 0.9, 1.0, 0.45 ) * tras * 0.22;
	}
	#endif
	#include <opaque_fragment>`,
      )
  }
  m.customProgramCacheKey = () => 'palto-hojas'
  return m
}

const m4 = new THREE.Matrix4(),
  qy = new THREE.Quaternion(),
  ejeY = new THREE.Vector3(0, 1, 0),
  color = new THREE.Color()

/**
 * Instancias de un grupo de árboles: posición, giro y escala según su semilla, escala del sistema (k en planta, ky en
 * altura) y, con `tinte`, el tinte del árbol.
 */
function useMatrices(ref, arboles, k, ky, tinte = false) {
  useLayoutEffect(() => {
    const im = ref.current
    if (!im) return
    arboles.forEach((t, i) => {
      const r = rasgosArbol(t.seed)
      qy.setFromAxisAngle(ejeY, (t.seed * 2.399) % (2 * Math.PI))
      im.setMatrixAt(i, m4.compose(new THREE.Vector3(t.x, 0, t.z), qy, new THREE.Vector3(k * r.escala, ky * r.escala, k * r.escala)))
      if (tinte) im.setColorAt(i, color.setRGB(...r.tinte))
    })
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    im.computeBoundingSphere()
  }, [ref, arboles, k, ky, tinte])
}

function Variante({ v, arboles, k, ky, mats, lejos }) {
  const rH = useRef(),
    rI = useRef(),
    rL = useRef(),
    rC = useRef(),
    rF = useRef()
  useMatrices(rH, arboles, k, ky, true)
  useMatrices(rI, arboles, k, ky, true)
  useMatrices(rL, arboles, k, ky, true)
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
      hojas: materialHojas(texturaRacimos()),
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
