import React, { Suspense, lazy, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera, OrbitControls, Line, Environment, Sky, useGLTF } from '@react-three/drei'
import { TagLayer } from '../shared/TagLayer.jsx'
import * as THREE from 'three'
import { MAP, toW, setMap } from './spec.js'
import { sceneGeometry } from './geometry.js'
import { ROBOTS } from '../hrsim/robots.js'
import { FLAG } from './run.js'
import { ZONES, zoneOf } from './hri.js'
import { colorRobot, etiquetaRobot, robotsDeRun, selRobot } from './flota.js'
import { protectionDistance } from '../hrsim/ssm.js'
import { Person, Crate, CrateReal, CrateSet, Ladder } from '../shared/models.jsx'
import { RealGround, RealGroundAlta, SkyBackground } from '../shared/realistic.jsx'
import { Orchard } from '../shared/orchard.jsx'

import { play, anim, advance } from './playback.js'
import { sampleAt, trackAt } from './interp.js'
import { PerfProbe, perfEnabled } from './perf.jsx'
import { RecorderProbe } from './recorder.jsx'
import { t } from '../i18n/index.js'
const ease = (u) => u * u * (3 - 2 * u)
const lerp = (a, b, u) => a + (b - a) * u
const ramp = (u) => new THREE.Color().setHSL((1 - Math.min(1, Math.max(0, u))) * 0.33, 0.8, 0.5)

function Clock({ run }) {
  useFrame((_, dt) => {
    advance(run, dt)
  })
  return null
}

