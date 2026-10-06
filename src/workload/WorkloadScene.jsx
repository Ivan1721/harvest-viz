import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrthographicCamera, OrbitControls, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { MAP, ROWS, CARGO, CANOPY_R, routeLoop, toW } from './spec'
import { FLAG, DT, onboard } from './run'
import { Person, BigTree, Crate, Ladder } from '../shared/models'

// reloj de reproducción compartido (mutable, fuera de React)
export const play = { t: 0, playing: true, speed: 10, colorBy: 'rate', selected: null }

const ramp = (u) => new THREE.Color().setHSL((1 - Math.min(1, Math.max(0, u))) * 0.33, 0.8, 0.5)

function Clock({ run }) {
  useFrame((_, dt) => {
    if (!play.playing || !run) return
    play.t = Math.min(run.series.t[run.n - 1], play.t + Math.min(dt, 0.05) * play.speed)
    if (play.t >= run.series.t[run.n - 1]) play.playing = false
  })
  return null
}

function Worker({ w, run, onSelect, selected }) {
  const root = useRef(), ladder = useRef(), picker = useRef(), tag = useRef(), disc = useRef()
  const refs = { body: useRef(), legL: useRef(), legR: useRef(), armL: useRef(), armR: useRef(), vest: useRef() }
  useFrame(() => {
    const i = Math.min(run.n - 1, Math.floor(play.t / DT))
    const k = i * 4
    const x = w.track[k], y = w.track[k + 1], hz = w.track[k + 2], hd = w.track[k + 3]
    const [px, , pz] = toW(x, y)
    const flag = w.flag[i]
    const walking = flag === 2 || flag === 3
    const phase = play.t * 7
    root.current.position.set(px, hz, pz)
    root.current.rotation.y = hd
    const s = flag === 2 ? Math.sin(phase) : 0
    refs.legL.current.rotation.z = s * 0.6
    refs.legR.current.rotation.z = -s * 0.6
    // brazos: levantados al cosechar; balanceo al caminar; al frente al colocar caja
    const reach = flag === 1 || flag === 5 ? 2.4 : flag === 3 ? 1.2 : 0
    refs.armL.current.rotation.z = reach + s * 0.5
    refs.armR.current.rotation.z = reach - s * 0.5
    refs.body.current.position.y = 0.95 + (flag === 2 ? Math.abs(Math.cos(phase)) * 0.03 : 0)
    // color del chaleco
    const c = play.colorBy === 'rate' ? ramp(w.rate[i] / run.rateMax) : new THREE.Color(FLAG[flag]?.color || '#9aa6bf')
    refs.vest.current.color.copy(c)
    if (disc.current) disc.current.material.color.copy(c)
    if (ladder.current) { ladder.current.visible = hz > 0.05 || flag === 5 || flag === 4 }
    if (picker.current) picker.current.visible = flag === 1
    if (tag.current) tag.current.className = 'tag small' + (selected ? ' sel' : '')
  })
  return (
    <group ref={root} onClick={(e) => { e.stopPropagation(); onSelect(w.h) }}>
      <mesh ref={disc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06 - 0, 0]} renderOrder={10}>
        <ringGeometry args={[0.38, 0.55, 28]} />
        <meshBasicMaterial color="#16a34a" depthTest={false} transparent opacity={0.95} />
      </mesh>
      <Person refs={refs} />
      {w.act === 'ladder' && <group ref={ladder} position={[-0.15, 0, 0]}><Ladder /></group>}
      {w.act === 'picker' && (
        <group ref={picker} position={[0.25, 1.2, 0.27]} rotation={[0, 0, -1.1]}>
          <mesh position={[0, 1.4, 0]}><cylinderGeometry args={[0.02, 0.02, 3.2, 6]} /><meshStandardMaterial color="#64748b" /></mesh>
          <mesh position={[-0.1, 3.0, 0]} rotation={[0, 0, -0.8]}><torusGeometry args={[0.1, 0.02, 6, 10, 4]} /><meshStandardMaterial color="#64748b" /></mesh>
        </group>
      )}
      <Html position={[0, 2.1, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={tag} className="tag small">H{w.h}</div>
      </Html>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <ringGeometry args={[0.55, 0.65, 32]} />
          <meshBasicMaterial color="#2f6bff" />
        </mesh>
      )}
    </group>
  )
}

