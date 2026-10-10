import React, { useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera, OrbitControls, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { MAP, ROWS, CARGO, CANOPY_R, routeLoop, toW } from './spec'
import { FLAG, onboard } from './run'
import { ZONES, zoneOf } from './hri'
import { Person, BigTree, Crate, Ladder } from '../shared/models'

// reloj de reproducción compartido (mutable, fuera de React)
export const play = { t: 0, playing: true, speed: 10, colorBy: 'rate', selected: null, zones: false, intent: false, driver: null, tEnd: 0 }

const ramp = (u) => new THREE.Color().setHSL((1 - Math.min(1, Math.max(0, u))) * 0.33, 0.8, 0.5)

function Clock({ run }) {
  useFrame((_, dt) => {
    if (!play.playing || !run || play.driver !== run.name) return
    play.t = Math.min(play.tEnd, play.t + Math.min(dt, 0.05) * play.speed)
    if (play.t >= play.tEnd) play.playing = false
  })
  return null
}

function Worker({ w, run, onSelect, selected }) {
  const root = useRef(), ladder = useRef(), picker = useRef(), tag = useRef(), disc = useRef()
  const refs = { body: useRef(), legL: useRef(), legR: useRef(), armL: useRef(), armR: useRef(), vest: useRef() }
  useFrame(() => {
    const i = Math.min(run.n - 1, Math.floor(play.t / run.dt))
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
    if (disc.current) {
      if (play.zones && run.hri) {
        const z = zoneOf(run.hri.dist[i * run.workers.length + (w.h - 1)])
        disc.current.material.color.set(z < 3 ? ZONES[z].color : '#9aa6bf')
      } else disc.current.material.color.copy(c)
    }
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

// Robot transportador con dimensiones reales del Clearpath Warthog (manual del fabricante):
// 1,52 × 1,38 × 0,83 m, neumático de 0,61 m de diámetro, holgura al suelo 0,254 m. Dirección diferencial (skid-steer):
// las ruedas no se orientan; al girar, las de un lado ruedan más rápido que las del otro.
// Capacidad de carga: 68 cajas × 15 u (parámetro del estudio, no físico del Warthog).
const ROBOT = { L: 1.52, W: 1.38, H: 0.83, r: 0.305, clear: 0.254, tireW: 0.25, capacity: 68 * 15 }
const WX = ROBOT.L / 2 - ROBOT.r            // centro de rueda a lo largo (±0,455 m)
const WZ = ROBOT.W / 2 - ROBOT.tireW / 2    // centro de rueda a lo ancho (±0,565 m)
function RobotCarrier({ run, onSelect, selected }) {
  const root = useRef(), load = useRef(), lab = useRef(), zr = useRef([])
  const wheels = useRef([])
  const st = useRef({ x: null, y: 0, h: 0, angL: 0, angR: 0 })
  useFrame(() => {
    const i = Math.min(run.n - 1, Math.floor(play.t / run.dt))
    const p = run.robot.pos
    const [px, , pz] = toW(p[i * 3], p[i * 3 + 1])
    const h = p[i * 3 + 2]
    root.current.position.set(px, 0, pz)
    root.current.rotation.y = h
    // Rodadura diferencial: distancia de cada lado = d ∓ dθ·(ancho de vía/2); el lado derecho es +z local
    const s = st.current
    if (s.x !== null) {
      const d = Math.hypot(px - s.x, pz - s.y)
      if (d < 3) {
        let dh = h - s.h
        dh = Math.atan2(Math.sin(dh), Math.cos(dh))
        s.angL += (d - dh * WZ) / ROBOT.r
        s.angR += (d + dh * WZ) / ROBOT.r
      }
    }
    s.x = px; s.y = pz; s.h = h
    wheels.current.forEach((m, k) => m && (m.rotation.y = -(k % 2 === 0 ? s.angR : s.angL)))
    zr.current.forEach((m) => m && (m.visible = play.zones))
    const ob = onboard(run, i)
    if (load.current) load.current.scale.y = Math.max(0.001, Math.min(1, ob / ROBOT.capacity))
    if (lab.current) lab.current.textContent = `RB-01 · a bordo ${Math.round(ob)} / ${ROBOT.capacity}`
  })
  return (
    <group ref={root} onClick={(e) => { e.stopPropagation(); onSelect('robot') }}>
      {ZONES.map((z, k) => (
        <group key={z.key} ref={(m) => (zr.current[k] = m)} visible={false}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07 + k * 0.001, 0]}>
            <ringGeometry args={[z.r - 0.04, z.r, 64]} />
            <meshBasicMaterial color={z.color} transparent opacity={0.9} depthTest={false} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
            <circleGeometry args={[z.r, 64]} />
            <meshBasicMaterial color={z.color} transparent opacity={0.07} depthWrite={false} />
          </mesh>
        </group>
      ))}
      {/* campo de detección (FOV 120°, 3 m) y LIDAR (±90°, 1.5 m) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[3, 28, -Math.PI / 3, (2 * Math.PI) / 3]} />
        <meshBasicMaterial color="#2f6bff" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <circleGeometry args={[1.5, 24, -Math.PI / 2, Math.PI]} />
        <meshBasicMaterial color="#2f6bff" transparent opacity={0.1} depthWrite={false} />
      </mesh>
      {/* chasis entre las ruedas: de la holgura (0,254 m) a la altura total (0,83 m) */}
      <mesh position={[0, (ROBOT.clear + ROBOT.H) / 2, 0]} castShadow>
        <boxGeometry args={[ROBOT.L - 0.2, ROBOT.H - ROBOT.clear, ROBOT.W - 2 * ROBOT.tireW - 0.04]} />
        <meshStandardMaterial color="#f4f6fb" roughness={0.4} />
      </mesh>
      <mesh position={[0, ROBOT.H + 0.02, 0]}>
        <boxGeometry args={[ROBOT.L - 0.16, 0.04, ROBOT.W - 2 * ROBOT.tireW + 0.1]} />
        <meshStandardMaterial color="#2f6bff" />
      </mesh>
      {[[WX, WZ], [WX, -WZ], [-WX, WZ], [-WX, -WZ]].map(([x, z], i) => (
        <group key={i} position={[x, ROBOT.r, z]}>
          {/* eje del cilindro (y local) alineado con z del vehículo; la rodadura gira sobre ese eje */}
          <group rotation={[Math.PI / 2, 0, 0]}>
            <group ref={(m) => (wheels.current[i] = m)}>
              <mesh>
                <cylinderGeometry args={[ROBOT.r, ROBOT.r, ROBOT.tireW, 24]} />
                <meshStandardMaterial color="#2b3447" roughness={0.9} />
              </mesh>
              {[ROBOT.tireW / 2 + 0.005, -ROBOT.tireW / 2 - 0.005].map((y) => (
                <mesh key={y} position={[0.17, y, 0]}>
                  <boxGeometry args={[0.18, 0.02, 0.07]} />
                  <meshStandardMaterial color="#9aa6bf" />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      ))}
      {/* carga a bordo: crece sobre la cubierta hasta la capacidad (68 cajas = 1020 u) */}
      <group ref={load} position={[0, ROBOT.H + 0.04, 0]} scale={[1, 0.001, 1]}>
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.9, 0.5, 0.75]} />
          <meshStandardMaterial color="#c8a36a" />
        </mesh>
      </group>
      <mesh position={[0.55, ROBOT.H + 0.3, 0.3]}>
        <cylinderGeometry args={[0.025, 0.025, 0.5, 10]} />
        <meshStandardMaterial color="#2b3447" />
      </mesh>
      <Html position={[0, 1.7, 0]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="tag" style={{ borderColor: '#2f6bff' }}><span ref={lab} style={{ color: 'inherit', fontWeight: 700 }}>RB-01</span></div>
      </Html>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[1.0, 1.1, 40]} />
          <meshBasicMaterial color="#2f6bff" />
        </mesh>
      )}
    </group>
  )
}

// Ruta anticipada del robot (legibilidad): próximos 8 s; cambia de color si se prevé un conflicto con un humano
function Intent({ run }) {
  const line = useRef(), cone = useRef()
  const AHEAD = Math.max(4, Math.round(8 / run.dt))
  const back = Math.min(3, AHEAD - 1)
  const buf = useMemo(() => new Float32Array((AHEAD + 1) * 3), [AHEAD])
  useFrame(() => {
    const on = play.intent && run.robot && run.robot.pos
    if (line.current) line.current.visible = !!on
    if (cone.current) cone.current.visible = !!on
    if (!on) return
    const i = Math.min(run.n - 1, Math.floor(play.t / run.dt))
    const p = run.robot.pos
    let last = i, minD = 1e9
    for (let k = 0; k <= AHEAD; k++) {
      const j = Math.min(run.n - 1, i + k)
      const w = toW(p[j * 3], p[j * 3 + 1])
      buf[k * 3] = w[0]; buf[k * 3 + 1] = 0.35; buf[k * 3 + 2] = w[2]
      if (run.hri) minD = Math.min(minD, run.hri.minD[j])
      last = j
    }
    const col = minD < 0.45 ? '#dc2626' : minD < 1.2 ? '#f59e0b' : '#16a34a'
    line.current.geometry.setPositions(buf)
    line.current.geometry.computeBoundingSphere()
    line.current.material.color.set(col)
    cone.current.material.color.set(col)
    cone.current.position.set(buf[AHEAD * 3], 0.35, buf[AHEAD * 3 + 2])
    const dx = buf[AHEAD * 3] - buf[(AHEAD - back) * 3], dz = buf[AHEAD * 3 + 2] - buf[(AHEAD - back) * 3 + 2]
    cone.current.rotation.set(Math.PI / 2, 0, 0)
    cone.current.rotation.order = 'YXZ'
    cone.current.rotation.y = Math.atan2(dx, dz)
    cone.current.visible = Math.hypot(dx, dz) > 0.05
  })
  return (
    <group>
      <Line ref={line} points={[[0, 0, 0], [0, 0, 1]]} lineWidth={4} color="#16a34a" transparent opacity={0.9} depthTest={false} frustumCulled={false} renderOrder={11} />
      <mesh ref={cone} renderOrder={12} frustumCulled={false}>
        <coneGeometry args={[0.35, 0.8, 12]} />
        <meshBasicMaterial color="#16a34a" depthTest={false} />
      </mesh>
    </group>
  )
}

// Cajas de trabajadores esperando al robot + pila en la zona de carga
function Boxes({ run }) {
  const refs = useRef([])
  const list = run.robot ? run.robot.boxes : []
  useFrame(() => {
    const i = Math.floor(play.t / run.dt)
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
    const i = Math.min(run.n - 1, Math.floor(play.t / run.dt))
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
      {run.robot && <Intent run={run} />}
      <Boxes run={run} />
      {run.workers.map((w) => <Worker key={`${version}-${w.h}`} w={w} run={run} onSelect={onSelect} selected={selected === w.h} />)}
      {run.robot && <RobotCarrier run={run} onSelect={onSelect} selected={selected === 'robot'} />}
    </>
  )
}

const PRESETS = {
  iso: { pos: [10, 24, 22], zoom: 27 },
  top: { pos: [0, 60, 0.01], zoom: 22 },
  side: { pos: [0, 8, 40], zoom: 25 },
}

function CamRig({ preset }) {
  const { camera, controls, size } = useThree()
  const fit = Math.min(1.5, size.width / 880, size.height / 600)
  React.useEffect(() => {
    const p = PRESETS[preset] || PRESETS.iso
    camera.position.set(...p.pos)
    camera.zoom = p.zoom * Math.max(0.3, fit)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    if (controls) { controls.target.set(0, 0, 0); controls.update() }
  }, [preset, camera, controls, fit])
  return null
}

export default function WorkloadScene({ run, selected, onSelect, version, preset = 'iso' }) {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: true }} onPointerMissed={() => onSelect(null)}>
      <OrthographicCamera makeDefault position={PRESETS.iso.pos} zoom={PRESETS.iso.zoom} near={-80} far={150} />
      <OrbitControls makeDefault target={[0, 0, 0]} enablePan minZoom={10} maxZoom={110} minPolarAngle={0} maxPolarAngle={1.45} />
      <CamRig preset={preset} />
      <World run={run} selected={selected} onSelect={onSelect} version={version} />
    </Canvas>
  )
}