function Worker({ w, run, onSelect, selected, real }) {
  const root = useRef(),
    lift = useRef(),
    ladder = useRef(),
    picker = useRef(),
    disc = useRef()
  const refs = { body: useRef(), legL: useRef(), legR: useRef(), armL: useRef(), armR: useRef(), vest: useRef(), fill: useRef() }
  // protocolo worker_loads (el del estudio): camina con las manos vacias hasta la caja, la carga al robot
  // de pie durante 3,6 s por caja (bandera 3) y vuelve. place = progreso del levantamiento de cada caja.
  const trip = useMemo(() => {
    const n = w.flag.length,
      place = new Float32Array(n)
    let run0 = -1
    for (let k = 0; k < n; k++) {
      if (w.flag[k] === 3) {
        if (run0 < 0) run0 = k
        place[k] = (((k - run0 + 1) * run.dt) / 3.6) % 1 || 1 // 3,6 s por caja, sea cual sea el paso de la corrida
      } else run0 = -1
    }
    return { place }
  }, [w, run.dt])
  const carryRef = useRef(),
    st = useRef({ aL: 0, aR: 0 }),
    tmp = useRef([0, 0, 0, 0])
  const prodMax = useMemo(() => {
    let m = 1
    for (let k = 0; k < w.prod.length; k++) if (w.prod[k] > m) m = w.prod[k]
    return m
  }, [w])
  useFrame((_, dtReal) => {
    // estado discreto en el tick i; posición, altura y rumbo interpolados entre i e i+1
    const smp = sampleAt(run.n, run.dt, play.t),
      i = smp.i
    const [x, y, hz, hd] = trackAt(w.track, 4, smp, tmp.current, { angleIdx: 3 })
    const [px, , pz] = toW(x, y)
    const flag = w.flag[i]
    const phase = anim.t * 7
    // en el suelo: anillo y escalera; elevado (sobre la escalera o la plataforma): solo la persona y lo que lleva
    root.current.position.set(px, 0, pz)
    root.current.rotation.y = hd
    lift.current.position.y = hz
    const carrying = !!run.meta.simulated && w.state && w.state[i] === 8 // estado exacto del simulador: lleva la caja hasta el punto de entrega
    const cs = flag === 3 || carrying ? 2 : 0 // 2 = cargando una caja
    const s = flag === 2 ? Math.sin(phase) : 0
    refs.legL.current.rotation.z = s * 0.6
    refs.legR.current.rotation.z = -s * 0.6
    // brazos: ciclo de cosecha (alcanzar, arrancar, llevar a la bolsa), balanceo al caminar, caja al frente al acarrear
    let tL, tR
    if (flag === 1 || flag === 5) {
      const u = (anim.t * 0.42 + w.h * 0.173) % 1
      tL = 2.3
      tR = u < 0.5 ? lerp(1.2, 2.55, ease(u / 0.5)) : u < 0.78 ? lerp(2.55, 0.8, ease((u - 0.5) / 0.28)) : 0.8
    } else if (flag === 3) {
      tL = tR = lerp(0.9, 2.0, ease(trip.place[i]))
    } else if (carrying) {
      tL = tR = 1.6
    } else {
      tL = s * 0.5
      tR = -s * 0.5
    }
    const a = st.current,
      kk = Math.min(1, dtReal * 12)
    a.aL += (tL - a.aL) * kk
    a.aR += (tR - a.aR) * kk
    refs.armL.current.rotation.z = a.aL
    refs.armR.current.rotation.z = a.aR
    refs.body.current.position.y = 0.95 + (flag === 2 ? Math.abs(Math.cos(phase)) * 0.03 : 0)
    if (carryRef.current) {
      carryRef.current.visible = cs > 0
      const pl = carrying ? 0.6 : trip.place[i]
      carryRef.current.position.y = lerp(0.3, 1.15, ease(pl))
      carryRef.current.position.x = lerp(0.4, 0.75, ease(pl))
    }
    // color del chaleco
    const c = play.colorBy === 'rate' ? ramp(w.rate[i] / run.rateMax) : new THREE.Color(FLAG[flag]?.color || '#9aa6bf')
    refs.vest.current.color.copy(c)
    if (disc.current) {
      if (play.zones && run.hri) {
        const z = zoneOf(run.hri.dist[i * run.workers.length + (w.h - 1)])
        disc.current.material.color.set(z < 3 ? ZONES[z].color : '#9aa6bf')
      } else disc.current.material.color.copy(c)
    }
    if (refs.fill.current) refs.fill.current.scale.setScalar(0.25 + 0.75 * Math.min(1, w.prod[i] / prodMax))
    if (ladder.current) {
      ladder.current.visible = hz > 0.05 || flag === 5 || flag === 4
    }
    if (picker.current) picker.current.visible = flag === 1
  })
  return (
    <group
      ref={root}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(w.h)
      }}
    >
      <mesh ref={disc} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06 - 0, 0]} renderOrder={10}>
        <ringGeometry args={[0.38, 0.55, 28]} />
        <meshBasicMaterial color="#16a34a" depthTest={false} transparent opacity={0.95} />
      </mesh>
      {w.act === 'ladder' && (
        <group ref={ladder} position={[-0.15, 0, 0]}>
          <Ladder />
        </group>
      )}
      <group ref={lift}>
        <Person refs={refs} real={real} />
        <group ref={carryRef} position={[0.36, 0.82, 0]} visible={false}>
          {real ? <CrateReal size={[0.4, 0.3, 0.6]} /> : <Crate size={[0.4, 0.3, 0.6]} color="#e0b04f" />}
        </group>
        {w.act === 'picker' && (
          <group ref={picker} position={[0.25, 1.2, 0.27]} rotation={[0, 0, -1.1]}>
            <mesh position={[0, 1.4, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 3.2, 6]} />
              <meshStandardMaterial color="#64748b" />
            </mesh>
            <mesh position={[-0.1, 3.0, 0]} rotation={[0, 0, -0.8]}>
              <torusGeometry args={[0.1, 0.02, 6, 10, 4]} />
              <meshStandardMaterial color="#64748b" />
            </mesh>
          </group>
        )}
        {/* etiqueta (capa HTML en pantalla y exportación de video) */}
        <object3D position={[0, 2.1, 0]} userData={{ videoTag: `H${w.h}`, tagClass: selected ? 'small sel' : 'small' }} />
      </group>
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
const WX = ROBOT.L / 2 - ROBOT.r // centro de rueda a lo largo (±0,455 m)
const WZ = ROBOT.W / 2 - ROBOT.tireW / 2 // centro de rueda a lo ancho (±0,565 m)
// R2: el Warthog real (mallas oficiales de Clearpath, BSD-3; public/modelos/LEEME.md), generado por
// scripts/warthog-glb.mjs con el origen en el suelo y las cuatro ruedas como nodos `rueda_*` que giran en z
const WARTHOG_GLB = 'modelos/warthog.glb'
const CUBIERTA_REAL = 0.64 // m: tope del chasis entre los guardabarros, donde va la carga

function WarthogReal({ ruedas, onListo }) {
  const { scene } = useGLTF(import.meta.env.BASE_URL + WARTHOG_GLB)
  const obj = useMemo(() => {
    const c = scene.clone(true)
    c.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true
    })
    return c
  }, [scene])
  // ruedas del lado derecho (+z local, como en el modelo simple) giran con la rodadura derecha
  useLayoutEffect(() => {
    const rs = []
    obj.traverse((o) => o.name.startsWith('rueda_') && rs.push({ m: o, der: o.position.z > 0 }))
    ruedas.current = rs
    onListo(true)
    return () => {
      ruedas.current = []
      onListo(false)
    }
  }, [obj, ruedas, onListo])
  return <primitive object={obj} />
}

