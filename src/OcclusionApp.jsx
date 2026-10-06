import React, { useEffect, useMemo, useRef, useState } from 'react'
import Scene from './Scene'
import { orchard, loadOrchard, exportOrchard } from './data'
import { sim, snapshot, resetSim, setStrategy, evaluate, chosenFor, PRESETS, STEPS } from './sim'

const pct = (x) => `${Math.round(x * 100)}%`
const deg = (r) => Math.round((r * 180) / Math.PI)
const clock = (t) => {
  const s = Math.floor(t)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function Kpi({ icon, label, value, sub, tone }) {
  return (
    <div className="card kpi">
      <div className="kpi-icon" style={{ background: tone + '22', color: tone }}>{icon}</div>
      <div>
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-sub">{sub}</div>
      </div>
    </div>
  )
}

function OccBars({ f, chosenIdx }) {
  const vals = f.views.map((v) => v.occ)
  return (
    <svg viewBox="0 0 250 46" width="100%" height="46" role="img" aria-label="Oclusión por punto de vista">
      {vals.map((o, i) => {
        const w = 250 / vals.length
        const h = Math.max(2, o * 38)
        return (
          <g key={i}>
            <rect x={i * w + 1} y={42 - h} width={Math.max(1, w - 2)} height={h} rx="1.5" fill={`hsl(${(1 - o) * 120} 70% 48%)`} />
            {i === chosenIdx && <rect x={i * w - 0.5} y={0} width={w + 1} height={44} rx="2" fill="none" stroke="#0ea5e9" strokeWidth="1.6" />}
          </g>
        )
      })}
    </svg>
  )
}

function Detail({ snap }) {
  const sel = snap.selected
  const R = snap.robot, H = snap.human
  let target = sel
  if (!target) target = R.targetId ? { type: 'fruit', id: R.targetId, auto: true } : { type: 'robot', id: 'RB-01' }

  if (target.type === 'fruit') {
    const f = orchard.fruits.find((x) => x.id === target.id)
    const s = snap.fruits.find((x) => x.id === target.id)
    if (!f || !s) return null
    const mine = f.assignee === 'robot'
    const ch = chosenFor(f)
    return (
      <div className="card detail">
        <div className="detail-head">
          <div><div className="muted">FRUTO · Árbol {Number(f.tree) + 1}</div><div className="detail-title">{f.id}</div></div>
          <span className={`pill ${mine ? 'blue' : 'orange'}`}>{mine ? 'Robot' : 'Humano'}</span>
        </div>
        {target.auto && <div className="hint">Objetivo actual del robot</div>}
        <div className="row"><span>Estado</span><b>{{ pending: 'Pendiente', claimed: 'En curso', done: 'Cosechado' }[s.state]}</b></div>
        <div className="row"><span>Oclusión media (todas las vistas)</span><b>{pct(f.occ)}</b></div>
        <div className="row"><span>Vista elegida ({PRESETS[snap.strategy.mode]?.label ?? 'Personalizada'})</span><b>#{ch.idx + 1} · occ {pct(ch.occ)}</b></div>
        <div className="row"><span>Mejor vista posible por oclusión</span><b className="good">{pct(f.best.occ)}</b></div>
        <div className="row"><span>Movimiento · extensión del brazo</span><b>{ch.move.toFixed(2)} m · {ch.reach.toFixed(2)} m</b></div>
        <div className="muted small">Oclusión por punto de vista ({f.views.length} candidatos)</div>
        <OccBars f={f} chosenIdx={ch.idx} />
        <div className="legend"><i style={{ background: 'hsl(120 70% 48%)' }} />visible<i style={{ background: 'hsl(0 70% 48%)' }} />ocluido<i className="best" />vista elegida</div>
      </div>
    )
  }
  if (target.type === 'human') {
    return (
      <div className="card detail">
        <div className="detail-head"><div><div className="muted">OPERARIO</div><div className="detail-title">HU-01</div></div><span className="pill orange">Humano</span></div>
        <div className="row"><span>Estado</span><b>{H.status}</b></div>
        <div className="row"><span>Frutos cosechados</span><b>{H.picked}</b></div>
        <div className="row"><span>Posición en carril</span><b>x = {H.x.toFixed(1)} m</b></div>
        <div className="row"><span>Distancia al robot</span><b>{Math.hypot(R.x - H.x, R.z - H.z).toFixed(1)} m</b></div>
        <div className="hint">Recibe los frutos con mayor oclusión (difíciles para el robot).</div>
      </div>
    )
  }
  return (
    <div className="card detail">
      <div className="detail-head"><div><div className="muted">ROBOT MANIPULADOR</div><div className="detail-title">RB-01</div></div><span className="pill blue">Robot</span></div>
      <div className="bar"><div style={{ width: pct(R.step < 0 ? 0 : (R.step + 1) / STEPS.length) }} /></div>
      <div className="row"><span>Estado</span><b className={R.paused ? 'warn' : ''}>{R.status}</b></div>
      <div className="row"><span>Frutos cosechados</span><b>{R.picked}</b></div>
      <div className="row"><span>Posición en carril</span><b>x = {R.x.toFixed(1)} m</b></div>
      <div className="row"><span>Tiempo cedido al humano</span><b>{R.pausedTime.toFixed(1)} s</b></div>
      <div className="hint">Se pausa si el humano está a menos de 2 m.</div>
    </div>
  )
}

const W_LABELS = [
  ['Oclusión', 'penaliza vistas ocluidas'],
  ['Movimiento', 'penaliza trayectoria larga'],
  ['Extensión', 'penaliza brazo estirado'],
]

function Selector({ snap, version, onChange }) {
  const { mode, w } = snap.strategy
  const rows = useMemo(() => {
    const r = Object.entries(PRESETS).map(([k, p]) => ({ k, label: p.label, ...evaluate(p.w) }))
    if (mode === 'custom') r.push({ k: 'custom', label: 'Personalizada', ...evaluate(w) })
    return r
  }, [mode, w.join(','), version])
  const bestOcc = Math.min(...rows.map((r) => r.occ))
  const bestMove = Math.min(...rows.map((r) => r.move))
  return (
    <div className="card selector">
      <div className="sel-head"><b>Selector de punto de vista</b><span className="muted small">peso → costo</span></div>
      <div className="seg">
        {Object.entries(PRESETS).map(([k, p]) => (
          <button key={k} className={mode === k ? 'on' : ''} onClick={() => { setStrategy(k); onChange() }}>{p.label}</button>
        ))}
      </div>
      {W_LABELS.map(([name, tip], i) => (
        <label key={name} className="slider" title={tip}>
          <span>{name}</span>
          <input
            type="range" min="0" max="1" step="0.05" value={w[i]}
            onChange={(e) => { const nw = [...w]; nw[i] = Number(e.target.value); setStrategy('custom', nw); onChange() }}
          />
          <b>{w[i].toFixed(2)}</b>
        </label>
      ))}
      <table className="cmp">
        <thead><tr><th>Estrategia</th><th>Occ. media</th><th>Mov. medio</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.k} className={r.k === mode ? 'cur' : ''}>
              <td>{r.label}</td>
              <td className={r.occ === bestOcc ? 'good' : ''}>{pct(r.occ)}</td>
              <td className={r.move === bestMove ? 'good' : ''}>{r.move.toFixed(2)} m</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="muted small">Sobre los {rows[0]?.n} frutos del robot. Se aplica al siguiente fruto.</div>
    </div>
  )
}

