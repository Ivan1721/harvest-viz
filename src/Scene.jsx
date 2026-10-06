import React, { useRef, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrthographicCamera, OrbitControls, Html, Line, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { orchard } from './data'
import { sim, step, chosenFor, YIELD_DIST, SHOULDER_Y } from './sim'

const C = {
  robot: '#2f6bff',
  human: '#ff8a1f',
  ground: '#f1f5fd',
  lane: '#dfe6f4',
  leaf: '#7fb97a',
  leaf2: '#69a863',
  leaf3: '#8cc58a',
  trunk: '#8f6f50',
}

// verde -> amarillo -> rojo según oclusión
function occColor(o) {
  const c = new THREE.Color()
  c.setHSL((1 - Math.min(1, o)) * 0.33, 0.78, 0.5)
  return c
}

// ---------- Árbol ----------
function Tree({ t, leaves }) {
  const branches = useMemo(() => {
    // 3 ramas que salen del tronco hacia el follaje (determinista por árbol)
    return [0, 1, 2].map((i) => {
      const a = (i / 3) * Math.PI * 2 + t.id * 0.9
      return { a, len: 0.8 + ((t.id * 7 + i * 3) % 5) * 0.06 }
    })
  }, [t.id])
  return (
    <group>
      <mesh position={[t.cx, 0.65, t.cz]} castShadow>
        <cylinderGeometry args={[0.1, 0.2, 1.3, 10]} />
        <meshStandardMaterial color={C.trunk} roughness={0.9} />
      </mesh>
      {[0.55, 0.85].map((h, i) => (
        <mesh key={i} position={[t.cx, h * 0.5, t.cz]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.2 - i * 0.04, 0.03, 6, 16]} />
          <meshStandardMaterial color="#7b5e43" />
        </mesh>
      ))}
      {branches.map((b, i) => (
        <mesh
          key={i}
          position={[t.cx + Math.cos(b.a) * 0.28, 1.4, t.cz + Math.sin(b.a) * 0.28]}
          rotation={[Math.sin(b.a) * 0.7, 0, -Math.cos(b.a) * 0.7]}
          castShadow
        >
          <cylinderGeometry args={[0.04, 0.07, b.len, 6]} />
          <meshStandardMaterial color={C.trunk} />
        </mesh>
      ))}
      {leaves.map((l, i) => (
        <mesh key={i} position={[l.x, l.y, l.z]} castShadow>
          <icosahedronGeometry args={[l.r, 1]} />
          <meshStandardMaterial color={i % 3 === 0 ? C.leaf3 : i % 2 ? C.leaf : C.leaf2} flatShading transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// ---------- Fruto (forma de palta) ----------
const avocadoGeom = (() => {
  const pts = []
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    // perfil de pera: cuello angosto arriba, base ancha abajo
    const r = Math.sin(t * Math.PI) * (0.55 + 0.45 * (1 - t)) * 0.9
    pts.push(new THREE.Vector2(Math.max(r, 0.001), (t - 0.5) * 1.5))
  }
  return new THREE.LatheGeometry(pts, 18)
})()

function Fruit({ f, state, selected, onSelect }) {
  const [hover, setHover] = useState(false)
  const tilt = useMemo(() => [Math.sin(f.x * 12.9) * 0.6, 0, Math.cos(f.z * 7.7) * 0.6], [f.x, f.z])
  if (state.state === 'done') return null
  const col = f.assignee === 'robot' ? C.robot : C.human
  const active = state.state === 'claimed'
  const s = f.r * 1.2 * (hover || selected ? 1.3 : 1.1)
  return (
    <group position={[f.x, f.y, f.z]}>
      <mesh
        geometry={avocadoGeom}
        scale={s * 1.8}
        rotation={tilt}
        castShadow
        onClick={(e) => { e.stopPropagation(); onSelect({ type: 'fruit', id: f.id }) }}
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
      >
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={active || selected ? 0.9 : 0.3} roughness={0.5} />
      </mesh>
      {(selected || active) && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[f.r * 2, f.r * 2.4, 32]} />
          <meshBasicMaterial color={col} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

// ---------- Hemisferio de puntos de vista ----------
function Viewpoints({ f }) {
  if (!f) return null
  const ch = chosenFor(f)
  const best = f.views[ch.idx]
  return (
    <group>
      {f.views.map((v, i) => {
        const isCh = i === ch.idx
        return (
          <mesh key={i} position={v.pos}>
            <sphereGeometry args={[isCh ? 0.065 : 0.035, 12, 12]} />
            <meshBasicMaterial color={isCh ? '#0ea5e9' : occColor(v.occ)} transparent opacity={isCh ? 1 : 0.9} />
          </mesh>
        )
      })}
      <Line points={[best.pos, [f.x, f.y, f.z]]} color="#0ea5e9" lineWidth={2} dashed dashSize={0.06} gapSize={0.04} />
      <mesh position={best.pos}>
        <ringGeometry args={[0.1, 0.125, 32]} />
        <meshBasicMaterial color="#0ea5e9" side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
    </group>
  )
}

// ---------- Robot ----------
const L1 = 1.3, L2 = 1.3
const DARK = '#2b3447'

function Robot({ selected, onSelect }) {
  const root = useRef(), arm = useRef(), l1 = useRef(), l2 = useRef(), wrist = useRef(), ring = useRef(), lidar = useRef()
  const fingers = useRef([])
  const wheelRefs = useRef([])
  useFrame(() => {
    const R = sim.robot
    root.current.position.x = R.x
    const dx = R.tip[0] - R.x, dy = R.tip[1] - SHOULDER_Y, dz = R.tip[2] - R.z
    const yaw = Math.atan2(dz, dx)
    const r = Math.hypot(dx, dz)
    let d = Math.hypot(r, dy)
    d = Math.min(Math.max(d, 0.4), L1 + L2 - 0.02)
    const cosE = (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2)
    const E = -Math.acos(Math.max(-1, Math.min(1, cosE)))
    const th1 = Math.atan2(dy, r) - Math.atan2(L2 * Math.sin(E), L1 + L2 * Math.cos(E))
    arm.current.rotation.y = -yaw
    l1.current.rotation.z = th1
    l2.current.rotation.z = E
    wrist.current.rotation.z = -(th1 + E) + Math.atan2(dy, r) * 0.3 // efector aprox. horizontal
    lidar.current.rotation.y += 0.08
    const open = R.state === 'grasp' ? (R.timer > 0.9 ? 0.02 : 0.07) : 0.07
    fingers.current.forEach((fg, i) => fg && (fg.position.z = (i ? -1 : 1) * open))
    wheelRefs.current.forEach((w) => w && (w.rotation.z -= 0.02))
    ring.current.material.opacity = R.paused ? 0.35 : 0.12
    ring.current.material.color.set(R.paused ? '#f59e0b' : C.robot)
  })
  return (
    <group ref={root} onClick={(e) => { e.stopPropagation(); onSelect({ type: 'robot', id: 'RB-01' }) }}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[YIELD_DIST, 48]} />
        <meshBasicMaterial color={C.robot} transparent opacity={0.12} />
      </mesh>
      {/* chasis */}
      <RoundedBox args={[1.3, 0.4, 0.9]} radius={0.07} smoothness={3} position={[0, 0.42, 0]} castShadow>
        <meshStandardMaterial color="#f4f6fb" roughness={0.4} />
      </RoundedBox>
      <RoundedBox args={[1.32, 0.07, 0.92]} radius={0.03} position={[0, 0.66, 0]}>
        <meshStandardMaterial color={C.robot} />
      </RoundedBox>
      {/* luces y sensores frontales */}
      {[-0.28, 0.28].map((z, i) => (
        <mesh key={i} position={[0.66, 0.45, z]}>
          <boxGeometry args={[0.03, 0.06, 0.14]} />
          <meshStandardMaterial color="#fde68a" emissive="#fde68a" emissiveIntensity={0.8} />
        </mesh>
      ))}
      {[[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0.2, z]}>
          <mesh ref={(m) => (wheelRefs.current[i] = m)} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.14, 18]} />
            <meshStandardMaterial color={DARK} roughness={0.8} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, z > 0 ? 0.075 : -0.075]}>
            <cylinderGeometry args={[0.09, 0.09, 0.02, 12]} />
            <meshStandardMaterial color="#9aa6bf" />
          </mesh>
        </group>
      ))}
      {/* torre + LiDAR */}
      <mesh position={[0.35, 0.95, 0.3]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.55, 8]} />
        <meshStandardMaterial color="#dfe5f2" />
      </mesh>
      <mesh ref={lidar} position={[0.35, 1.28, 0.3]}>
        <cylinderGeometry args={[0.1, 0.1, 0.09, 16]} />
        <meshStandardMaterial color={DARK} />
      </mesh>
      {/* base del brazo */}
      <mesh position={[0, 0.85, 0]} castShadow>
        <cylinderGeometry args={[0.17, 0.21, 0.4, 20]} />
        <meshStandardMaterial color="#dfe5f2" />
      </mesh>
      {/* caja de cosecha */}
      <RoundedBox args={[0.42, 0.28, 0.58]} radius={0.02} position={[-0.38, 0.84, 0]} castShadow>
        <meshStandardMaterial color="#c8a36a" roughness={0.9} />
      </RoundedBox>

      <group ref={arm} position={[0, SHOULDER_Y, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.22, 16]} />
          <meshStandardMaterial color={DARK} />
        </mesh>
        <group ref={l1}>
          <RoundedBox args={[L1, 0.13, 0.15]} radius={0.04} position={[L1 / 2, 0, 0]} castShadow>
            <meshStandardMaterial color={C.robot} roughness={0.35} />
          </RoundedBox>
          <group ref={l2} position={[L1, 0, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
              <meshStandardMaterial color={DARK} />
            </mesh>
            <RoundedBox args={[L2, 0.1, 0.12]} radius={0.035} position={[L2 / 2, 0, 0]} castShadow>
              <meshStandardMaterial color="#e6ebf6" roughness={0.35} />
            </RoundedBox>
            {/* muñeca + pinza + cámara */}
            <group position={[L2, 0, 0]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.075, 0.075, 0.16, 14]} />
                <meshStandardMaterial color={DARK} />
              </mesh>
              <group ref={wrist}>
                <RoundedBox args={[0.16, 0.14, 0.2]} radius={0.03} position={[0.1, 0, 0]}>
                  <meshStandardMaterial color={DARK} />
                </RoundedBox>
                <mesh position={[0.13, 0.1, 0]}>
                  <boxGeometry args={[0.1, 0.06, 0.08]} />
                  <meshStandardMaterial color="#1f2937" />
                </mesh>
                <mesh position={[0.185, 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.025, 0.025, 0.02, 12]} />
                  <meshStandardMaterial color="#38bdf8" emissive="#38bdf8" emissiveIntensity={1} />
                </mesh>
                {[0, 1].map((i) => (
                  <mesh key={i} ref={(m) => (fingers.current[i] = m)} position={[0.27, 0, i ? -0.07 : 0.07]}>
                    <boxGeometry args={[0.16, 0.04, 0.03]} />
                    <meshStandardMaterial color="#9aa6bf" />
                  </mesh>
                ))}
              </group>
            </group>
          </group>
        </group>
      </group>
      <Html position={[0, 1.5, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="tag" style={{ borderColor: C.robot }}>RB-01<span> · {sim.robot.state === 'idle' ? 'En espera' : 'Cosechando'}</span></div>
      </Html>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.95, 1.05, 48]} />
          <meshBasicMaterial color={C.robot} />
        </mesh>
      )}
    </group>
  )
}