// `rb` son las series del robot (con flota, las de cada uno; si no, `run.robot`); `k` es su número (0 = RB-01)
function RobotCarrier({ run, rb = run.robot, k = 0, onSelect, selected, alta }) {
  const color = colorRobot(k),
    etiqueta = etiquetaRobot(k),
    hri = run.hri?.porRobot?.[k] ?? run.hri
  const root = useRef(),
    load = useRef(),
    lab = useRef(etiqueta),
    zr = useRef([])
  const wheels = useRef([]),
    ruedasReal = useRef([])
  const st = useRef({ x: null, y: 0, h: 0, angL: 0, angR: 0 })
  const shown = useRef({ v: 0, t: 0 }),
    rtmp = useRef([0, 0, 0])
  const prot = useRef(),
    warn = useRef()
  const ssm = run.meta?.params?.ssm?.enabled ? run.meta.params.ssm : null
  // huertos generados: el robot elegido (el modelo 3D es el Warthog escalado a sus medidas) y su capacidad real
  const spec = ROBOTS[run.meta?.params?.robotTipo] || null
  const unit = run.meta?.params?.maxProd ?? 15 // kg (o unidades) por caja del cultivo
  const cap = (run.meta?.params?.capacityBoxes ?? 68) * unit
  const body = spec ? [spec.largo / ROBOT.L, spec.alto / ROBOT.H, spec.ancho / ROBOT.W] : [1, 1, 1]
  // calidad alta: el Warthog real (el mapa de MATLAB y el robot Warthog); los otros robots siguen con el modelo simple
  const real = alta && (!spec || run.meta?.params?.robotTipo === 'warthog')
  // mientras baja el modelo real se sigue viendo el simple
  const [listo, setListo] = React.useState(false)
  const usarReal = real && listo
  useFrame(() => {
    const smp = sampleAt(run.n, run.dt, play.t),
      i = smp.i
    const [rx, ry, h] = trackAt(rb.pos, 3, smp, rtmp.current, { angleIdx: 2 })
    const [px, , pz] = toW(rx, ry)
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
    s.x = px
    s.y = pz
    s.h = h
    wheels.current.forEach((m, k) => m && (m.rotation.y = -(k % 2 === 0 ? s.angR : s.angL)))
    ruedasReal.current.forEach((w) => (w.m.rotation.z = -(w.der ? s.angR : s.angL)))
    zr.current.forEach((m) => m && (m.visible = play.zones))
    // campos de seguridad (fase 3, perfil hri): radio según la velocidad del tick, color según el estado
    if (ssm && hri) {
      const v = hri.vInst[i],
        rs = rb.status ? rb.status[i] : 0
      const sp = protectionDistance(v, ssm)
      prot.current.scale.set(sp, sp, 1)
      warn.current.scale.set(sp + ssm.warn, sp + ssm.warn, 1)
      prot.current.material.color.set(rs === 3 ? '#dc2626' : '#f59e0b')
      prot.current.material.opacity = rs === 3 ? 0.95 : 0.6
      warn.current.material.color.set(rs === 4 ? '#8b5cf6' : '#94a3b8')
      warn.current.material.opacity = rs === 4 ? 0.9 : 0.4
    }
    // la carga a bordo cambia con la tasa de carga (3,6 s por caja) y de descarga (1,44 s por caja), no de golpe
    const target = rb.onboard[Math.min(i, run.n - 1)],
      sh = shown.current,
      dts = play.t - sh.t
    if (dts < 0 || dts > 4) sh.v = target
    else if (target > sh.v) sh.v = Math.min(target, sh.v + (unit / 3.6) * dts)
    else sh.v = Math.max(target, sh.v - (unit / 1.44) * dts)
    sh.t = play.t
    if (load.current) load.current.scale.y = Math.max(0.001, Math.min(1, sh.v / cap))
    lab.current = `${etiqueta} · ${t('a bordo {v} / {cap}', { v: Math.round(sh.v), cap })}`
  })
  return (
    <group
      ref={root}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(selRobot(k))
      }}
    >
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
      {ssm && (
        <>
          {/* campo de protección S_p(v) y de advertencia S_p(v) + margen; anillos de radio 1 escalados cada cuadro */}
          <mesh ref={prot} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
            <ringGeometry args={[0.96, 1, 72]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.6} depthTest={false} />
          </mesh>
          <mesh ref={warn} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.081, 0]}>
            <ringGeometry args={[0.975, 1, 72]} />
            <meshBasicMaterial color="#94a3b8" transparent opacity={0.4} depthTest={false} />
          </mesh>
        </>
      )}
      {/* campo de detección (FOV 120°, 3 m) y LIDAR (±90°, 1.5 m) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <circleGeometry args={[3, 28, -Math.PI / 3, (2 * Math.PI) / 3]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <circleGeometry args={[1.5, 24, -Math.PI / 2, Math.PI]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} depthWrite={false} />
      </mesh>
      {real && (
        <Suspense fallback={null}>
          <WarthogReal ruedas={ruedasReal} onListo={setListo} />
        </Suspense>
      )}
      {usarReal && (
        <group ref={load} position={[0, CUBIERTA_REAL, 0]} scale={[1, 0.001, 1]}>
          <mesh position={[0, 0.25, 0]} castShadow>
            <boxGeometry args={[0.9, 0.5, 0.75]} />
            <meshStandardMaterial color="#c8a36a" />
          </mesh>
        </group>
      )}
      <group scale={body} visible={!usarReal}>
        {/* chasis entre las ruedas: de la holgura (0,254 m) a la altura total (0,83 m) */}
        <mesh position={[0, (ROBOT.clear + ROBOT.H) / 2, 0]} castShadow>
          <boxGeometry args={[ROBOT.L - 0.2, ROBOT.H - ROBOT.clear, ROBOT.W - 2 * ROBOT.tireW - 0.04]} />
          <meshStandardMaterial color="#f4f6fb" roughness={0.4} />
        </mesh>
        <mesh position={[0, ROBOT.H + 0.02, 0]}>
          <boxGeometry args={[ROBOT.L - 0.16, 0.04, ROBOT.W - 2 * ROBOT.tireW + 0.1]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {[
          [WX, WZ],
          [WX, -WZ],
          [-WX, WZ],
          [-WX, -WZ],
        ].map(([x, z], i) => (
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
        <group ref={usarReal ? undefined : load} position={[0, ROBOT.H + 0.04, 0]} scale={[1, 0.001, 1]}>
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[0.9, 0.5, 0.75]} />
            <meshStandardMaterial color="#c8a36a" />
          </mesh>
        </group>
        <mesh position={[0.55, ROBOT.H + 0.3, 0.3]}>
          <cylinderGeometry args={[0.025, 0.025, 0.5, 10]} />
          <meshStandardMaterial color="#2b3447" />
        </mesh>
      </group>
      <object3D position={[0, 1.7, 0]} userData={{ videoTag: () => lab.current, videoAccent: true, tagColor: color }} />
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[1.0, 1.1, 40]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  )
}

// Carro del robot de arrastre `T` (la pose que registró el motor): remolque con enganche en el eje
function Trailer({ run, T }) {
  const g = useRef()
  const cr = ROBOTS[run.meta.params.robotTipo]?.carro || { largo: 1.2, ancho: 0.92 }
  useFrame(() => {
    const i = Math.min(run.n - 1, Math.max(0, Math.floor(play.t / run.dt)))
    const [px, , pz] = toW(T.x[i], T.y[i])
    g.current.position.set(px, 0, pz)
    g.current.rotation.y = T.th[i]
  })
  return (
    <group ref={g}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[cr.largo, 0.35, cr.ancho]} />
        <meshStandardMaterial color="#9a7b4f" roughness={0.9} />
      </mesh>
      {[-1, 1].map((sd) => (
        <mesh key={sd} position={[0, 0.2, (sd * cr.ancho) / 2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.1, 16]} />
          <meshStandardMaterial color="#2b3447" />
        </mesh>
      ))}
      {/* barra de tiro hacia el enganche */}
      <mesh position={[cr.largo / 2 + 0.45, 0.35, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.9, 6]} />
        <meshStandardMaterial color="#2b3447" />
      </mesh>
    </group>
  )
}

