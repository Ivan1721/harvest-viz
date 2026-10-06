import React, { useEffect, useMemo, useRef, useState } from 'react'
import WorkloadScene, { play } from './WorkloadScene'
import { buildRun, parseName, onboard, FLAG, DT } from './run'
import { ACT_LABEL } from './spec'

const fmtT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const ACT_COLOR = { ground: '#16a34a', ladder: '#8b5cf6', picker: '#ff8a1f' }
const SAMPLE = 'HUMAN_ROBOT_12_ROW3_harv_mixed_RP0'

function Kpi({ icon, label, value, sub, tone }) {
  return (
    <div className="card kpi">
      <div className="kpi-icon" style={{ background: tone + '22', color: tone }}>{icon}</div>
      <div><div className="kpi-label">{label}</div><div className="kpi-value">{value}</div><div className="kpi-sub">{sub}</div></div>
    </div>
  )
}

function Chart({ run, i, sel }) {
  const W = 300, H = 120, step = 8
  const tmax = run.series.t[run.n - 1] || 1
  const wmax = Math.max(...run.workers.map((w) => w.work[run.n - 1])) || 1
  const paths = useMemo(() => run.workers.map((w) => {
    let d = ''
    for (let k = 0; k < run.n; k += step) d += `${k ? 'L' : 'M'}${(run.series.t[k] / tmax * W).toFixed(1)},${(H - w.work[k] / wmax * (H - 6) - 2).toFixed(1)}`
    return d
  }), [run])
  const px = (run.series.t[Math.min(i, run.n - 1)] / tmax) * W
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Carga de trabajo acumulada por trabajador">
      {run.workers.map((w, k) => (
        <path key={w.h} d={paths[k]} fill="none" stroke={sel === w.h ? '#2f6bff' : ACT_COLOR[w.act]} strokeWidth={sel === w.h ? 2.4 : 1.1} opacity={sel && sel !== w.h ? 0.25 : 0.8} />
      ))}
      <line x1={px} x2={px} y1="0" y2={H} stroke="#1c2540" strokeWidth="1" strokeDasharray="3 3" />
    </svg>
  )
}

function Stack({ run, w }) {
  const counts = useMemo(() => {
    const c = {}
    for (let k = 0; k < run.n; k++) c[w.flag[k]] = (c[w.flag[k]] || 0) + 1
    return c
  }, [run, w])
  return (
    <>
      <div className="stackbar">
        {[1, 2, 3, 4, 5].map((f) => counts[f] ? <i key={f} title={`${FLAG[f].label}: ${(counts[f] * DT).toFixed(0)} s`} style={{ width: `${counts[f] / run.n * 100}%`, background: FLAG[f].color }} /> : null)}
      </div>
      <div className="legend wrap">
        {[1, 2, 3, 4, 5].filter((f) => counts[f]).map((f) => <span key={f}><i style={{ background: FLAG[f].color }} />{FLAG[f].label} {(counts[f] * DT).toFixed(0)} s</span>)}
      </div>
    </>
  )
}

function Detail({ run, i, sel }) {
  if (sel === 'robot' && run.robot) {
    const picked = run.robot.picks.filter((p) => p.idx <= i)
    const p = run.robot.pos
    return (
      <div className="card detail">
        <div className="detail-head"><div><div className="muted">ROBOT TRANSPORTADOR</div><div className="detail-title">RB-01</div></div><span className="pill blue">Warthog 4WS</span></div>
        <div className="row"><span>Posición (x, y)</span><b>{p[i * 3].toFixed(1)} , {p[i * 3 + 1].toFixed(1)} m</b></div>
        <div className="row"><span>Cajas recogidas</span><b>{picked.length}</b></div>
        <div className="row"><span>Cultivo recogido (total)</span><b>{Math.round(run.series.robot[i])} u</b></div>
        <div className="row"><span>A bordo ahora</span><b>{Math.round(onboard(run, i))} u</b></div>
        <div className="row"><span>Descargas en zona de carga</span><b>{run.robot.unloads.filter((u) => u.idx <= i && u.amount > 0).length}</b></div>
        <div className="hint">Ruta reconstruida desde el log de eventos (interpolación lineal entre waypoints).</div>
      </div>
    )
  }
  const w = run.workers.find((x) => x.h === sel)
  if (!w) {
    return (
      <div className="card detail">
        <div className="detail-head"><div><div className="muted">CORRIDA</div><div className="detail-title">{run.meta.nw} trabajadores</div></div><span className={`pill ${run.meta.robot ? 'blue' : 'orange'}`}>{run.meta.robot ? 'Humano-Robot' : 'Solo humano'}</span></div>
        <div className="row"><span>Fila</span><b>{run.meta.row}</b></div>
        <div className="row"><span>Actividad</span><b>{ACT_LABEL[run.meta.act] || run.meta.act}</b></div>
        <div className="row"><span>Disposición (RP)</span><b>{run.meta.rp}</b></div>
        <div className="row"><span>Duración</span><b>{fmtT(run.series.t[run.n - 1])} · paso {DT} s</b></div>
        <div className="hint">Haz clic en un trabajador o en el robot. Las posiciones durante caminatas son reconstruidas: el CSV de MATLAB no registra trayectorias.</div>
      </div>
    )
  }
  const f = w.flag[i]
  const total = run.series.work[i] || 1
  return (
    <div className="card detail">
      <div className="detail-head"><div><div className="muted">TRABAJADOR · {ACT_LABEL[w.act]}</div><div className="detail-title">H{w.h}</div></div><span className="pill" style={{ background: FLAG[f].color + '22', color: FLAG[f].color }}>{FLAG[f].label}</span></div>
      <div className="row"><span>Carga de trabajo acumulada</span><b>{w.work[i].toFixed(1)} kcal</b></div>
      <div className="row"><span>Tasa (últimos 10 s)</span><b>{(w.rate[i] * 60).toFixed(1)} kcal/min</b></div>
      <div className="row"><span>Parte de la carga total</span><b>{(w.work[i] / total * 100).toFixed(1)}%</b></div>
      <div className="row"><span>Bolsa actual</span><b>{w.prod[i].toFixed(0)} u</b></div>
      <div className="muted small">Tiempo por actividad (toda la corrida)</div>
      <Stack run={run} w={w} />
    </div>
  )
}

