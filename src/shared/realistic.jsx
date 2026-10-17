// Modo "Realista": palto (Hass) con follaje denso y fruta, suelo con textura procedural, cielo y luz.
// Todo procedural (sin assets externos). Las alturas del árbol son estimadas; ver docs/modelos_escenario.md.
import React, { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { MAP, ROWS, CARGO, routeLoop } from '../workload/spec.js'

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

export function AvocadoTree({ R = 3.25, seed = 1, canopy }) {
  const mats = useMemo(
    () => GREENS.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, transparent: true, opacity: 0.5, depthWrite: false })),
    [],
  )
  const { blobs, fruits, limbs } = useMemo(() => avocadoParts(R, seed), [R, seed])
  const inst = useRef()
  React.useLayoutEffect(() => {
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion(),
      e = new THREE.Euler(),
      sc = new THREE.Vector3(0.04, 0.056, 0.04),
      p = new THREE.Vector3()
    fruits.forEach((f, i) => {
      e.set(0.3, f.rot, 0.2)
      q.setFromEuler(e)
      p.set(f.x, f.y, f.z)
      m.compose(p, q, sc)
      inst.current.setMatrixAt(i, m)
    })
    inst.current.instanceMatrix.needsUpdate = true
  }, [fruits])
  useFrame(() => {
    const o = canopy ? canopy.v : 0.5
    mats.forEach((m) => {
      m.opacity = o
      m.depthWrite = o > 0.97
    })
  })
  return (
    <group>
      <mesh position={[0, 0.95, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.27, 1.9, 12]} />
        <meshStandardMaterial color="#5f4a35" roughness={1} />
      </mesh>
      {limbs.map((l, i) => (
        <mesh
          key={i}
          position={[(Math.cos(l.a) * Math.sin(l.tilt) * l.len) / 2, 1.9 + (Math.cos(l.tilt) * l.len) / 2, (Math.sin(l.a) * Math.sin(l.tilt) * l.len) / 2]}
          rotation={[Math.sin(l.a) * l.tilt, 0, -Math.cos(l.a) * l.tilt]}
          castShadow
        >
          <cylinderGeometry args={[0.07, 0.12, l.len, 8]} />
          <meshStandardMaterial color="#6b5540" roughness={1} />
        </mesh>
      ))}
      {blobs.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} scale={[b.r, b.r * b.sy, b.r]} castShadow>
          <icosahedronGeometry args={[1, 2]} />
          <primitive object={mats[b.c]} attach="material" />
        </mesh>
      ))}
      <instancedMesh ref={inst} args={[null, null, fruits.length]} castShadow>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#2f3a22" roughness={0.55} />
      </instancedMesh>
    </group>
  )
}

// ---- Suelo: textura procedural (pasto en calles, suelo bajo hileras, huellas del robot, grava en la zona de carga)
const MARGIN = 8
export function useGroundTexture(row) {
  return useMemo(() => {
    const PPM = 36,
      W = Math.round((MAP.w + 2 * MARGIN) * PPM),
      H = Math.round((MAP.h + 2 * MARGIN) * PPM)
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const g = c.getContext('2d'),
      rnd = mulberry(4242)
    const X = (x) => (x + MARGIN) * PPM,
      Y = (y) => (MAP.h + MARGIN - y) * PPM
    g.fillStyle = '#7f9a56'
    g.fillRect(0, 0, W, H)
    // franjas de corte de pasto en las calles
    for (let k = 0; k < 28; k++) {
      g.fillStyle = k % 2 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.03)'
      g.fillRect(0, Y(MAP.h + MARGIN) + k * (H / 28), W, H / 28)
    }
    // suelo bajo las hileras (franja de 4,6 m) con mantillo
    Object.values(ROWS).forEach((R) => {
      const grad = g.createLinearGradient(0, Y(R.y + 2.5), 0, Y(R.y - 2.5))
      grad.addColorStop(0, 'rgba(120,92,58,0)')
      grad.addColorStop(0.22, 'rgba(142,112,74,0.7)')
      grad.addColorStop(0.78, 'rgba(142,112,74,0.7)')
      grad.addColorStop(1, 'rgba(120,92,58,0)')
      g.fillStyle = grad
      g.fillRect(X(-MARGIN), Y(R.y + 2.5), W, 5 * PPM)
      // línea de riego por goteo
      g.strokeStyle = 'rgba(20,20,20,0.55)'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(X(-MARGIN), Y(R.y - 0.7))
      g.lineTo(X(MAP.w + MARGIN), Y(R.y - 0.7))
      g.stroke()
      // sombra suave y hojarasca bajo cada árbol
      R.x.forEach((tx) => {
        const sh = g.createRadialGradient(X(tx), Y(R.y), 0, X(tx), Y(R.y), 3.9 * PPM)
        sh.addColorStop(0, 'rgba(25,22,12,0.3)')
        sh.addColorStop(0.7, 'rgba(25,22,12,0.16)')
        sh.addColorStop(1, 'rgba(25,22,12,0)')
        g.fillStyle = sh
        g.beginPath()
        g.arc(X(tx), Y(R.y), 3.9 * PPM, 0, Math.PI * 2)
        g.fill()
        for (let i = 0; i < 260; i++) {
          const a = rnd() * 6.283,
            d = Math.sqrt(rnd()) * 3.4
          g.fillStyle = `rgba(${70 + rnd() * 50},${55 + rnd() * 30},${28},${0.35 + rnd() * 0.4})`
          g.fillRect(X(tx + Math.cos(a) * d), Y(R.y + Math.sin(a) * d), 3, 2)
        }
      })
    })
    // huellas del robot sobre su ruta
    const rt = routeLoop(row)
    g.strokeStyle = 'rgba(96,78,52,0.55)'
    g.lineWidth = 1.5 * PPM
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    rt.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))))
    g.stroke()
    // zona de carga: grava
    g.fillStyle = '#a79d88'
    g.fillRect(X(CARGO.x[0] - 0.6), Y(CARGO.y[1] + 1.6), (CARGO.x[1] - CARGO.x[0] + 1.2) * PPM, (CARGO.y[1] - CARGO.y[0] + 2.2) * PPM)
    // ruido de grano
    for (let i = 0; i < 90000; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)'
      g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2)
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  }, [row])
}

export function RealGround({ row }) {
  const tex = useGroundTexture(row)
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#7f9a56" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[MAP.w + 2 * MARGIN, MAP.h + 2 * MARGIN]} />
        <meshStandardMaterial map={tex} roughness={1} />
      </mesh>
    </group>
  )
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
  return <primitive object={tex} attach="background" />
}