// Ruta anticipada del robot `rb` (legibilidad): próximos 8 s; cambia de color si se prevé un conflicto con un humano
function Intent({ run, rb = run.robot, hri = run.hri }) {
  const line = useRef(),
    cone = useRef()
  const AHEAD = Math.max(4, Math.round(8 / run.dt))
  const back = Math.min(3, AHEAD - 1)
  const buf = useMemo(() => new Float32Array((AHEAD + 1) * 3), [AHEAD])
  const lastI = useRef(-1),
    coneOn = useRef(false)
  useFrame(() => {
    const on = play.intent && rb && rb.pos
    if (line.current) line.current.visible = !!on
    if (cone.current) cone.current.visible = !!on && coneOn.current
    if (!on) return (lastI.current = -1)
    const i = Math.min(run.n - 1, Math.floor(play.t / run.dt))
    if (i === lastI.current) return // la ruta solo cambia de tick en tick: no rehacer la geometría en cada cuadro
    lastI.current = i
    const p = rb.pos
    let minD = 1e9
    for (let k = 0; k <= AHEAD; k++) {
      const j = Math.min(run.n - 1, i + k)
      const w = toW(p[j * 3], p[j * 3 + 1])
      buf[k * 3] = w[0]
      buf[k * 3 + 1] = 0.35
      buf[k * 3 + 2] = w[2]
      if (hri) minD = Math.min(minD, hri.minD[j])
    }
    const col = minD < 0.45 ? '#dc2626' : minD < 1.2 ? '#f59e0b' : '#16a34a'
    line.current.geometry.setPositions(buf)
    line.current.geometry.computeBoundingSphere()
    line.current.material.color.set(col)
    cone.current.material.color.set(col)
    cone.current.position.set(buf[AHEAD * 3], 0.35, buf[AHEAD * 3 + 2])
    const dx = buf[AHEAD * 3] - buf[(AHEAD - back) * 3],
      dz = buf[AHEAD * 3 + 2] - buf[(AHEAD - back) * 3 + 2]
    cone.current.rotation.set(Math.PI / 2, 0, 0)
    cone.current.rotation.order = 'YXZ'
    cone.current.rotation.y = Math.atan2(dx, dz)
    coneOn.current = Math.hypot(dx, dz) > 0.05
    cone.current.visible = coneOn.current
  })
  return (
    <group>
      <Line
        ref={line}
        points={[
          [0, 0, 0],
          [0, 0, 1],
        ]}
        lineWidth={4}
        color="#16a34a"
        transparent
        opacity={0.9}
        depthTest={false}
        frustumCulled={false}
        renderOrder={11}
      />
      <mesh ref={cone} renderOrder={12} frustumCulled={false}>
        <coneGeometry args={[0.35, 0.8, 12]} />
        <meshBasicMaterial color="#16a34a" depthTest={false} />
      </mesh>
    </group>
  )
}