export default function WorkloadApp({ modeSwitch }) {
  const [run, setRun] = useState(null)
  const [err, setErr] = useState(null)
  const [snap, setSnap] = useState({ t: 0, playing: true, speed: play.speed, colorBy: play.colorBy, sel: null })
  const [version, setVersion] = useState(0)
  const [empty, setEmpty] = useState(false)
  const fileRef = useRef()

  const base = import.meta.env.BASE_URL
  useEffect(() => {
    const get = (u) => fetch(u).then((r) => (r.ok ? r.text() : ''))
    Promise.all([get(`${base}data/${SAMPLE}_timeseries.csv`), get(`${base}data/${SAMPLE}_robot_status_log.txt`)])
      .then(([csvText, logText]) => {
        if (!csvText.startsWith('Time_s')) { setEmpty(true); return }
        play.t = 0; setRun(buildRun({ csvText, logText: logText.startsWith('idx=') ? logText : null, name: SAMPLE }))
      })
      .catch(() => setEmpty(true))
  }, [])

  useEffect(() => {
    const id = setInterval(() => setSnap({ t: play.t, playing: play.playing, speed: play.speed, colorBy: play.colorBy, sel: play.selected }), 200)
    return () => clearInterval(id)
  }, [])

  const select = (s) => { play.selected = s; setSnap((p) => ({ ...p, sel: s })) }
  const loadFiles = async (files) => {
    try {
      const fl = [...files]
      const csv = fl.find((f) => /\.csv$/i.test(f.name)), log = fl.find((f) => /\.txt$/i.test(f.name))
      if (!csv) throw new Error('Selecciona al menos el *_timeseries.csv (y opcionalmente el *_robot_status_log.txt).')
      const r = buildRun({ csvText: await csv.text(), logText: log ? await log.text() : null, name: csv.name })
      play.t = 0; play.selected = null; play.playing = true
      setRun(r); setVersion((v) => v + 1); setErr(null)
    } catch (e) { setErr(e.message) }
  }

  if (!run) {
    return (
      <div className="app">
        <header className="topbar card">
          <div className="logo"><span className="logo-mark">H</span> HarvestView</div>
          {modeSwitch}
        </header>
        <div className="card emptycard">
          {empty ? (
            <>
              <h3>Modo Workload</h3>
              <p>Reproduce en 3D una corrida del simulador MATLAB (huerto de 3 filas × 4 árboles, trabajadores y robot transportador).</p>
              <p className="muted small">Selecciona el <b>*_timeseries.csv</b> y, opcionalmente, el <b>*_robot_status_log.txt</b> de la misma corrida. Los archivos se procesan en tu navegador y no se suben a ningún servidor.</p>
              <button onClick={() => fileRef.current.click()}>📂 Cargar corrida</button>
              <input ref={fileRef} type="file" multiple accept=".csv,.txt" hidden onChange={(e) => { loadFiles(e.target.files); e.target.value = '' }} />
              {err && <div className="toast err" style={{ position: 'static', transform: 'none', marginTop: 12 }}>{err}</div>}
            </>
          ) : <p>Cargando corrida…</p>}
        </div>
      </div>
    )
  }
  const i = Math.min(run.n - 1, Math.floor(snap.t / DT))
  const nw = run.workers.length
  const avgRate = run.workers.reduce((s, w) => s + w.rate[i], 0) / nw * 60
  const tmax = run.series.t[run.n - 1]

  return (
    <div className="app">
      <WorkloadScene run={run} selected={snap.sel} onSelect={select} version={version} />

      <header className="topbar card">
        <div className="logo"><span className="logo-mark">H</span> HarvestView</div>
        {modeSwitch}
        <div className="datasrc">
          <b>{run.meta.nw} trab. · Fila {run.meta.row} · {ACT_LABEL[run.meta.act] || run.meta.act} · {run.meta.robot ? 'Humano-Robot' : 'Solo humano'}</b>
          <button onClick={() => fileRef.current.click()}>📂 Cargar corrida</button>
          <input ref={fileRef} type="file" multiple accept=".csv,.txt" hidden onChange={(e) => { loadFiles(e.target.files); e.target.value = '' }} />
        </div>
        <div className="live"><i /> t = {fmtT(snap.t)}</div>
        <div className="user"><span className="avatar">IG</span><div><b>Ivan García</b><div className="muted small">Investigador · UNAB</div></div></div>
      </header>

      <div className="left-col">
        <div className="kpis">
          <Kpi icon="📦" label="Zona de carga" value={`${Math.round(run.series.cargo[i])} u`} sub={`total ${Math.round(run.series.total[i])} u`} tone="#16a34a" />
          <Kpi icon="🤖" label="Cosechado por robot" value={`${Math.round(run.series.robot[i])} u`} sub={`a bordo ${Math.round(onboard(run, i))} u`} tone="#2f6bff" />
          <Kpi icon="🔥" label="Carga total" value={`${run.series.work[i].toFixed(0)} kcal`} sub={`${(run.series.work[i] / nw).toFixed(1)} por trabajador`} tone="#ff8a1f" />
          <Kpi icon="❤" label="Tasa media" value={`${avgRate.toFixed(1)}`} sub="kcal/min · ventana 10 s" tone="#8b5cf6" />
        </div>
        <div className="card wlist">
          <div className="sel-head"><b>Trabajadores</b>
            <span className="seg mini">
              {[['rate', 'Carga'], ['flag', 'Actividad']].map(([k, l]) => (
                <button key={k} className={snap.colorBy === k ? 'on' : ''} onClick={() => { play.colorBy = k; setSnap((p) => ({ ...p, colorBy: k })) }}>{l}</button>
              ))}
            </span>
          </div>
          <div className="wl">
            {run.workers.map((w) => {
              const f = w.flag[i]
              return (
                <div key={w.h} className={`li ${snap.sel === w.h ? 'sel' : ''}`} onClick={() => select(w.h)}>
                  <span className="dotc" style={{ background: FLAG[f].color }} title={FLAG[f].label} />
                  <b>H{w.h}</b>
                  <span className="muted small" style={{ width: 52 }}>{ACT_LABEL[w.act]}</span>
                  <span className="mbar"><i style={{ width: `${Math.min(100, w.work[i] / (w.work[run.n - 1] || 1) * 100)}%`, background: ACT_COLOR[w.act] }} /></span>
                  <span className="small" style={{ width: 52, textAlign: 'right' }}>{w.work[i].toFixed(0)} kcal</span>
                </div>
              )
            })}
            {run.robot && (
              <div className={`li ${snap.sel === 'robot' ? 'sel' : ''}`} onClick={() => select('robot')}>
                <span className="dotc blue" /><b>RB-01</b><span className="muted grow small">Transportador</span><span className="tag-s">{run.robot.picks.filter((p) => p.idx <= i).length} cajas</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="right-col">
        <Detail run={run} i={i} sel={snap.sel} />
        <div className="card chartcard">
          <div className="sel-head"><b>Carga acumulada</b><span className="muted small">kcal por trabajador</span></div>
          <Chart run={run} i={i} sel={snap.sel} />
          <div className="legend"><span><i style={{ background: ACT_COLOR.ground }} />Suelo</span><span><i style={{ background: ACT_COLOR.ladder }} />Escalera</span><span><i style={{ background: ACT_COLOR.picker }} />Gancho</span></div>
        </div>
      </div>

      <div className="timeline card">
        <button onClick={() => { if (play.t >= tmax) play.t = 0; play.playing = !play.playing; setSnap((p) => ({ ...p, playing: play.playing })) }}>{snap.playing ? '⏸' : '▶'}</button>
        <input type="range" min="0" max={tmax} step={DT} value={snap.t} onChange={(e) => { play.t = Number(e.target.value); setSnap((p) => ({ ...p, t: play.t })) }} />
        <span className="small tl-t">{fmtT(snap.t)} / {fmtT(tmax)}</span>
        <span className="seg mini">
          {[1, 5, 10, 30, 60].map((s) => <button key={s} className={snap.speed === s ? 'on' : ''} onClick={() => { play.speed = s; setSnap((p) => ({ ...p, speed: s })) }}>×{s}</button>)}
        </span>
      </div>

      {err && <div className="toast err">{err}</div>}
    </div>
  )
}