function Pipeline({ snap }) {
  const R = snap.robot
  return (
    <div className="card pipeline">
      <div className="pipeline-head"><b>Ciclo de cosecha del robot</b><span className="muted">{R.targetId ? `Fruto ${R.targetId}` : 'Sin objetivo'}</span></div>
      <div className="steps">
        {STEPS.map((s, i) => (
          <div key={s} className={`step ${i < R.step ? 'done' : i === R.step ? 'active' : ''}`}>
            <div className="dot">{i < R.step ? '✓' : i + 1}</div>
            <div className="step-label">{s}</div>
          </div>
        ))}
      </div>
      <div className={`status ${R.paused ? 'warn' : ''}`}>{R.status}</div>
    </div>
  )
}

function Lists({ snap, onSelect }) {
  const [tab, setTab] = useState('frutos')
  const rows = orchard.fruits
    .map((f) => ({ f, s: snap.fruits.find((x) => x.id === f.id) }))
    .filter((r) => r.s)
    .sort((a, b) => (a.s.state === 'done') - (b.s.state === 'done') || b.f.occ - a.f.occ)
    .slice(0, 40)
  return (
    <div className="card lists">
      <div className="tabs">
        {['frutos', 'agentes'].map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'frutos' ? `Frutos ${snap.total - snap.done}` : 'Agentes 2'}</button>
        ))}
      </div>
      <div className="list">
        {tab === 'frutos' ? rows.map(({ f, s }) => (
          <div key={f.id} className={`li ${snap.selected?.id === f.id ? 'sel' : ''}`} onClick={() => onSelect({ type: 'fruit', id: f.id })}>
            <span className={`dotc ${f.assignee === 'robot' ? 'blue' : 'orange'}`} />
            <b>{f.id}</b>
            <span className="muted grow">occ {pct(f.occ)}</span>
            <span className={`tag-s ${s.state}`}>{{ pending: 'Pendiente', claimed: 'En curso', done: 'Listo' }[s.state]}</span>
          </div>
        )) : (
          <>
            <div className="li" onClick={() => onSelect({ type: 'robot', id: 'RB-01' })}><span className="dotc blue" /><b>RB-01</b><span className="muted grow">{snap.robot.status}</span><span className="tag-s">{snap.rp}</span></div>
            <div className="li" onClick={() => onSelect({ type: 'human', id: 'HU-01' })}><span className="dotc orange" /><b>HU-01</b><span className="muted grow">{snap.human.status}</span><span className="tag-s">{snap.hp}</span></div>
          </>
        )}
      </div>
    </div>
  )
}