// Cajas de trabajadores esperando al robot + pila en la zona de carga (con instancias)
function Boxes({ run, real }) {
  const list = useMemo(() => (run.robot ? run.robot.boxes.map((b) => ({ ...b, w: toW(b.x, b.y) })) : []), [run])
  if (!list.length) return null
  return (
    <CrateSet
      capacity={list.length}
      real={real}
      size={real ? [0.6, 0.3, 0.4] : [0.6, 0.4, 0.5]}
      color={real ? undefined : '#e0b04f'}
      frame={(put) => {
        const i = Math.floor(play.t / run.dt)
        for (const b of list) if (i >= b.idx && i < b.picked) put(b.w[0], 0, b.w[2])
      }}
    />
  )
}

const PILE = Array.from({ length: 60 }, (_, k) => [(k % 10) * 0.48 - 2.2, Math.floor(k / 30) * 0.34, (Math.floor(k / 10) % 3) * 0.42 - 0.4])
function CargoPile({ run, real, geom }) {
  const CARGO = geom.cargo
  const [cx, , cz] = toW((CARGO.x[0] + CARGO.x[1]) / 2, (CARGO.y[0] + CARGO.y[1]) / 2)
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.03, cz]}>
        <planeGeometry args={[CARGO.x[1] - CARGO.x[0], CARGO.y[1] - CARGO.y[0]]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} />
      </mesh>
      <group position={[cx, 0, cz]}>
        <CrateSet
          capacity={PILE.length}
          real={real}
          size={real ? [0.6, 0.3, 0.4] : [0.44, 0.3, 0.38]}
          frame={(put) => {
            const i = Math.min(run.n - 1, Math.floor(play.t / run.dt))
            const nBox = Math.min(PILE.length, Math.round(run.series.cargo[i] / (run.meta?.params?.maxProd ?? 15)))
            for (let k = 0; k < nBox; k++) put(...PILE[k])
          }}
        />
      </group>
    </group>
  )
}