// ---------- Humano ----------
function Human({ selected, onSelect }) {
  const root = useRef(), body = useRef(), legL = useRef(), legR = useRef(), armL = useRef(), armR = useRef(), zone = useRef()
  useFrame(() => {
    const H = sim.human
    root.current.position.set(H.x, 0, H.z)
    root.current.rotation.y = H.heading
    const walking = H.state === 'walk' || (H.state === 'idle' && H.walk > 0 && Math.abs(H.x - 7.5) > 0.03)
    const s = walking ? Math.sin(H.walk) : 0
    legL.current.rotation.x = s * 0.6
    legR.current.rotation.x = -s * 0.6
    armL.current.rotation.x = -s * 0.5
    armR.current.rotation.x = H.state === 'pick' ? -2.3 : s * 0.5
    body.current.position.y = 0.95 + (walking ? Math.abs(Math.cos(H.walk)) * 0.03 : 0)
    zone.current.material.opacity = sim.robot.paused ? 0.3 : 0.12
  })
  const skin = '#f1c9a5'
  return (
    <group ref={root} onClick={(e) => { e.stopPropagation(); onSelect({ type: 'human', id: 'HU-01' }) }}>
      <mesh ref={zone} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[YIELD_DIST * 0.6, 40]} />
        <meshBasicMaterial color={C.human} transparent opacity={0.12} />
      </mesh>
      <group ref={body} position={[0, 0.95, 0]}>
        {/* torso con chaleco reflectante */}
        <mesh castShadow>
          <capsuleGeometry args={[0.2, 0.42, 4, 14]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[0, 0.02, 0]} scale={[1.08, 1, 1.12]}>
          <capsuleGeometry args={[0.2, 0.3, 4, 14]} />
          <meshStandardMaterial color={C.human} />
        </mesh>
        {[-0.07, 0.08].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} scale={[1.1, 1, 1.14]}>
            <cylinderGeometry args={[0.21, 0.21, 0.035, 18, 1, true]} />
            <meshStandardMaterial color="#e5e7eb" emissive="#e5e7eb" emissiveIntensity={0.4} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {/* cabeza + casco */}
        <mesh position={[0, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.16, 18, 18]} />
          <meshStandardMaterial color={skin} />
        </mesh>
        <mesh position={[0, 0.57, 0]}>
          <sphereGeometry args={[0.18, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#fde047" />
        </mesh>
        <mesh position={[0, 0.575, 0.0]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.02, 18]} />
          <meshStandardMaterial color="#fde047" />
        </mesh>
        {/* brazos */}
        {[[armL, -0.27], [armR, 0.27]].map(([ref, x], i) => (
          <group key={i} ref={ref} position={[x, 0.2, 0]}>
            <mesh position={[0, -0.22, 0]}><capsuleGeometry args={[0.06, 0.3, 4, 8]} /><meshStandardMaterial color={C.human} /></mesh>
            <mesh position={[0, -0.48, 0]}><sphereGeometry args={[0.065, 10, 10]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
          </group>
        ))}
        {/* piernas + botas */}
        {[[legL, -0.1], [legR, 0.1]].map(([ref, x], i) => (
          <group key={i} ref={ref} position={[x, -0.35, 0]}>
            <mesh position={[0, -0.28, 0]}><capsuleGeometry args={[0.075, 0.4, 4, 8]} /><meshStandardMaterial color="#334155" /></mesh>
            <mesh position={[0, -0.58, 0.04]}><boxGeometry args={[0.13, 0.08, 0.22]} /><meshStandardMaterial color="#3f2d1e" /></mesh>
          </group>
        ))}
        {/* canasto de cosecha */}
        <mesh position={[0, -0.05, -0.28]}>
          <cylinderGeometry args={[0.16, 0.12, 0.2, 14]} />
          <meshStandardMaterial color="#c8a36a" roughness={0.9} />
        </mesh>
      </group>
      <Html position={[0, 2.05, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="tag" style={{ borderColor: C.human }}>HU-01<span> · Operario</span></div>
      </Html>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.5, 0.58, 40]} />
          <meshBasicMaterial color={C.human} />
        </mesh>
      )}
    </group>
  )
}