export default function OcclusionApp({ modeSwitch }) {
  const [snap, setSnap] = useState(snapshot())
  const [version, setVersion] = useState(0)
  const [toast, setToast] = useState(null)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    const id = setInterval(() => setSnap(snapshot()), 200)
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(id)
  }, [toast])

  const refresh = () => setSnap(snapshot())
  const onSelect = (s) => { sim.selected = s; refresh() }

  const loadText = (text, name) => {
    let json
    try { json = JSON.parse(text) } catch (e) { setToast({ ok: false, msg: `${name}: JSON inválido (${e.message})` }); return }
    const res = loadOrchard(json)
    if (res.ok) { resetSim(); setVersion((v) => v + 1); refresh() }
    setToast({ ok: res.ok, msg: res.ok ? `${name}: ${res.msg}` : `${name}: ${res.msg}` })
  }
  const loadFile = (file) => file && file.text().then((t) => loadText(t, file.name))

  useEffect(() => {
    const over = (e) => { e.preventDefault(); setDrag(true) }
    const leave = (e) => { if (!e.relatedTarget) setDrag(false) }
    const drop = (e) => { e.preventDefault(); setDrag(false); loadFile(e.dataTransfer.files?.[0]) }
    window.addEventListener('dragover', over); window.addEventListener('dragleave', leave); window.addEventListener('drop', drop)
    return () => { window.removeEventListener('dragover', over); window.removeEventListener('dragleave', leave); window.removeEventListener('drop', drop) }
  }, [])

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(exportOrchard(), null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'harvest-viz-datos.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const eff = snap.total ? snap.done / snap.total : 0

  return (
    <div className="app">
      <Scene snap={snap} onSelect={onSelect} version={version} />

      <header className="topbar card">
        <div className="logo"><span className="logo-mark">H</span> HarvestView</div>
        {modeSwitch}
        <div className="datasrc">
          <span className="muted">Datos:</span> <b>{orchard.source}</b>
          <button onClick={() => fileRef.current.click()}>📂 Cargar JSON</button>
          <button onClick={exportJson}>⬇ Exportar</button>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { loadFile(e.target.files[0]); e.target.value = '' }} />
        </div>
        <div className="site"><b>Huerto Norte · Filas A–B</b><span className="muted"> {snap.total - snap.done} frutos pendientes</span></div>
        <div className="live"><i /> Simulación {clock(snap.t)}</div>
        <div className="user"><span className="avatar">IG</span><div><b>Ivan García</b><div className="muted small">Investigador · UNAB</div></div></div>
      </header>

      <div className="left-col">
        <div className="kpis">
          <Kpi icon="🍈" label="Cosechados" value={`${snap.done} / ${snap.total}`} sub={`${pct(eff)} del huerto`} tone="#16a34a" />
          <Kpi icon="🤖" label="Robot / Humano" value={`${snap.rp} / ${snap.hp}`} sub="frutos por agente" tone="#2f6bff" />
          <Kpi icon="👁" label="Occ. al agarre" value={snap.pickOcc == null ? '—' : pct(snap.pickOcc)} sub="vista elegida (media)" tone="#ff8a1f" />
          <Kpi icon="↔" label="Trayectoria" value={`${snap.travel.toFixed(0)} m`} sub="brazo, acumulada" tone="#8b5cf6" />
        </div>
        <Selector snap={snap} version={version} onChange={refresh} />
      </div>

      <div className="right-col"><Detail snap={snap} /></div>

      <div className="controls card">
        <button onClick={() => { sim.playing = !sim.playing; refresh() }}>{snap.playing ? '⏸ Pausar' : '▶ Reanudar'}</button>
        <button onClick={() => { sim.speed = sim.speed === 1 ? 2 : sim.speed === 2 ? 4 : 1; refresh() }}>⏩ ×{snap.speed}</button>
        <button onClick={() => { resetSim(); refresh() }}>↺ Reiniciar</button>
      </div>

      <div className="bottom-left"><Pipeline snap={snap} /></div>
      <div className="bottom-right"><Lists snap={snap} onSelect={onSelect} /></div>

      {toast && <div className={`toast ${toast.ok ? 'ok' : 'err'}`}>{toast.msg}</div>}
      {drag && <div className="dropzone">Suelta el archivo JSON para cargar los datos</div>}
    </div>
  )
}