// H7: acopio con acopiador — bins llenos en el acopio (hasta el tope) y el camión, con los bins que ya cargó,
// cuando no está de viaje. Se actualiza por cuadro según el instante de la reproducción.
const BIN = [1.2, 0.75, 1.0]
function AcopioBins({ run, geom }) {
  const CARGO = geom.cargo
  const [cx, , cz] = toW((CARGO.x[0] + CARGO.x[1]) / 2, (CARGO.y[0] + CARGO.y[1]) / 2)
  const tope = Math.min(24, run.acopio.cfg.topeBins || 8),
    cap = Math.min(12, run.acopio.cfg.camionBins || 4)
  const bins = useRef([]),
    camion = useRef(),
    carga = useRef([])
  useFrame(() => {
    const i = Math.min(run.n - 1, Math.floor(play.t / run.dt))
    const nb = run.acopio.bins[i],
      cam = run.acopio.camion[i]
    bins.current.forEach((m, k) => m && (m.visible = k < nb))
    if (camion.current) camion.current.visible = cam >= 0
    carga.current.forEach((m, k) => m && (m.visible = k < cam))
  })
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.03, cz]}>
        <planeGeometry args={[CARGO.x[1] - CARGO.x[0], CARGO.y[1] - CARGO.y[0]]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.35} />
      </mesh>
      {Array.from({ length: tope }, (_, k) => (
        <mesh
          key={k}
          ref={(m) => (bins.current[k] = m)}
          position={[cx - 2 + (k % 4) * 1.35, BIN[1] / 2 + Math.floor(k / 8) * BIN[1], cz + 1.6 + (Math.floor(k / 4) % 2) * 1.15]}
          visible={false}
          castShadow
        >
          <boxGeometry args={BIN} />
          <meshStandardMaterial color="#8a5a2b" />
        </mesh>
      ))}
      <group ref={camion} position={[cx + 5, 0, cz + 1.8]} visible={false}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[1.0 + cap * 1.3, 0.25, 2.2]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
        <mesh position={[(1.0 + cap * 1.3) / 2 + 0.8, 1.2, 0]} castShadow>
          <boxGeometry args={[1.5, 1.6, 2.2]} />
          <meshStandardMaterial color="#1f3a8a" />
        </mesh>
        {Array.from({ length: cap }, (_, k) => (
          <mesh key={k} ref={(m) => (carga.current[k] = m)} position={[-(cap * 1.3) / 2 + 0.65 + k * 1.3, 0.68 + BIN[1] / 2, 0]} visible={false}>
            <boxGeometry args={BIN} />
            <meshStandardMaterial color="#8a5a2b" />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// Parrón (uva de mesa): postes en cada planta y un techo verde semitransparente a la altura del parrón; la opacidad
// sigue al control de transparencia del follaje para ver a cosecheros y robot debajo
function Parron({ trees, techo }) {
  const posts = useRef(),
    roof = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    trees.forEach((t, k) => posts.current.setMatrixAt(k, m.makeTranslation(t.x, techo.z / 2, t.z)))
    posts.current.instanceMatrix.needsUpdate = true
    posts.current.computeBoundingSphere()
  }, [trees, techo])
  useFrame(() => {
    const o = play.canopy ? Math.min(0.85, play.canopy.v) : 0.5
    if (roof.current && roof.current.material.opacity !== o) roof.current.material.opacity = o
  })
  const [cx, , cz] = toW((techo.x0 + techo.x1) / 2, (techo.y0 + techo.y1) / 2)
  return (
    <group>
      <instancedMesh ref={posts} args={[null, null, trees.length]} castShadow>
        <cylinderGeometry args={[0.06, 0.08, techo.z, 6]} />
        <meshStandardMaterial color="#6b5540" roughness={1} />
      </instancedMesh>
      <mesh ref={roof} rotation={[-Math.PI / 2, 0, 0]} position={[cx, techo.z + 0.05, cz]}>
        <planeGeometry args={[techo.x1 - techo.x0, techo.y1 - techo.y0]} />
        <meshStandardMaterial color="#5f9a4a" transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// H7 fase C: la ruta del robot sigue a la cuadrilla; se ve la vigente en el instante de la reproducción. Con flota (H8),
// cada robot dibuja la suya en su color.
function RutaRobot({ run, lista = run.robot.rutas, color = '#2f6bff' }) {
  const rutas = useMemo(() => lista.map((r) => ({ idx: r.idx, pts: r.puntos.map(([x, y]) => [toW(x, y)[0], 0.05, toW(x, y)[2]]) })), [lista])
  const refs = useRef([])
  useFrame(() => {
    const i = Math.floor(play.t / run.dt)
    let k = 0
    for (let j = 0; j < rutas.length; j++) if (rutas[j].idx <= i) k = j
    refs.current.forEach((m, j) => m && (m.visible = j === k))
  })
  return rutas.map((r, j) => (
    <Line
      key={j}
      ref={(m) => (refs.current[j] = m)}
      points={r.pts}
      color={color}
      lineWidth={1.5}
      dashed
      dashSize={0.5}
      gapSize={0.35}
      transparent
      opacity={0.7}
    />
  ))
}

// H7 fase C: estado de cada planta en el instante de la reproducción — una marca en el suelo, gris si ya se cosechó
// (sus dos lados), ámbar si está en curso; las pendientes no llevan marca
const EST_COLOR = [null, new THREE.Color('#f59e0b'), new THREE.Color('#64748b')]
function EstadoPlantas({ run, trees, R }) {
  const ref = useRef()
  const prev = useMemo(() => new Uint8Array(trees.length).fill(255), [trees])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  // los colores por instancia tienen que existir antes del primer dibujo (si no, el material se compila sin ellos)
  useLayoutEffect(() => {
    const mesh = ref.current
    const z = new THREE.Matrix4().makeScale(0, 0, 0)
    for (let k = 0; k < trees.length; k++) {
      mesh.setMatrixAt(k, z)
      mesh.setColorAt(k, EST_COLOR[1])
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor.needsUpdate = true
    prev.fill(0)
  }, [trees, prev])
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const t = play.t,
      on = play.plantas !== false
    let changed = false
    for (let k = 0; k < trees.length; k++) {
      const e = !on ? 0 : run.plantas.fin[k] <= t ? 2 : run.plantas.ini[k] <= t ? 1 : 0
      if (e === prev[k]) continue
      prev[k] = e
      changed = true
      const s = e ? R * 1.35 : 0
      m4.makeRotationX(-Math.PI / 2)
      m4.scale(new THREE.Vector3(s, s, 1))
      m4.setPosition(trees[k].x, 0.04, trees[k].z)
      mesh.setMatrixAt(k, m4)
      if (e) mesh.setColorAt(k, EST_COLOR[e])
    }
    if (changed) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })
  return (
    <instancedMesh ref={ref} args={[null, null, trees.length]} frustumCulled={false}>
      <circleGeometry args={[1, 24]} />
      <meshBasicMaterial transparent opacity={0.8} depthWrite={false} />
    </instancedMesh>
  )
}

/** ¿Es un huerto de paltos? (el mapa del estudio y los sistemas palta-*): solo ahí van los paltos con hojas (R3). */
const esPalto = (run) => {
  const h = run.meta?.params?.huerto
  return !h || h === 'matlab-2026' || h.startsWith('palta')
}

function Ground({ run, real, alta, geom }) {
  // árboles en coordenadas de mundo (dependen del mapa activo)
  const trees = useMemo(
    () =>
      geom.trees.map((t) => {
        const [x, , z] = toW(t.x, t.y)
        return { x, z, seed: t.seed }
      }),
    [geom],
  )
  const route = useMemo(
    () =>
      geom.route.map(([x, y]) => {
        const p = toW(x, y)
        return [p[0], 0.05, p[2]]
      }),
    [geom],
  )
  const big = Math.max(MAP.w, MAP.h) * 2 + 20
  return (
    <group>
      {real && alta ? (
        <Suspense fallback={<RealGround geom={geom} />}>
          <RealGroundAlta geom={geom} />
        </Suspense>
      ) : real ? (
        <RealGround geom={geom} />
      ) : (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[big, big]} />
            <meshStandardMaterial color="#f1f5fd" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]} receiveShadow>
            <planeGeometry args={[MAP.w, MAP.h]} />
            <meshStandardMaterial color="#e3ecd9" />
          </mesh>
        </>
      )}
      {geom.forma === 'parron' ? (
        <Parron trees={trees} techo={geom.techo} />
      ) : (
        <Orchard trees={trees} R={geom.R} H={geom.H} real={real} hojas={alta && esPalto(run)} canopy={play.canopy} />
      )}
      {run.plantas && run.plantas.ini.length === trees.length && <EstadoPlantas run={run} trees={trees} R={geom.R} />}
      {run.robot &&
        (run.flota ? (
          run.flota.robots.map((r, k) => <RutaRobot key={k} run={run} lista={r.rutas} color={colorRobot(k)} />)
        ) : run.robot.rutas ? (
          <RutaRobot run={run} />
        ) : (
          <Line points={route} color="#2f6bff" lineWidth={1.5} dashed dashSize={0.5} gapSize={0.35} transparent opacity={0.7} />
        ))}
    </group>
  )
}

