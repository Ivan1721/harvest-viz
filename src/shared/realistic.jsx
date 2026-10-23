// Modo "Realista": palto (Hass) con follaje denso y fruta, suelo con textura procedural, cielo y luz.
// Todo procedural (sin assets externos). Las alturas del árbol son estimadas; ver docs/modelos_escenario.md.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'

const mulberry = (a) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export const GREENS = ['#4a8a42', '#56994a', '#63a552', '#3f7c3c', '#5a9d4c']

/** Geometría determinista de un palto (misma semilla → mismo árbol): esferas de follaje, frutos y ramas. */
export function avocadoParts(R = 3.25, seed = 1) {
  const rnd = mulberry(seed * 977 + 13)
  const blobs = []
  for (let i = 0; i < 38; i++) {
    const a = rnd() * Math.PI * 2,
      d = Math.sqrt(rnd()) * (R - 1.0)
    const dome = Math.sqrt(Math.max(0, 1 - (d / R) ** 2))
    const y = 1.9 + dome * (1.9 + rnd() * 1.4)
    const r = 0.95 + rnd() * 0.75
    blobs.push({ x: Math.cos(a) * d, y, z: Math.sin(a) * d, r, c: Math.floor(rnd() * GREENS.length), sy: 0.78 + rnd() * 0.15 })
  }
  const fruits = []
  for (let i = 0; i < 90; i++) {
    const b = blobs[Math.floor(rnd() * blobs.length)]
    const th = rnd() * Math.PI * 2,
      ph = Math.PI * (0.5 + rnd() * 0.5)
    fruits.push({
      x: b.x + Math.sin(ph) * Math.cos(th) * b.r * 0.97,
      y: b.y + Math.cos(ph) * b.r * b.sy * 0.97,
      z: b.z + Math.sin(ph) * Math.sin(th) * b.r * 0.97,
      rot: rnd() * Math.PI,
    })
  }
  const limbs = [0, 1, 2].map((k) => {
    const a = (k / 3) * Math.PI * 2 + rnd()
    return { a, tilt: 0.45 + rnd() * 0.2, len: 2.2 + rnd() * 0.8 }
  })
  return { blobs, fruits, limbs }
}

// ---- Suelo: textura procedural (pasto en calles, suelo bajo hileras, huellas del robot, grava en la zona de carga)
// `geom` es la geometría de la escena (src/workload/geometry.js): mapa del estudio o huerto generado.
// Con `fotos` (calidad alta, R1) el pasto, el mantillo y la grava son texturas CC0 de Poly Haven en mosaico a su escala
// real (public/texturas/LEEME.md); sin ellas, colores planos como siempre.
const MARGIN = 8
/** Lado real de cada textura en metros (Poly Haven): define cuántas veces se repite. */
export const LADO_FOTO = { pasto: 2, suelo: 2.1, grava: 3 }
export const FOTOS = { pasto: 'texturas/leafy_grass.jpg', suelo: 'texturas/forest_ground_06.jpg', grava: 'texturas/gravel_ground_01.jpg' }

/** Patrón de canvas con una foto en mosaico, escalada a `lado` metros por repetición a `ppm` px por metro. */
function patron(g, img, lado, ppm) {
  const p = g.createPattern(img, 'repeat')
  const k = (lado * ppm) / img.width
  p.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]))
  return p
}

