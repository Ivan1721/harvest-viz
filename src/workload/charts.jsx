import React, { useMemo, useState } from 'react'

// Colores por escenario (validados con la paleta de referencia: azul y naranja, ranuras 1 y 2)
export const SC = { ho: { label: 'Solo humano', color: '#eb6834' }, hr: { label: 'Humano-robot', color: '#2a78d6' } }

const fmtMin = (s) => `${Math.round(s / 60)}`
const nice = (v) => {
  if (v <= 0) return 1
  const e = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / e
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e
}

// Gráfico de líneas acumulativas con cursor, hover y clic para saltar en el tiempo.
// series: [{ key, name, color, t, y }]  (t,y: Float32Array)
export function LineChart({ title, unit, series, tmax, t, onSeek, height = 120, digits = 0 }) {
  const W = 320, H = height, L = 34, R = 8, T = 8, B = 18
  const [hover, setHover] = useState(null)
  const ymax = useMemo(() => nice(Math.max(1e-9, ...series.map((s) => Math.max(...s.y)))), [series])
  const px = (tt) => L + (tt / (tmax || 1)) * (W - L - R)
  const py = (v) => H - B - (v / ymax) * (H - B - T)
  const paths = useMemo(() => series.map((s) => {
    const step = Math.max(1, Math.floor(s.t.length / 220))
    let d = ''
    for (let k = 0; k < s.t.length; k += step) d += `${k ? 'L' : 'M'}${px(s.t[k]).toFixed(1)},${py(s.y[k]).toFixed(1)}`
    return d
  }), [series, ymax, tmax])
  const at = (s, tt) => s.y[Math.min(s.t.length - 1, Math.max(0, Math.round(tt / (s.t[1] - s.t[0] || 1))))]
  const cur = Number.isFinite(hover ?? t) ? (hover ?? t) : 0
  const xTicks = []
  for (let m = 0; m * 600 <= tmax; m++) xTicks.push(m * 600)
  const loc = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    return Math.max(0, Math.min(tmax, (((e.clientX - r.left) / r.width) * W - L) / (W - L - R) * tmax))
  }
  return (
    <div className="chart">
      <div className="chart-head"><b>{title}</b><span className="muted small">{unit}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={title}
        onMouseMove={(e) => setHover(loc(e))} onMouseLeave={() => setHover(null)} onClick={(e) => onSeek(loc(e))} style={{ cursor: 'pointer' }}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={py(f * ymax)} y2={py(f * ymax)} stroke="var(--grid)" strokeWidth="1" />
            <text x={L - 4} y={py(f * ymax) + 3} textAnchor="end" className="axis">{(f * ymax).toLocaleString('es-CL', { maximumFractionDigits: 0 })}</text>
          </g>
        ))}
        {xTicks.map((x) => (
          <text key={x} x={px(x)} y={H - 4} textAnchor="middle" className="axis">{fmtMin(x)}{x === 0 ? ' min' : ''}</text>
        ))}
        {series.map((s, k) => <path key={s.key} d={paths[k]} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />)}
        <line x1={px(cur)} x2={px(cur)} y1={T} y2={H - B} stroke="var(--ink)" strokeWidth="1" strokeDasharray={hover == null ? '3 3' : '0'} opacity=".55" />
        {series.map((s) => <circle key={s.key} cx={px(cur)} cy={py(at(s, cur))} r="3.5" fill={s.color} stroke="var(--surface)" strokeWidth="2" />)}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key}><i style={{ background: s.color }} />{s.name} <b>{at(s, cur).toLocaleString('es-CL', { maximumFractionDigits: digits })}</b></span>
        ))}
        <span className="muted">t = {Math.floor(cur / 60)}:{String(Math.floor(cur % 60)).padStart(2, '0')}</span>
      </div>
    </div>
  )
}