function World({ run, selected, onSelect, version, look, geom, calidad }) {
  const real = look === 'real'
  const alta = real && calidad === 'alta'
  // la sombra cubre todo el huerto (el del estudio mide ~30 m; uno generado, ~100 m)
  const sh = Math.max(22, Math.max(MAP.w, MAP.h) / 2 + 6)
  // los robots de la escena: con flota (H8), uno por entrada; si no, el de siempre
  const robots = robotsDeRun(run)
  return (
    <>
      {real ? <SkyBackground /> : <color attach="background" args={['#e9eefb']} />}
      {alta && <LuzDeCielo extent={Math.max(MAP.w, MAP.h)} />}
      {real ? (
        <>
          <hemisphereLight args={['#e4f0ff', '#8a7650', alta ? 1.25 : 1.5]} />
          <directionalLight
            position={[-14, 24, 10]}
            intensity={2.0}
            color="#fff1d6"
            castShadow
            shadow-mapSize={alta ? [4096, 4096] : [2048, 2048]}
            shadow-bias={-0.0004}
            shadow-normalBias={0.04}
            shadow-camera-left={-sh}
            shadow-camera-right={sh}
            shadow-camera-top={sh}
            shadow-camera-bottom={-sh}
            shadow-camera-near={0.5}
            shadow-camera-far={Math.max(90, 2 * sh + 40)}
          />
        </>
      ) : (
        <>
          <ambientLight intensity={1.35} />
          <directionalLight
            position={[10, 22, 8]}
            intensity={1.4}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-sh}
            shadow-camera-right={sh}
            shadow-camera-top={sh}
            shadow-camera-bottom={-sh}
          />
        </>
      )}
      <Clock run={run} />
      {/* en ladera todo (suelo, árboles, personas, robot) se inclina con el terreno; en plano tilt = 0 */}
      <group rotation={[geom.tilt || 0, 0, 0]}>
        <Ground run={run} real={real} alta={alta} geom={geom} />
        {run.acopio ? <AcopioBins run={run} geom={geom} /> : <CargoPile run={run} real={real} geom={geom} />}
        {robots.map((rb, k) => (
          <Intent key={k} run={run} rb={rb} hri={run.hri?.porRobot?.[k] ?? run.hri} />
        ))}
        <Boxes run={run} real={real} />
        {run.workers.map((w) => (
          <Worker key={`${version}-${look}-${w.h}`} w={w} run={run} onSelect={onSelect} selected={selected === w.h} real={real} />
        ))}
        {robots.map((rb, k) => (
          <React.Fragment key={k}>
            <RobotCarrier run={run} rb={rb} k={k} onSelect={onSelect} selected={selected === selRobot(k)} alta={alta} />
            {rb.trailer && <Trailer run={run} T={rb.trailer} />}
          </React.Fragment>
        ))}
      </group>
    </>
  )
}

// ---- calidad alta (R1): cielo como luz ambiente y niebla de distancia; la oclusión ambiental va en WorkloadScene
const SOL = [-14, 24, 10]
const NIEBLA = '#dde8ec' // cerca del horizonte del degradado del cielo (SkyBackground)