export function useGroundTexture(geom, fotos = null) {
  const tex = useMemo(() => {
    const { limites: L, strips, trees, R, route, cargo } = geom
    // ~36 px/m en el mapa del estudio; en huertos grandes se baja para no pasar de ~2400 px por lado
    const PPM = Math.min(36, 2400 / (Math.max(L.w, L.h) + 2 * MARGIN)),
      W = Math.round((L.w + 2 * MARGIN) * PPM),
      H = Math.round((L.h + 2 * MARGIN) * PPM)
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d'),
      rnd = mulberry(4242)
    const X = (x) => (x + MARGIN) * PPM,
      Y = (y) => (L.h + MARGIN - y) * PPM
    g.fillStyle = fotos ? patron(g, fotos.pasto, LADO_FOTO.pasto, PPM) : '#7f9a56'
    g.fillRect(0, 0, W, H)
    if (fotos) {
      // la foto trae mucha hojarasca: se entona hacia el verde de una entrehilera con pasto cortado
      g.globalCompositeOperation = 'multiply'
      g.fillStyle = '#d2eda6'
      g.fillRect(0, 0, W, H)
      g.globalCompositeOperation = 'source-over'
    }
    // franjas de corte de pasto en las calles
    for (let k = 0; k < 28; k++) {
      g.fillStyle = k % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.03)'
      g.fillRect(0, k * (H / 28), W, H / 28)
    }
    // con fotos, el mantillo bajo cada hilera: la foto del suelo con los bordes difuminados (una capa aparte por franja)
    const capa = fotos ? document.createElement('canvas') : null
    // suelo bajo las hileras con mantillo y línea de riego por goteo
    for (const st of strips) {
      const horiz = st.x1 - st.x0 > st.y1 - st.y0
      const grad = horiz ? g.createLinearGradient(0, Y(st.y1), 0, Y(st.y0)) : g.createLinearGradient(X(st.x0), 0, X(st.x1), 0)
      grad.addColorStop(0, 'rgba(120,92,58,0)')
      grad.addColorStop(0.22, 'rgba(142,112,74,0.7)')
      grad.addColorStop(0.78, 'rgba(142,112,74,0.7)')
      grad.addColorStop(1, 'rgba(120,92,58,0)')
      if (capa) {
        const x = X(st.x0),
          y = Y(st.y1),
          w = Math.max(1, Math.round((st.x1 - st.x0) * PPM)),
          h = Math.max(1, Math.round((st.y1 - st.y0) * PPM))
        capa.width = w
        capa.height = h
        const c2 = capa.getContext('2d')
        // el patrón se ancla al mundo (no a la franja): las juntas del mosaico no se ven entre franjas
        c2.translate(-x, -y)
        c2.fillStyle = patron(c2, fotos.suelo, LADO_FOTO.suelo, PPM)
        c2.fillRect(x, y, w, h)
        c2.setTransform(1, 0, 0, 1, 0, 0)
        c2.globalCompositeOperation = 'destination-in'
        const m = horiz ? c2.createLinearGradient(0, 0, 0, h) : c2.createLinearGradient(0, 0, w, 0)
        m.addColorStop(0, 'rgba(0,0,0,0)')
        m.addColorStop(0.22, 'rgba(0,0,0,0.95)')
        m.addColorStop(0.78, 'rgba(0,0,0,0.95)')
        m.addColorStop(1, 'rgba(0,0,0,0)')
        c2.fillStyle = m
        c2.fillRect(0, 0, w, h)
        g.drawImage(capa, x, y)
      } else {
        g.fillStyle = grad
        g.fillRect(X(st.x0), Y(st.y1), (st.x1 - st.x0) * PPM, (st.y1 - st.y0) * PPM)
      }
      g.strokeStyle = 'rgba(20,20,20,0.55)'
      g.lineWidth = 2
      g.beginPath()
      if (horiz) {
        const y = (st.y0 + st.y1) / 2 - 0.7
        g.moveTo(X(st.x0), Y(y))
        g.lineTo(X(st.x1), Y(y))
      } else {
        const x = (st.x0 + st.x1) / 2 - 0.7
        g.moveTo(X(x), Y(st.y0))
        g.lineTo(X(x), Y(st.y1))
      }
      g.stroke()
    }
    // sombra suave y hojarasca bajo cada árbol (menos hojas por árbol en huertos grandes)
    const nLeaves = Math.max(30, Math.round(3000 / trees.length))
    for (const t of trees) {
      const sh = g.createRadialGradient(X(t.x), Y(t.y), 0, X(t.x), Y(t.y), 1.2 * R * PPM)
      sh.addColorStop(0, 'rgba(25,22,12,0.3)')
      sh.addColorStop(0.7, 'rgba(25,22,12,0.16)')
      sh.addColorStop(1, 'rgba(25,22,12,0)')
      g.fillStyle = sh
      g.beginPath()
      g.arc(X(t.x), Y(t.y), 1.2 * R * PPM, 0, Math.PI * 2)
      g.fill()
      for (let i = 0; i < nLeaves; i++) {
        const a = rnd() * 6.283,
          d = Math.sqrt(rnd()) * R
        g.fillStyle = `rgba(${70 + rnd() * 50},${55 + rnd() * 30},${28},${0.35 + rnd() * 0.4})`
        g.fillRect(X(t.x + Math.cos(a) * d), Y(t.y + Math.sin(a) * d), 3, 2)
      }
    }
    // huellas del robot sobre su ruta
    g.strokeStyle = 'rgba(96,78,52,0.55)'
    g.lineWidth = 1.5 * PPM
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    route.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))))
    g.stroke()
    // zona de carga: grava
    g.fillStyle = fotos ? patron(g, fotos.grava, LADO_FOTO.grava, PPM) : '#a79d88'
    g.fillRect(X(cargo.x[0] - 0.6), Y(cargo.y[1] + 1.6), (cargo.x[1] - cargo.x[0] + 1.2) * PPM, (cargo.y[1] - cargo.y[0] + 2.2) * PPM)
    // ruido de grano (las fotos ya lo traen)
    for (let i = 0; i < (fotos ? 0 : 90000); i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)'
      g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [geom, fotos])
  // la textura pesa varios MB en la GPU: liberarla al cambiar de huerto o desmontar
  useEffect(() => () => tex.dispose(), [tex])
  return tex
}

export function RealGround({ geom, fotos = null, pastoLejos = null }) {
  const tex = useGroundTexture(geom, fotos)
  const L = geom.limites
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        {pastoLejos ? <meshStandardMaterial map={pastoLejos} color="#d2eda6" roughness={1} /> : <meshStandardMaterial color="#7f9a56" roughness={1} />}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[L.w + 2 * MARGIN, L.h + 2 * MARGIN]} />
        <meshStandardMaterial map={tex} roughness={1} />
      </mesh>
    </group>
  )
}

/** Suelo de calidad alta: carga las fotos (suspende mientras bajan) y repite el pasto también fuera del huerto. */
export function RealGroundAlta({ geom }) {
  const base = import.meta.env.BASE_URL
  const [pasto, suelo, grava] = useTexture([base + FOTOS.pasto, base + FOTOS.suelo, base + FOTOS.grava])
  const fotos = useMemo(() => ({ pasto: pasto.image, suelo: suelo.image, grava: grava.image }), [pasto, suelo, grava])
  const lejos = useMemo(() => {
    const t = pasto.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(400 / LADO_FOTO.pasto, 400 / LADO_FOTO.pasto)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    t.needsUpdate = true
    return t
  }, [pasto])
  useEffect(() => () => lejos.dispose(), [lejos])
  return <RealGround geom={geom} fotos={fotos} pastoLejos={lejos} />
}

// Fondo de cielo (degradado) para cualquier cámara
export function SkyBackground() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 256
    const g = c.getContext('2d'),
      gr = g.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, '#9cc5e8')
    gr.addColorStop(0.55, '#cfe2ee')
    gr.addColorStop(1, '#eef0e6')
    g.fillStyle = gr
    g.fillRect(0, 0, 4, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useEffect(() => () => tex.dispose(), [tex])
  return <primitive object={tex} attach="background" />
}