// Vehículo 4WS (Warthog-like): 3.2 m de largo visual, ruedas r=0.5 m
function RobotCarrier({ run, onSelect, selected }) {
  const root = useRef(), fan = useRef(), load = useRef(), lab = useRef()
  const wheels = useRef([])
  useFrame(() => {
    const i = Math.min(run.n - 1, Math.floor(play.t / DT))
    const p = run.robot.pos
    const [px, , pz] = toW(p[i * 3], p[i * 3 + 1])
    root.current.position.set(px, 0, pz)
    root.current.rotation.y = p[i * 3 + 2]
    wheels.current.forEach((m) => m && (m.rotation.z -= 0.15))
    const ob = onboard(run, i)
    if (load.current) load.current.scale.y = Math.max(0.001, Math.min(1, ob / 600))
    if (lab.current) lab.current.textContent = `RB-01 · a bordo ${Math.round(ob)}`
  })
  return (
    <group ref={root} onClick={(e) => { e.stopPropagation(); onSelect('robot') }}>
      {/* campo de detección (FOV 120°, 3 m) y LIDAR (±90°, 1.5 m) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[3, 28, -Math.PI / 3, (2 * Math.PI) / 3]} />
        <meshBasicMaterial color="#2f6bff" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <circleGeometry args={[1.5, 24, -Math.PI / 2, Math.PI]} />
        <meshBasicMaterial color="#2f6bff" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0.78, 0]} castShadow>
        <boxGeometry args={[3.0, 0.5, 1.4]} />
        <meshStandardMaterial color="#f4f6fb" roughness={0.4} />
      </mesh>
      <mesh position={[0.2, 1.05, 0]}>
        <boxGeometry args={[3.04, 0.08, 1.44]} />
        <meshStandardMaterial color="#2f6bff" />
      </mesh>
      {[[1.2, 0.8], [1.2, -0.8], [-1.7, 0.8], [-1.7, -0.8]].map(([x, z], i) => (
        <group key={i} position={[x * 0.85, 0.5, z]}>
          <mesh ref={(m) => (wheels.current[i] = m)} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.5, 0.5, 0.35, 20]} />
            <meshStandardMaterial color="#2b3447" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {/* carga a bordo */}
      <group position={[-0.6, 1.1, 0]}>
        <mesh ref={load} position={[0, 0.0, 0]} scale={[1, 0.001, 1]}>
          <boxGeometry args={[1.3, 1.0, 1.1]} />
          <meshStandardMaterial color="#c8a36a" />
        </mesh>
      </group>
      <mesh position={[1.1, 1.35, 0.4]}>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 10]} />
        <meshStandardMaterial color="#2b3447" />
      </mesh>
      <Html position={[0, 2.1, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="tag" style={{ borderColor: '#2f6bff' }}><span ref={lab} style={{ color: 'inherit', fontWeight: 700 }}>RB-01</span></div>
      </Html>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[2.0, 2.15, 40]} />
          <meshBasicMaterial color="#2f6bff" />
        </mesh>
      )}
    </group>
  )
}

// Cajas de trabajadores esperando al robot + pila en la zona de carga
function Boxes({ run }) {
  const refs = useRef([])
  const list = run.robot ? run.robot.boxes : []
  useFrame(() => {
    const i = Math.floor(play.t / DT)
    refs.current.forEach((m, k) => { if (m) m.visible = i >= list[k].idx && i < list[k].picked })
  })
  return (
    <group>
      {list.map((b, k) => {
        const [x, , z] = toW(b.x, b.y)
        return (
          <group key={k} ref={(m) => (refs.current[k] = m)} position={[x, 0, z]} visible={false}>
            <Crate size={[0.6, 0.4, 0.5]} color="#e0b04f" />
          </group>
        )
      })}
    </group>
  )
}

function CargoPile({ run }) {
  const g = useRef()
  const slots = useMemo(() => {
    const out = []
    for (let k = 0; k < 60; k++) out.push([(k % 10) * 0.48 - 2.2, Math.floor(k / 30) * 0.34, (Math.floor(k / 10) % 3) * 0.42 - 0.4])
    return out
  }, [])
  useFrame(() => {
    const i = Math.min(run.n - 1, Math.floor(play.t / DT))
    const nBox = Math.min(60, Math.round(run.series.cargo[i] / 15))
    g.current.children.forEach((c, k) => (c.visible = k < nBox))
  })
  const [cx, , cz] = toW((CARGO.x[0] + CARGO.x[1]) / 2, (CARGO.y[0] + CARGO.y[1]) / 2)
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.03, cz]}>
        <planeGeometry args={[CARGO.x[1] - CARGO.x[0], CARGO.y[1] - CARGO.y[0]]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} />
      </mesh>
      <group ref={g} position={[cx, 0, cz]}>
        {slots.map((s, k) => <Crate key={k} position={s} size={[0.44, 0.3, 0.38]} />)}
      </group>
    </group>
  )
}

function Ground({ run }) {
  const route = useMemo(() => routeLoop(run.meta.row).map(([x, y]) => { const p = toW(x, y); return [p[0], 0.05, p[2]] }), [run.meta.row])
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#f1f5fd" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
        <planeGeometry args={[MAP.w, MAP.h]} />
        <meshStandardMaterial color="#e3ecd9" />
      </mesh>
      {Object.entries(ROWS).map(([r, R]) => R.x.map((tx, i) => {
        const [x, , z] = toW(tx, R.y)
        return (
          <group key={`${r}-${i}`} position={[x, 0, z]} visible>
            <BigTree R={CANOPY_R} seed={+r * 7 + i} opacity={0.36} />
          </group>
        )
      }))}
      {run.robot && <Line points={route} color="#2f6bff" lineWidth={1.5} dashed dashSize={0.5} gapSize={0.35} transparent opacity={0.7} />}
    </group>
  )
}

function World({ run, selected, onSelect, version }) {
  return (
    <>
      <color attach="background" args={['#e9eefb']} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[10, 22, 8]} intensity={1.4} castShadow shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} />
      <Clock run={run} />
      <Ground run={run} />
      <CargoPile run={run} />
      <Boxes run={run} />
      {run.workers.map((w) => <Worker key={`${version}-${w.h}`} w={w} run={run} onSelect={onSelect} selected={selected === w.h} />)}
      {run.robot && <RobotCarrier run={run} onSelect={onSelect} selected={selected === 'robot'} />}
    </>
  )
}

export default function WorkloadScene({ run, selected, onSelect, version }) {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }} onPointerMissed={() => onSelect(null)}>
      <OrthographicCamera makeDefault position={[10, 24, 22]} zoom={27} near={-80} far={150} />
      <OrbitControls target={[0, 0, 0]} enablePan minZoom={14} maxZoom={110} minPolarAngle={0.3} maxPolarAngle={1.25} />
      <World run={run} selected={selected} onSelect={onSelect} version={version} />
    </Canvas>
  )
}
