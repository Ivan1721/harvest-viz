// Modelos 3D compartidos entre modos (presentacionales; las animaciones las manejan los padres con refs).
import React from 'react'
import * as THREE from 'three'
import { RoundedBox } from '@react-three/drei'

// Persona orientada hacia +X local. refs: { body, legL, legR, armL, armR, vest }
export function Person({ refs, vest = '#ff8a1f', scale = 1 }) {
  const skin = '#f1c9a5'
  return (
    <group scale={scale}>
      <group ref={refs.body} position={[0, 0.95, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.2, 0.42, 4, 14]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh scale={[1.08, 1, 1.12]}>
          <capsuleGeometry args={[0.2, 0.3, 4, 14]} />
          <meshStandardMaterial ref={refs.vest} color={vest} />
        </mesh>
        {[-0.07, 0.08].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} scale={[1.1, 1, 1.14]}>
            <cylinderGeometry args={[0.21, 0.21, 0.035, 18, 1, true]} />
            <meshStandardMaterial color="#e5e7eb" emissive="#e5e7eb" emissiveIntensity={0.4} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <mesh position={[0, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.16, 18, 18]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        <mesh position={[0, 0.57, 0]}>
          <sphereGeometry args={[0.18, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#fde047" />
        </mesh>
        {[[refs.armL, -0.27], [refs.armR, 0.27]].map(([ref, z], i) => (
          <group key={i} ref={ref} position={[0, 0.2, z]}>
            <mesh position={[0, -0.22, 0]}><capsuleGeometry args={[0.06, 0.3, 4, 8]} /><meshStandardMaterial color="#334155" /></mesh>
            <mesh position={[0, -0.48, 0]}><sphereGeometry args={[0.065, 10, 10]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
          </group>
        ))}
        {[[refs.legL, -0.1], [refs.legR, 0.1]].map(([ref, z], i) => (
          <group key={i} ref={ref} position={[0, -0.35, z]}>
            <mesh position={[0, -0.28, 0]}><capsuleGeometry args={[0.075, 0.4, 4, 8]} /><meshStandardMaterial color="#334155" /></mesh>
            <mesh position={[0.05, -0.58, 0]}><boxGeometry args={[0.22, 0.08, 0.13]} /><meshStandardMaterial color="#3f2d1e" /></mesh>
          </group>
        ))}
      </group>
    </group>
  )
}

// Árbol con copa de radio R (m), centrado en el origen del grupo
export function BigTree({ R = 3.25, seed = 0, opacity = 0.62 }) {
  const blobs = React.useMemo(() => {
    const out = []
    let s = seed * 9301 + 49297
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2, d = rnd() * R * 0.55
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 3.1 + (rnd() - 0.5) * 1.4, r: R * (0.5 + rnd() * 0.22) })
    }
    return out
  }, [R, seed])
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.28, 1.8, 10]} />
        <meshStandardMaterial color="#8f6f50" roughness={0.9} />
      </mesh>
      {blobs.map((b, i) => (
        <mesh key={i} position={[b.x, b.y, b.z]} scale={[1, 0.82, 1]} castShadow>
          <icosahedronGeometry args={[b.r, 1]} />
          <meshStandardMaterial color={i % 2 ? '#7fb97a' : '#69a863'} flatShading transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
      {/* huella de la copa */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[R, 48]} />
        <meshBasicMaterial color="#86c27f" transparent opacity={0.22} />
      </mesh>
    </group>
  )
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
  const tilt = 0.28
  return (
    <group rotation={[0, 0, -tilt]} position={[0.2, 0, 0]}>
      {[-0.22, 0.22].map((z, i) => (
        <mesh key={i} position={[0, height / 2, z]}>
          <boxGeometry args={[0.05, height, 0.05]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
      ))}
      {Array.from({ length: 7 }).map((_, i) => (
        <mesh key={i} position={[0, 0.3 + i * 0.3, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.44]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      ))}
    </group>
  )
}
