// Modelos 3D compartidos entre modos (presentacionales; las animaciones las manejan los padres con refs).
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'

// Geometrías y materiales compartidos por todas las personas y escaleras (antes, ~20 geometrías y materiales
// por trabajador y escena). Se crean una vez, al primer uso, y viven mientras la página esté abierta.
let SHARED = null
function shared() {
  if (SHARED) return SHARED
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, ...o })
  SHARED = {
    g: {
      torso: new THREE.CapsuleGeometry(0.2, 0.42, 4, 14),
      vest: new THREE.CapsuleGeometry(0.2, 0.3, 4, 14),
      band: new THREE.CylinderGeometry(0.21, 0.21, 0.035, 18, 1, true),
      head: new THREE.SphereGeometry(0.16, 18, 18),
      brim: new THREE.CylinderGeometry(0.3, 0.3, 0.015, 24),
      crown: new THREE.CylinderGeometry(0.15, 0.17, 0.12, 20),
      hatBand: new THREE.CylinderGeometry(0.172, 0.172, 0.03, 20),
      helmet: new THREE.SphereGeometry(0.18, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      bag: new THREE.BoxGeometry(0.16, 0.3, 0.34),
      fill: new THREE.SphereGeometry(0.15, 12, 10),
      arm: new THREE.CapsuleGeometry(0.06, 0.3, 4, 8),
      hand: new THREE.SphereGeometry(0.065, 10, 10),
      leg: new THREE.CapsuleGeometry(0.075, 0.4, 4, 8),
      boot: new THREE.BoxGeometry(0.22, 0.08, 0.13),
      rung: new THREE.BoxGeometry(0.04, 0.04, 0.44),
    },
    m: {
      cloth: std('#334155'),
      band: std('#e5e7eb', { emissive: '#e5e7eb', emissiveIntensity: 0.4, side: THREE.DoubleSide }),
      skin: std('#f1c9a5'),
      brim: std('#d8b878', { roughness: 0.95 }),
      crown: std('#cfa968', { roughness: 0.95 }),
      hatBand: std('#5b4630'),
      helmet: std('#fde047'),
      bag: std('#7d6f45', { roughness: 1 }),
      fill: std('#35502a', { roughness: 0.7 }),
      hand: std('#e2e8f0'),
      boot: std('#3f2d1e'),
      rail: std('#cbd5e1'),
      rung: std('#94a3b8'),
    },
    rails: new Map(), // largueros de escalera por altura
  }
  return SHARED
}

// Persona orientada hacia +X local. refs: { body, legL, legR, armL, armR, vest, fill }
// El chaleco es el único material propio de cada persona (su color cambia con el estado).
export function Person({ refs, vest = '#ff8a1f', scale = 1, real = false }) {
  const { g, m } = shared()
  return (
    <group scale={scale}>
      <group ref={refs.body} position={[0, 0.95, 0]}>
        <mesh geometry={g.torso} material={m.cloth} castShadow />
        <mesh geometry={g.vest} scale={[1.08, 1, 1.12]}>
          <meshStandardMaterial ref={refs.vest} color={vest} />
        </mesh>
        {[-0.07, 0.08].map((y, i) => (
          <mesh key={i} geometry={g.band} material={m.band} position={[0, y, 0]} scale={[1.1, 1, 1.14]} />
        ))}
        <mesh geometry={g.head} material={m.skin} position={[0, 0.5, 0]} castShadow />
        {real ? (
          <group position={[0, 0.58, 0]}>
            <mesh geometry={g.brim} material={m.brim} />
            <mesh geometry={g.crown} material={m.crown} position={[0, 0.06, 0]} />
            <mesh geometry={g.hatBand} material={m.hatBand} position={[0, 0.025, 0]} />
          </group>
        ) : (
          <mesh geometry={g.helmet} material={m.helmet} position={[0, 0.57, 0]} />
        )}
        {real && (
          <group position={[0.2, -0.02, 0]}>
            {/* bolsa de cosecha de lona sobre el pecho; el relleno crece con la fruta recolectada */}
            <mesh geometry={g.bag} material={m.bag} castShadow />
            <mesh ref={refs.fill} geometry={g.fill} material={m.fill} position={[0.01, 0.14, 0]} />
          </group>
        )}
        {[
          [refs.armL, -0.27],
          [refs.armR, 0.27],
        ].map(([ref, z], i) => (
          <group key={i} ref={ref} position={[0, 0.2, z]}>
            <mesh geometry={g.arm} material={m.cloth} position={[0, -0.22, 0]} />
            <mesh geometry={g.hand} material={m.hand} position={[0, -0.48, 0]} />
          </group>
        ))}
        {[
          [refs.legL, -0.1],
          [refs.legR, 0.1],
        ].map(([ref, z], i) => (
          <group key={i} ref={ref} position={[0, -0.35, z]}>
            <mesh geometry={g.leg} material={m.cloth} position={[0, -0.28, 0]} />
            <mesh geometry={g.boot} material={m.boot} position={[0.05, -0.58, 0]} />
          </group>
        ))}
      </group>
    </group>
  )
}

