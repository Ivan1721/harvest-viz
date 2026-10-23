// Huerto completo con instancias: todos los árboles en ~4 llamadas de dibujo (antes ~43 por árbol, más sus sombras).
// Árboles deterministas (misma semilla, mismo árbol), agrupados por tipo de pieza.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { avocadoParts, GREENS } from './realistic.jsx'
import { bigTreeBlobs } from './models.jsx'
import { PaltoHojas } from './paltoHojas.jsx'

const m4 = new THREE.Matrix4(),
  q = new THREE.Quaternion(),
  e = new THREE.Euler(),
  p = new THREE.Vector3(),
  sc = new THREE.Vector3(),
  col = new THREE.Color()

/** Escribe las matrices (y colores) de un InstancedMesh a partir de una lista de {pos, rot, scale, color}. */
function useInstances(ref, items) {
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    items.forEach((it, k) => {
      e.set(...(it.rot || [0, 0, 0]))
      q.setFromEuler(e)
      p.set(...it.pos)
      sc.set(...(it.scale || [1, 1, 1]))
      m4.compose(p, q, sc)
      mesh.setMatrixAt(k, m4)
      if (it.color) mesh.setColorAt(k, col.set(it.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [ref, items])
}

// El árbol modelo mide 3,25 m de radio de copa y ~5,6 m de alto (mapa del estudio). Otros huertos lo escalan:
// k en planta (radio R) y ky en altura (H); sin H, la altura no cambia.
const R0 = 3.25,
  H0 = 5.6
// huertos grandes (más de 400 árboles): menos piezas por árbol para que la escena siga fluida
const MANY = 400

/** trees: [{ x, z, seed }] en coordenadas de mundo. */
/** `hojas`: paltos con racimos de hojas (R3, calidad Alta, solo huertos de palto); si no, el palto de esferas. */
export function Orchard({ trees, R = R0, H, real = true, hojas = false, canopy, opacity = 0.36 }) {
  if (real && hojas) return <PaltoHojas trees={trees} R={R} H={H} canopy={canopy} />
  return real ? <RealOrchard trees={trees} R={R} H={H} canopy={canopy} /> : <SchematicOrchard trees={trees} R={R} H={H} opacity={opacity} />
}

function RealOrchard({ trees, R, H, canopy }) {
  const parts = useMemo(() => {
    const k = R / R0,
      ky = H ? H / H0 : 1,
      many = trees.length > MANY
    const blobs = [],
      fruits = [],
      limbs = [],
      trunks = []
    for (const t of trees) {
      const a = avocadoParts(R0, t.seed)
      trunks.push({ pos: [t.x, 0.95 * ky, t.z], scale: [Math.max(0.5, k), ky, Math.max(0.5, k)] })
      for (const l of a.limbs)
        limbs.push({
          pos: [
            t.x + (k * (Math.cos(l.a) * Math.sin(l.tilt) * l.len)) / 2,
            ky * (1.9 + (Math.cos(l.tilt) * l.len) / 2),
            t.z + (k * (Math.sin(l.a) * Math.sin(l.tilt) * l.len)) / 2,
          ],
          rot: [Math.sin(l.a) * l.tilt, 0, -Math.cos(l.a) * l.tilt],
          scale: [Math.max(0.5, k), l.len * Math.max(k, ky), Math.max(0.5, k)],
        })
      a.blobs.forEach((b, i) => {
        if (many && i % 2) return
        const r = b.r * (many ? 1.2 : 1)
        blobs.push({ pos: [t.x + k * b.x, ky * b.y, t.z + k * b.z], scale: [k * r, ky * r * b.sy, k * r], color: GREENS[b.c] })
      })
      a.fruits.forEach((f, i) => {
        if (many && i % 4) return
        fruits.push({ pos: [t.x + k * f.x, ky * f.y, t.z + k * f.z], rot: [0.3, f.rot, 0.2], scale: [0.04, 0.056, 0.04] })
      })
    }
    return { blobs, fruits, limbs, trunks }
  }, [trees, R, H])
  const rB = useRef(),
    rF = useRef(),
    rL = useRef(),
    rT = useRef()
  useInstances(rB, parts.blobs)
  useInstances(rF, parts.fruits)
  useInstances(rL, parts.limbs)
  useInstances(rT, parts.trunks)
  const leaf = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.78, transparent: true, opacity: 0.5, depthWrite: false }), [])
  useEffect(() => () => leaf.dispose(), [leaf])
  useFrame(() => {
    const o = canopy ? canopy.v : 0.5
    if (leaf.opacity !== o) {
      leaf.opacity = o
      leaf.depthWrite = o > 0.97
    }
  })
  return (
    <group>
      <instancedMesh ref={rT} args={[null, null, parts.trunks.length]} castShadow>
        <cylinderGeometry args={[0.15, 0.27, 1.9, 12]} />
        <meshStandardMaterial color="#5f4a35" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={rL} args={[null, null, parts.limbs.length]} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 1, 8]} />
        <meshStandardMaterial color="#6b5540" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={rB} args={[null, leaf, parts.blobs.length]} castShadow>
        <icosahedronGeometry args={[1, 2]} />
      </instancedMesh>
      {/* frutos: 4 cm, su sombra no se distingue y cuesta un pase más por cada uno */}
      <instancedMesh ref={rF} args={[null, null, parts.fruits.length]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#2f3a22" roughness={0.55} />
      </instancedMesh>
    </group>
  )
}

function SchematicOrchard({ trees, R, H, opacity }) {
  const parts = useMemo(() => {
    const k = R / R0,
      ky = H ? H / H0 : 1,
      many = trees.length > MANY
    const blobs = [],
      trunks = [],
      prints = []
    for (const t of trees) {
      trunks.push({ pos: [t.x, 0.9 * ky, t.z], scale: [Math.max(0.5, k), ky, Math.max(0.5, k)] })
      prints.push({ pos: [t.x, 0.02, t.z], rot: [-Math.PI / 2, 0, 0], scale: [R, R, 1] })
      bigTreeBlobs(R0, t.seed).forEach((b, i) => {
        if (many && i % 2) return
        blobs.push({ pos: [t.x + k * b.x, ky * b.y, t.z + k * b.z], scale: [k * b.r, ky * b.r * 0.82, k * b.r], color: i % 2 ? '#7fb97a' : '#69a863' })
      })
    }
    return { blobs, trunks, prints }
  }, [trees, R, H])
  const rB = useRef(),
    rT = useRef(),
    rP = useRef()
  useInstances(rB, parts.blobs)
  useInstances(rT, parts.trunks)
  useInstances(rP, parts.prints)
  return (
    <group>
      <instancedMesh ref={rT} args={[null, null, parts.trunks.length]} castShadow>
        <cylinderGeometry args={[0.16, 0.28, 1.8, 10]} />
        <meshStandardMaterial color="#8f6f50" roughness={0.9} />
      </instancedMesh>
      {/* copas semitransparentes del estilo esquemático: sin sombra (se veía como un bloque opaco) */}
      <instancedMesh ref={rB} args={[null, null, parts.blobs.length]}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#ffffff" flatShading transparent opacity={opacity} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={rP} args={[null, null, parts.prints.length]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color="#86c27f" transparent opacity={0.22} />
      </instancedMesh>
    </group>
  )
}
