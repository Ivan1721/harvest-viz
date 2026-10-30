// Diagnóstico de rendimiento del visor: activo con ?perf=1.
// Cada escena 3D publica sus métricas en window.__hvPerf[nombre] (las lee también scripts/bench-visual.mjs).
import { useEffect, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { t, fmtNum, useLang } from '../i18n/index.js'

export const perfEnabled = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('perf')

/**
 * Dentro de <Canvas>: mide FPS, ms por cuadro (media y p95), draw calls y triángulos. Los contadores de three se
 * reinician en cada render; con el posprocesado de la calidad Alta hay varios renders por cuadro y quedaría solo el
 * último (1 llamada, 1 triángulo). Por eso se reinician a mano al empezar cada cuadro y se lee el cuadro anterior entero.
 */
export function PerfProbe({ name }) {
  const gl = useThree((s) => s.gl)
  const buf = useRef({ times: [], last: 0 })
  useEffect(() => {
    const antes = gl.info.autoReset
    gl.info.autoReset = false
    return () => {
      gl.info.autoReset = antes
    }
  }, [gl])
  useFrame(() => {
    const info = gl.info
    const calls = info.render.calls,
      triangles = info.render.triangles
    info.reset()
    const now = performance.now(),
      b = buf.current
    if (b.last) b.times.push(now - b.last)
    b.last = now
    if (b.times.length > 240) b.times.shift()
    // cada 30 cuadros; antes de juntar 30, en cada uno (con WebGL por software, los primeros tardan segundos)
    if (b.times.length === 0 || (b.times.length >= 30 && b.times.length % 30 !== 0)) return
    const t = [...b.times].sort((x, y) => x - y)
    const mean = t.reduce((s, v) => s + v, 0) / t.length
    window.__hvPerf = window.__hvPerf || {}
    window.__hvPerf[name] = {
      fps: 1000 / mean,
      frameMs: mean,
      p95Ms: t[Math.floor(t.length * 0.95)],
      calls,
      triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      dpr: gl.getPixelRatio(),
    }
  }, -1000) // antes que el resto: el cuadro anterior ya terminó de dibujarse
  return null
}

/** Fuera del <Canvas>: tabla flotante con las métricas de cada escena. */
export function PerfOverlay() {
  useLang()
  const [rows, setRows] = useState({})
  useEffect(() => {
    const id = setInterval(() => setRows({ ...(window.__hvPerf || {}) }), 500)
    return () => clearInterval(id)
  }, [])
  const f0 = (v) => (v == null ? '—' : fmtNum(Math.round(v)))
  return (
    <div className="perf-overlay" aria-live="off">
      {Object.entries(rows).map(([k, r]) => (
        <div key={k}>
          <b>{t(k)}</b> {f0(r.fps)} FPS · {(r.frameMs ?? 0).toFixed(1)} ms (p95 {(r.p95Ms ?? 0).toFixed(1)}) · {f0(r.calls)} draw calls · {f0(r.triangles)}{' '}
          {t('triángulos')} · dpr {r.dpr}
        </div>
      ))}
    </div>
  )
}