/** Copa esquemática determinista (misma semilla → mismo árbol). */
export function bigTreeBlobs(R = 3.25, seed = 0) {
  const out = []
  let s = seed * 9301 + 49297
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2,
      d = rnd() * R * 0.55
    out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 3.1 + (rnd() - 0.5) * 1.4, r: R * (0.5 + rnd() * 0.22) })
  }
  return out
}

export function Crate({ position = [0, 0, 0], size = [0.5, 0.32, 0.4], color = '#c8a36a' }) {
  return (
    <RoundedBox args={size} radius={0.02} position={[position[0], position[1] + size[1] / 2, position[2]]} castShadow>
      <meshStandardMaterial color={color} roughness={0.9} />
    </RoundedBox>
  )
}

export function Ladder({ height = 2.2 }) {
  // escalera apoyada, inclinada hacia +X local (hacia el árbol)
  const { g, m, rails } = shared()
  if (!rails.has(height)) rails.set(height, new THREE.BoxGeometry(0.05, height, 0.05))
  const rail = rails.get(height)
  const tilt = 0.28
  return (
    <group rotation={[0, 0, -tilt]} position={[0.2, 0, 0]}>
      {[-0.22, 0.22].map((z, i) => (
        <mesh key={i} geometry={rail} material={m.rail} position={[0, height / 2, z]} />
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} geometry={g.rung} material={m.rung} position={[0, 0.3 + i * 0.3, 0]} />
      ))}
    </group>
  )
}

// Caja de campo plástica ventilada (modo realista): ranuras en las caras largas
export function CrateReal({ position = [0, 0, 0], size = [0.6, 0.3, 0.4], color = '#d99a2b' }) {
  const [lx, ly, lz] = size
  return (
    <group position={[position[0], position[1], position[2]]}>
      <RoundedBox args={size} radius={0.015} position={[0, ly / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.55} />
      </RoundedBox>
      {[0.3, 0.55, 0.8].map((f) =>
        [-1, 1].map((sg) => (
          <mesh key={`${f}${sg}`} position={[0, ly * f, sg * (lz / 2 + 0.001)]}>
            <boxGeometry args={[lx * 0.8, ly * 0.07, 0.004]} />
            <meshStandardMaterial color="#3a2a10" />
          </mesh>
        )),
      )}
      <mesh position={[0, ly + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[lx * 0.9, lz * 0.9]} />
        <meshStandardMaterial color="#2c4a22" roughness={0.9} />
      </mesh>
    </group>
  )
}

/**
 * Conjunto de cajas con instancias: 1–3 llamadas de dibujo para todas (antes, un grupo de 1–8 mallas por caja).
 * `frame(put)` se llama en cada cuadro y debe llamar `put(x, y, z)` por cada caja visible (y = base de la caja).
 */
export function CrateSet({ capacity, size, real = false, color, frame }) {
  const [lx, ly, lz] = size
  const body = useRef(),
    slats = useRef(),
    top = useRef()
  const geo = useMemo(
    () => ({
      body: new RoundedBoxGeometry(lx, ly, lz, 2, real ? 0.015 : 0.02),
      slat: new THREE.BoxGeometry(lx * 0.8, ly * 0.07, 0.004),
      top: new THREE.PlaneGeometry(lx * 0.9, lz * 0.9).rotateX(-Math.PI / 2),
    }),
    [lx, ly, lz, real],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])
  const o = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    let n = 0
    const set = (mesh, k, x, y, z) => {
      o.position.set(x, y, z)
      o.updateMatrix()
      mesh.setMatrixAt(k, o.matrix)
    }
    frame((x, y, z) => {
      if (n >= capacity) return
      set(body.current, n, x, y + ly / 2, z)
      if (real) {
        set(top.current, n, x, y + ly + 0.002, z)
        let j = 0
        for (const f of [0.3, 0.55, 0.8]) for (const sg of [-1, 1]) set(slats.current, n * 6 + j++, x, y + ly * f, z + sg * (lz / 2 + 0.001))
      }
      n++
    })
    for (const [mesh, per] of [
      [body.current, 1],
      [slats.current, 6],
      [top.current, 1],
    ])
      if (mesh) {
        mesh.count = n * per
        mesh.instanceMatrix.needsUpdate = true
      }
  })
  return (
    <group>
      <instancedMesh ref={body} args={[geo.body, null, capacity]} frustumCulled={false} castShadow receiveShadow={real}>
        <meshStandardMaterial color={color || (real ? '#d99a2b' : '#c8a36a')} roughness={real ? 0.55 : 0.9} />
      </instancedMesh>
      {real && (
        <>
          <instancedMesh ref={slats} args={[geo.slat, null, capacity * 6]} frustumCulled={false}>
            <meshStandardMaterial color="#3a2a10" />
          </instancedMesh>
          <instancedMesh ref={top} args={[geo.top, null, capacity]} frustumCulled={false}>
            <meshStandardMaterial color="#2c4a22" roughness={0.9} />
          </instancedMesh>
        </>
      )}
    </group>
  )
}