function Sim() {
  useFrame((_, dt) => step(dt))
  return null
}

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={() => { sim.selected = null }}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={C.ground} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[17, 2.6]} />
        <meshStandardMaterial color={C.lane} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, s * 2.5]} receiveShadow>
          <planeGeometry args={[17, 2.6]} />
          <meshStandardMaterial color="#dcefd6" />
        </mesh>
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-7 + i * 1.3, 0.012, 0]}>
          <planeGeometry args={[0.6, 0.05]} />
          <meshBasicMaterial color="#f8fafc" />
        </mesh>
      ))}
    </group>
  )
}

function World({ snap, onSelect, version }) {
  const sel = snap.selected
  const target = sel?.type === 'fruit' ? sel.id : snap.robot.targetId
  const focus = orchard.fruits.find((f) => f.id === target)
  const stMap = useMemo(() => Object.fromEntries(snap.fruits.map((f) => [f.id, f])), [snap.fruits])
  const leavesByTree = useMemo(() => {
    const m = {}
    orchard.leaves.forEach((l) => { (m[l.tree] ||= []).push(l) })
    return m
  }, [version])
  return (
    <>
      <color attach="background" args={['#e9eefb']} />
      <ambientLight intensity={1.35} />
      <directionalLight
        position={[6, 12, 5]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      <Sim />
      <Ground />
      {orchard.trees.map((t) => <Tree key={`${version}-${t.id}`} t={t} leaves={leavesByTree[t.id] || []} />)}
      {orchard.fruits.map((f) => stMap[f.id] && (
        <Fruit key={`${version}-${f.id}`} f={f} state={stMap[f.id]} selected={sel?.id === f.id} onSelect={onSelect} />
      ))}
      <Viewpoints f={focus && stMap[focus.id] && stMap[focus.id].state !== 'done' ? focus : null} />
      <Robot selected={sel?.type === 'robot'} onSelect={onSelect} />
      <Human selected={sel?.type === 'human'} onSelect={onSelect} />
    </>
  )
}

export default function Scene({ snap, onSelect, version }) {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <OrthographicCamera makeDefault position={[6, 16, 9]} zoom={50} near={-50} far={100} />
      <OrbitControls target={[0, 1, 0]} enablePan minZoom={30} maxZoom={140} minPolarAngle={0.3} maxPolarAngle={1.2} />
      <World snap={snap} onSelect={onSelect} version={version} />
    </Canvas>
  )
}