/**
 * Luz de cielo: un cielo atmosférico procedural (Sky de drei) renderizado una vez a un mapa de entorno, que ilumina los
 * materiales con luz del cielo y del suelo en vez de un tono plano. Sin descargas. Más una niebla de distancia que sigue
 * a la cámara: empieza un poco más allá del huerto y vela solo lo lejano (con cámara ortográfica la distancia a la
 * cámara cambia con la vista, así que se recalcula en cada cuadro).
 */
function LuzDeCielo({ extent }) {
  const { scene, camera, controls } = useThree()
  const fog = useMemo(() => new THREE.Fog(NIEBLA, 1, 1000), [])
  React.useEffect(() => {
    const prev = scene.fog
    scene.fog = fog
    return () => {
      scene.fog = prev
    }
  }, [scene, fog])
  useFrame(() => {
    const target = controls?.target || ORIGEN
    const d = camera.position.distanceTo(target)
    fog.near = d + 0.35 * extent
    fog.far = d + 3 * extent
  })
  return (
    <Environment frames={1} resolution={128} environmentIntensity={0.22}>
      <Sky sunPosition={SOL} turbidity={6} rayleigh={1.2} mieCoefficient={0.005} mieDirectionalG={0.8} />
    </Environment>
  )
}
const ORIGEN = new THREE.Vector3()
// sombreado de contacto: solo se descarga con la calidad alta
const Contacto = lazy(() => import('./Contacto.jsx'))

const PRESETS = {
  iso: { pos: [10, 24, 22], zoom: 27 },
  top: { pos: [0, 60, 0.01], zoom: 22 },
  side: { pos: [0, 8, 40], zoom: 25 },
}

function CamRig({ preset, extent = 30 }) {
  const { camera, controls, size } = useThree()
  // el encuadre de los presets está hecho para el mapa del estudio (~30 m); un huerto más grande se aleja en proporción
  const raw = Math.min(size.width / 880, size.height / 600) * Math.min(1, 30 / extent)
  const fit = Math.max(0.08, Math.min(1.5, raw))
  const st = useRef({ preset: null, raw, moved: false })
  // ¿movió el usuario la cámara desde el último encuadre? (entonces un cambio de tamaño no debe perder su vista)
  React.useEffect(() => {
    if (!controls) return
    const onStart = () => (st.current.moved = true)
    controls.addEventListener('start', onStart)
    return () => controls.removeEventListener('start', onStart)
  }, [controls])
  React.useEffect(() => {
    const S = st.current
    if (S.preset === preset && S.moved) {
      // solo cambió el tamaño (ventana, panel o grabación de video): escalar el zoom y conservar la vista del usuario
      if (S.raw > 0 && raw > 0) camera.zoom *= raw / S.raw
    } else {
      const p = PRESETS[preset] || PRESETS.iso
      camera.position.set(...p.pos)
      camera.zoom = p.zoom * fit
      camera.lookAt(0, 0, 0)
      if (controls) {
        controls.target.set(0, 0, 0)
        controls.update()
      }
      if (S.preset !== preset) S.moved = false
    }
    camera.updateProjectionMatrix()
    S.preset = preset
    S.raw = raw
  }, [preset, camera, controls, fit, raw])
  return null
}

export default function WorkloadScene({ run, selected, onSelect, version, preset = 'iso', look = 'real', calidad = 'basica' }) {
  const geom = sceneGeometry(run.meta)
  setMap(geom.limites) // antes de dibujar: toW() usa el mapa activo
  const extent = Math.max(geom.limites.w, geom.limites.h)
  const alta = look === 'real' && calidad === 'alta'
  // el tipo de sombra se fija al crear el renderizador: cambiar de calidad vuelve a montar el lienzo
  return (
    <Canvas
      key={alta ? 'alta' : 'basica'}
      shadows={alta ? 'soft' : 'percentage'}
      dpr={[1, 1.5]}
      gl={{ antialias: !alta, powerPreference: 'high-performance' }}
      onPointerMissed={() => onSelect(null)}
    >
      <OrthographicCamera makeDefault position={PRESETS.iso.pos} zoom={PRESETS.iso.zoom} near={-80 - extent} far={150 + 2 * extent} />
      <OrbitControls makeDefault target={[0, 0, 0]} enablePan minZoom={(10 * 30) / Math.max(30, extent)} maxZoom={110} minPolarAngle={0} maxPolarAngle={1.45} />
      <CamRig preset={preset} extent={extent} />
      <World run={run} selected={selected} onSelect={onSelect} version={version} look={look} geom={geom} calidad={calidad} />
      {alta && (
        <Suspense fallback={null}>
          <Contacto />
        </Suspense>
      )}
      {perfEnabled() && <PerfProbe name={run.robot ? 'Humano-robot' : 'Solo humano'} />}
      <RecorderProbe name={run.robot ? 'Humano-robot' : 'Solo humano'} />
      <TagLayer />
    </Canvas>
  )
}
