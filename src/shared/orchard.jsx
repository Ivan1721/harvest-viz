// Huerto completo con instancias: todos los árboles en ~4 llamadas de dibujo (antes ~43 por árbol, más sus sombras).
// Árboles deterministas (misma semilla, mismo árbol), agrupados por tipo de pieza.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { avocadoParts, GREENS } from './realistic.jsx'
import { bigTreeBlobs } from './models.jsx'

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

/** trees: [{ x, z, seed }] en coordenadas de mundo. */
export function Orchard({ trees, R = 3.25, real = true, canopy, opacity = 0.36 }) {
  return real ? <RealOrchard trees={trees} R={R} canopy={canopy} /> : <SchematicOrchard trees={trees} R={R} opacity={opacity} />
}

function RealOrchard({ trees, R, canopy }) {
  const parts = useMemo(() => {
    const blobs = [],
      fruits = [],
      limbs = [],
      trunks = []
    for (const t of trees) {
      const a = avocadoParts(R, t.seed)
      trunks.push({ pos: [t.x, 0.95, t.z] })
      for (const l of a.limbs)
        limbs.push({
          pos: [
            t.x + (Math.cos(l.a) * Math.sin(l.tilt) * l.len) / 2,
            1.9 + (Math.cos(l.tilt) * l.len) / 2,
            t.z + (Math.sin(l.a) * Math.sin(l.tilt) * l.len) / 2,
          ],
          rot: [Math.sin(l.a) * l.tilt, 0, -Math.cos(l.a) * l.tilt],
          scale: [1, l.len, 1],
        })
      for (const b of a.blobs) blobs.push({ pos: [t.x + b.x, b.y, t.z + b.z], scale: [b.r, b.r * b.sy, b.r], color: GREENS[b.c] })
      for (const f of a.fruits) fruits.push({ pos: [t.x + f.x, f.y, t.z + f.z], rot: [0.3, f.rot, 0.2], scale: [0.04, 0.056, 0.04] })
    }
    return { blobs, fruits, limbs, trunks }
  }, [trees, R])
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

function SchematicOrchard({ trees, R, opacity }) {
  const parts = useMemo(() => {
    const blobs = [],
      trunks = [],
      prints = []
    for (const t of trees) {
      trunks.push({ pos: [t.x, 0.9, t.z] })
      prints.push({ pos: [t.x, 0.02, t.z], rot: [-Math.PI / 2, 0, 0], scale: [R, R, 1] })
      bigTreeBlobs(R, t.seed).forEach((b, i) =>
        blobs.push({ pos: [t.x + b.x, b.y, t.z + b.z], scale: [b.r, b.r * 0.82, b.r], color: i % 2 ? '#7fb97a' : '#69a863' }),
      )
    }
    return { blobs, trunks, prints }
  }, [trees, R])
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
