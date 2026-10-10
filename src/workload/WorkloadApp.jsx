import React, { useEffect, useMemo, useRef, useState } from 'react'
import WorkloadScene, { play } from './WorkloadScene'
import { onboard, FLAG } from './run'
import { heatGradient, ZONES } from './hri'
import { ACT_LABEL } from './spec'
import { loadManifest, realize, entriesFromFiles, cfgKey, ACTS } from './library'
import { LineChart, SC } from './charts'

const fmtT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const ACT_COLOR = { ground: '#16a34a', ladder: '#8b5cf6', picker: '#ff8a1f' }
const f0 = (v) => Math.round(v).toLocaleString('es-CL')
const f1 = (v) => v.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

function Seg({ value, options, onChange, size }) {
  return (
    <div className={`seg ${size || ''}`}>
      {options.map(([k, l, dis]) => (
        <button key={String(k)} className={value === k ? 'on' : ''} disabled={dis} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  )
}

function Field({ label, children }) {
  return <div className="field"><label>{label}</label>{children}</div>
}

/* ---------------------------------------------------------------- panel izquierdo: configuración */
function ConfigPanel({ lib, cfg, pickCfg, view, setView, hasHO, hasHR, preset, setPreset, snap, setColorBy, ov, setOv, onFiles, loading }) {
  const fileRef = useRef()
  const uniq = (k) => [...new Set(lib.map((e) => e[k]))].sort((a, b) => (typeof a === 'number' ? a - b : String(a).localeCompare(String(b))))
  const acts = ACTS.filter((a) => lib.some((e) => e.act === a))
  return (
    <aside className="wb-left">
      <section className="panel">
        <h4>Configuración</h4>
        <Field label="Trabajadores"><Seg value={cfg?.nw} options={uniq('nw').map((v) => [v, String(v)])} onChange={(v) => pickCfg('nw', v)} /></Field>
        <Field label="Fila de cultivo"><Seg value={cfg?.row} options={uniq('row').map((v) => [v, String(v)])} onChange={(v) => pickCfg('row', v)} /></Field>
        <Field label="Actividad"><Seg value={cfg?.act} options={acts.map((a) => [a, ACT_LABEL[a]])} onChange={(v) => pickCfg('act', v)} /></Field>
        <Field label="Disposición (RP)"><Seg value={cfg?.rp} options={uniq('rp').map((v) => [v, String(v)])} onChange={(v) => pickCfg('rp', v)} /></Field>
        <div className="note">{lib.length} corrida{lib.length === 1 ? '' : 's'} disponible{lib.length === 1 ? '' : 's'}. Las demás combinaciones se agregan cargando archivos de MATLAB.</div>
      </section>

      <section className="panel">
        <h4>Vista</h4>
        <Seg value={view} onChange={setView} options={[['ho', 'Solo humano', !hasHO], ['hr', 'Humano-robot', !hasHR], ['cmp', 'Comparar', !(hasHO && hasHR)]]} />
        <Field label="Cámara"><Seg value={preset} onChange={setPreset} options={[['iso', 'Isométrica'], ['top', 'Cenital'], ['side', 'Lateral']]} /></Field>
        <Field label="Color de los trabajadores"><Seg value={snap.colorBy} onChange={setColorBy} options={[['rate', 'Carga metabólica'], ['flag', 'Actividad']]} /></Field>
        <div className="checks">
          <label className={ov.zones ? 'on' : ''}><input type="checkbox" disabled={!hasHR} checked={ov.zones} onChange={(e) => setOv({ ...ov, zones: e.target.checked })} />Zonas de cortesía</label>
          <label className={ov.intent ? 'on' : ''}><input type="checkbox" disabled={!hasHR} checked={ov.intent} onChange={(e) => setOv({ ...ov, intent: e.target.checked })} />Ruta anticipada</label>
        </div>
      </section>

      <section className="panel">
        <h4>Datos</h4>
        <button className="btn" onClick={() => fileRef.current.click()}>Cargar archivos de MATLAB…</button>
        <input ref={fileRef} type="file" multiple accept=".csv,.txt" hidden onChange={(e) => { onFiles(e.target.files); e.target.value = '' }} />
        <div className="note">Selecciona el <b>*_timeseries.csv</b> y, para corridas con robot, su <b>*_robot_status_log.txt</b>. Se procesan en tu navegador; no se suben a ningún servidor.</div>
        {loading && <div className="note">Cargando…</div>}
      </section>
    </aside>
  )
}

/* ---------------------------------------------------------------- tabla comparativa */
function Compare({ ho, hr, t, mode, setMode }) {
  const rows = []
  const at = (run, f) => {
    if (!run) return null
    const i = mode === 'final' ? run.n - 1 : run.rowAt(t)
    return f(run, i)
  }
  const M = [
    ['Cosecha total', 'u', (r, i) => r.series.total[i]],
    ['Entrega a zona de carga', 'u', (r, i) => r.series.cargo[i]],
    ['Entregado por el robot', 'u', (r, i) => (r.robot ? r.robot.unloads.reduce((a, u) => (u.idx <= i ? a + (+u.amount || 0) : a), 0) : null), true],
    ['Carga de trabajo total', 'kcal', (r, i) => r.series.work[i]],
    ['Carga por trabajador', 'kcal', (r, i) => r.series.work[i] / r.workers.length, false, 1],
    ['Energía por unidad entregada', 'kcal/u', (r, i) => (r.series.cargo[i] > 0 ? r.series.work[i] / r.series.cargo[i] : null), false, 2],
  ]
  return (
    <div>
      <div className="row-between"><b>Comparación</b><Seg size="mini" value={mode} onChange={setMode} options={[['now', 'Ahora'], ['final', 'Final']]} /></div>
      <table className="cmp">
        <thead><tr><th>Métrica</th><th><i className="sw" style={{ background: SC.ho.color }} />Sin robot</th><th><i className="sw" style={{ background: SC.hr.color }} />Con robot</th><th>Δ</th></tr></thead>
        <tbody>
          {M.map(([name, unit, f, onlyHR, dg]) => {
            const a = at(ho, f), b = at(hr, f)
            const fmt = (v) => (v == null ? '—' : dg ? v.toLocaleString('es-CL', { minimumFractionDigits: dg, maximumFractionDigits: dg }) : f0(v))
            const d = a != null && b != null && a > 0 ? ((b - a) / a) * 100 : null
            return (
              <tr key={name}>
                <td style={{ whiteSpace: "normal" }}>{name}<span className="muted small"> {unit}</span></td>
                <td>{onlyHR ? "—" : fmt(a)}</td><td>{fmt(b)}</td>
                <td>{d == null ? '—' : `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1).replace('.', ',')} %`}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Summary({ ho, hr, t, seek }) {
  const [mode, setMode] = useState('final')
  const dur = Math.max(ho?.series.t[ho.n - 1] || 0, hr?.series.t[hr.n - 1] || 0)
  const ser = (key, fn) => [ho && { key: 'ho', name: SC.ho.label, color: SC.ho.color, t: ho.series.t, y: fn(ho) }, hr && { key: 'hr', name: SC.hr.label, color: SC.hr.color, t: hr.series.t, y: fn(hr) }].filter(Boolean)
  return (
    <>
      {ho && hr && <Compare ho={ho} hr={hr} t={t} mode={mode} setMode={setMode} />}
      {!(ho && hr) && <div className="note">Para comparar, carga o selecciona una configuración con corrida sin robot y con robot.</div>}
      <LineChart title="Entrega a la zona de carga" unit="unidades acumuladas" series={ser('cargo', (r) => r.series.cargo)} tmax={dur} t={t} onSeek={seek} />
      <LineChart title="Carga de trabajo del equipo" unit="kcal acumuladas" series={ser('work', (r) => r.series.work)} tmax={dur} t={t} onSeek={seek} />
      {hr && <LineChart title="Cultivo a bordo del robot" unit="unidades" series={[{ key: 'hr', name: 'A bordo', color: SC.hr.color, t: hr.series.t, y: hr.robot?.onboard || new Float32Array(hr.n) }]} tmax={dur} t={t} onSeek={seek} />}
    </>
  )
}

/* ---------------------------------------------------------------- trabajadores */
function Bar({ v, max, color }) {
  return <span className="mbar"><i style={{ width: `${Math.min(100, (v / (max || 1)) * 100)}%`, background: color }} /></span>
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
        {[1, 2, 3, 4, 5].map((f) => counts[f] ? <i key={f} title={`${FLAG[f].label}: ${(counts[f] * run.dt).toFixed(0)} s`} style={{ width: `${counts[f] / run.n * 100}%`, background: FLAG[f].color }} /> : null)}
      </div>
      <div className="legend wrap">
        {[1, 2, 3, 4, 5].filter((f) => counts[f]).map((f) => <span key={f}><i style={{ background: FLAG[f].color }} />{FLAG[f].label} {(counts[f] * run.dt).toFixed(0)} s</span>)}
      </div>
    </>
  )
}

function WorkerList({ ho, hr, t, sel, select }) {
  const ref = hr || ho
  if (!ref) return null
  const iR = ref.rowAt(t)
  const iO = ho ? ho.rowAt(t) : 0
  const maxW = Math.max(...ref.workers.map((w) => w.work[ref.n - 1]), 1)
  return (
    <>
      <div className="wl">
        {ref.workers.map((w) => {
          const f = w.flag[iR]
          const wo = ho && hr ? ho.workers.find((x) => x.h === w.h) : null
          return (
            <div key={w.h} className={`li ${sel === w.h ? 'sel' : ''}`} onClick={() => select(w.h)}>
              <span className="dotc" style={{ background: FLAG[f].color }} title={FLAG[f].label} />
              <b>H{w.h}</b>
              <span className="muted small" style={{ width: 54 }}>{ACT_LABEL[w.act]}</span>
              <Bar v={w.work[iR]} max={maxW} color={ACT_COLOR[w.act]} />
              <span className="small num" style={{ width: wo ? 86 : 52, textAlign: 'right' }}>
                {wo ? <><span style={{ color: SC.ho.color }}>{f0(wo.work[iO])}</span> · <span style={{ color: SC.hr.color }}>{f0(w.work[iR])}</span></> : `${f0(w.work[iR])} kcal`}
              </span>
            </div>
          )
        })}
        {hr && hr.robot && (
          <div className={`li ${sel === 'robot' ? 'sel' : ''}`} onClick={() => select('robot')}>
            <span className="dotc" style={{ background: SC.hr.color }} /><b>RB-01</b><span className="muted grow small">Transportador</span>
            <span className="tag-s">{hr.robot.picks.filter((p) => p.idx <= iR).length} cajas</span>
          </div>
        )}
      </div>
      {ho && hr && <div className="note">Carga acumulada en kcal: <span style={{ color: SC.ho.color }}>solo humano</span> · <span style={{ color: SC.hr.color }}>con robot</span>.</div>}
    </>
  )
}

function Detail({ ho, hr, t, sel }) {
  const run = hr || ho
  if (!run) return null
  const i = run.rowAt(t)
  if (sel === 'robot' && hr?.robot) {
    const j = hr.rowAt(t)
    const picked = hr.robot.picks.filter((p) => p.idx <= j)
    const p = hr.robot.pos
    return (
      <div className="detail">
        <div className="detail-head"><div><div className="muted small">ROBOT TRANSPORTADOR</div><div className="detail-title">RB-01</div></div><span className="pill blue">Warthog 4WS</span></div>
        <div className="row"><span>Posición (x, y)</span><b>{p[j * 3].toFixed(1)} , {p[j * 3 + 1].toFixed(1)} m</b></div>
        <div className="row"><span>Cajas recogidas</span><b>{picked.length}</b></div>
        <div className="row"><span>Cultivo recogido (total)</span><b>{f0(hr.series.robot[j])} u</b></div>
        <div className="row"><span>A bordo ahora</span><b>{f0(onboard(hr, j))} u</b></div>
        <div className="row"><span>Descargas en zona de carga</span><b>{hr.robot.unloads.filter((u) => u.idx <= j && u.amount > 0).length}</b></div>
        <div className="hint">Ruta reconstruida desde el log de eventos (interpolación lineal entre waypoints).</div>
      </div>
    )
  }
  const w = run.workers.find((x) => x.h === sel)
  if (!w) {
    return (
      <div className="detail">
        <div className="muted small">SELECCIÓN</div>
        <div className="hint">Haz clic en un trabajador (en la escena o en la lista) o en el robot para ver su detalle.</div>
      </div>
    )
  }
  const f = w.flag[i]
  const total = run.series.work[i] || 1
  const wo = ho && hr ? ho.workers.find((x) => x.h === w.h) : null
  return (
    <div className="detail">
      <div className="detail-head"><div><div className="muted small">TRABAJADOR · {ACT_LABEL[w.act].toUpperCase()}</div><div className="detail-title">H{w.h}</div></div><span className="pill" style={{ background: FLAG[f].color + '22', color: FLAG[f].color }}>{FLAG[f].label}</span></div>
      <div className="row"><span>Carga acumulada</span><b>{f1(w.work[i])} kcal</b></div>
      {wo && <div className="row"><span>… sin robot (mismo instante)</span><b style={{ color: SC.ho.color }}>{f1(wo.work[ho.rowAt(t)])} kcal</b></div>}
      <div className="row"><span>Tasa (últimos 10 s)</span><b>{f1(w.rate[i] * 60)} kcal/min</b></div>
      <div className="row"><span>Parte de la carga del equipo</span><b>{f1(w.work[i] / total * 100)} %</b></div>
      <div className="row"><span>Bolsa actual</span><b>{f0(w.prod[i])} u</b></div>
      <div className="muted small" style={{ marginTop: 6 }}>Tiempo por actividad (toda la corrida)</div>
      <Stack run={run} w={w} />
    </div>
  )
}

/* ---------------------------------------------------------------- análisis HRI (corrida con robot) */
function Analysis({ run, i, seek, select }) {
  const [tab, setTab] = useState('cortesia')
  const a = run?.hri
  if (!a) return <div className="note">El análisis de interacción requiere una corrida con robot y su log de eventos.</div>
  const nw = run.workers.length
  const tabs = [['cortesia', 'Cortesía'], ['encuentros', 'Encuentros'], ['asign', 'Asignación']]
  return (
    <>
      <div className="seg">{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'cortesia' && (
        <>
          <div className="legend wrap">{ZONES.map((z) => <span key={z.key}><i style={{ background: z.color }} />{z.label} &lt; {z.r} m</span>)}</div>
          <div className="row"><span>Distancia mínima (sin traspasos)</span><b>{Math.min(...a.perWorker.map((w) => w.minD)).toFixed(2)} m</b></div>
          <div className="row"><span>Trabajadores con invasión íntima</span><b className={a.nIntimate ? 'warn' : 'good'}>{a.nIntimate} de {nw}</b></div>
          <div className="row"><span>Distancia ahora (más cercano)</span><b>{a.minD[i].toFixed(2)} m · H{run.workers[a.minW[i]].h}</b></div>
          <div className="muted small" style={{ marginTop: 6 }}>Tiempo en la zona personal (&lt; 1,2 m), sin contar traspasos</div>
          <div className="wl short">
            {[...a.perWorker].sort((x, y) => y.tPersonal - x.tPersonal).map((w) => (
              <div key={w.h} className="li" onClick={() => select(w.h)}>
                <b style={{ width: 28 }}>H{w.h}</b><Bar v={w.tPersonal} max={Math.max(...a.perWorker.map((q) => q.tPersonal), 1)} color="#f59e0b" />
                <span className="small num" style={{ width: 104, textAlign: 'right' }}>{w.tPersonal.toFixed(0)} s · mín {w.minD.toFixed(1)} m</span>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'encuentros' && (
        <>
          <div className="row"><span>Encuentros (&lt; 1,5 m)</span><b>{a.encounters.length}</b></div>
          <div className="row"><span>De ellos, traspasos de caja</span><b>{a.nHandoffs}</b></div>
          <div className="row"><span>Robot en movimiento y humano ocupado</span><b>{a.encounters.filter((e) => e.verdict === 'robot debe ceder').length}</b></div>
          <div className="muted small" style={{ marginTop: 6 }}>Clic para saltar al instante del encuentro</div>
          <div className="wl short">
            {a.encounters.map((e, k) => (
              <div key={k} className="li" onClick={() => seek(Math.max(0, e.tMin - 3))}>
                <b style={{ width: 46 }}>{fmtT(e.tMin)}</b><span style={{ width: 28 }}>H{e.h}</span>
                <span className="small num" style={{ width: 44 }}>{e.minD.toFixed(2)} m</span>
                <span className="muted small grow">{e.verdict}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'asign' && (
        <>
          <div className="row"><span>Cajas atendidas / pendientes</span><b>{a.assign.n} / {a.assign.pending}</b></div>
          <div className="row"><span>Espera media · máxima</span><b>{a.assign.mean.toFixed(0)} s · {a.assign.max.toFixed(0)} s</b></div>
          <div className="row"><span>Equidad entre trabajadores (Jain)</span><b className={a.assign.jain < 0.8 ? 'warn' : ''}>{a.assign.jain.toFixed(2)}</b></div>
          <div className="row"><span>Atención fuera de orden de detección</span><b>{a.assign.inversions} de {a.assign.pairs}</b></div>
          <div className="hint">{a.assign.inversions === 0 ? 'El robot atendió las cajas en el mismo orden en que las detectó.' : 'El robot inserta las cajas por cercanía (distance_sorted), no por orden de detección; cierto desorden es esperable.'}</div>
          <div className="muted small" style={{ marginTop: 6 }}>Espera media por trabajador (detección → recogida)</div>
          <div className="wl short">
            {a.assign.byWorker.map((w) => (
              <div key={w.h} className="li" onClick={() => select(w.h)}>
                <b style={{ width: 28 }}>H{w.h}</b><Bar v={w.mean} max={Math.max(...a.assign.byWorker.map((q) => q.mean), 1)} color={SC.hr.color} />
                <span className="small num" style={{ width: 104, textAlign: 'right' }}>{w.n ? `${w.mean.toFixed(0)} s · ${w.n} cajas` : '—'}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="note">Posiciones reconstruidas a partir de banderas de actividad y del log: las distancias son aproximadas. Registrar la pose por tick en MATLAB las hace exactas.</div>
    </>
  )
}

function DataPanel({ ho, hr }) {
  const Item = ({ run, label }) => run && (
    <div className="ds">
      <div className="row-between"><b>{label}</b><span className="muted small">{fmtT(run.series.t[run.n - 1])} · paso {run.dt} s</span></div>
      <div className="small muted">{run.name}</div>
      <div className="small">Entrega de cajas: {run.meta.robot ? (run.meta.placement === 'tree_point' ? 'punto por árbol' : 'junto a la ruta, por trabajador') : 'a pie hasta la zona de carga'}</div>
    </div>
  )
  return (
    <>
      <Item run={ho} label="Solo humano" />
      <Item run={hr} label="Humano-robot" />
      <div className="hint">Los CSV de MATLAB no registran trayectorias. Las posiciones de los trabajadores se reconstruyen desde sus banderas de actividad y la del robot desde el log de eventos. Producción y carga de trabajo son datos exactos del simulador.</div>
    </>
  )
}

/* ---------------------------------------------------------------- aplicación */
export default function WorkloadApp({ modeSwitch }) {
  const base = import.meta.env.BASE_URL
  const [lib, setLib] = useState([])
  const [cfg, setCfg] = useState(null)
  const [view, setView] = useState('cmp')
  const [runs, setRuns] = useState({ ho: null, hr: null })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [tab, setTab] = useState('resumen')
  const [preset, setPreset] = useState('iso')
  const [ov, setOvState] = useState({ zones: false, intent: false })
  const [snap, setSnap] = useState({ t: 0, playing: true, speed: play.speed, colorBy: play.colorBy, sel: null })

  useEffect(() => {
    loadManifest(base).then((l) => { setLib(l); if (l.length) { const e = l.find((x) => x.robot) || l[0]; setCfg({ nw: e.nw, row: e.row, act: e.act, rp: e.rp }) } else setLoading(false) })
  }, [])

  const eHO = cfg && lib.find((e) => !e.robot && cfgKey(e) === cfgKey(cfg))
  const eHR = cfg && lib.find((e) => e.robot && cfgKey(e) === cfgKey(cfg))
  useEffect(() => {
    if (!cfg) return
    let alive = true
    setLoading(true)
    Promise.all([eHO ? realize(eHO, base) : null, eHR ? realize(eHR, base) : null])
      .then(([ho, hr]) => {
        if (!alive) return
        setRuns({ ho, hr }); setErr(null); setLoading(false)
        play.t = 0; play.playing = true; play.selected = null
        setView((v) => (ho && hr ? (v === 'ho' || v === 'hr' ? v : 'cmp') : ho ? 'ho' : 'hr'))
      })
      .catch((e) => { if (alive) { setErr(e.message); setLoading(false) } })
    return () => { alive = false }
  }, [eHO?.id, eHR?.id])

  const { ho, hr } = runs
  const vis = { ho: (view === 'ho' || view === 'cmp') && ho, hr: (view === 'hr' || view === 'cmp') && hr }
  const shown = [vis.ho, vis.hr].filter(Boolean)
  play.driver = shown[0]?.name || null
  play.tEnd = Math.max(0, ...shown.map((r) => r.series.t[r.n - 1]))
  const tmax = play.tEnd

  useEffect(() => {
    const id = setInterval(() => setSnap({ t: play.t, playing: play.playing, speed: play.speed, colorBy: play.colorBy, sel: play.selected }), 200)
    return () => clearInterval(id)
  }, [])

  const select = (s) => { play.selected = s; setSnap((p) => ({ ...p, sel: s })) }
  const seek = (t) => { play.t = Math.max(0, Math.min(tmax, t)); setSnap((p) => ({ ...p, t: play.t })) }
  const setOv = (o) => { play.zones = o.zones; play.intent = o.intent; setOvState(o) }
  const setColorBy = (k) => { play.colorBy = k; setSnap((p) => ({ ...p, colorBy: k })) }
  const pickCfg = (field, value) => {
    const score = (e) => ['nw', 'row', 'act', 'rp'].reduce((s, k) => s + (k === field ? 0 : e[k] === cfg[k] ? 1 : 0), 0)
    const best = lib.filter((e) => e[field] === value).sort((a, b) => score(b) - score(a))[0]
    if (best) setCfg({ nw: best.nw, row: best.row, act: best.act, rp: best.rp })
  }
  const onFiles = async (files) => {
    try {
      const ent = await entriesFromFiles(files)
      setLib((l) => [...l.filter((e) => !ent.some((n) => n.id === e.id)), ...ent])
      const f = ent.find((e) => e.robot) || ent[0]
      setCfg({ nw: f.nw, row: f.row, act: f.act, rp: f.rp })
      setErr(null)
    } catch (e) { setErr(e.message) }
  }

  const ref = hr || ho
  const iRef = ref ? ref.rowAt(snap.t) : 0
  const title = cfg ? `${cfg.nw} trabajadores · Fila ${cfg.row} · ${ACT_LABEL[cfg.act] || cfg.act} · Disposición ${cfg.rp}` : 'Sin datos'

  return (
    <div className="wb">
      <header className="wb-top">
        <div className="logo"><span className="logo-mark">H</span> HarvestView</div>
        {modeSwitch}
        <div className="wb-title"><b>{title}</b>{ref && <span className="muted"> · sesión de {fmtT(ref.series.t[ref.n - 1])} · reproducción de corridas del simulador MATLAB</span>}</div>
      </header>

      <ConfigPanel lib={lib} cfg={cfg} pickCfg={pickCfg} view={view} setView={setView} hasHO={!!ho} hasHR={!!hr} preset={preset} setPreset={setPreset}
        snap={snap} setColorBy={setColorBy} ov={ov} setOv={setOv} onFiles={onFiles} loading={loading} />

      <main className="wb-stage" style={{ gridTemplateColumns: `repeat(${Math.max(1, shown.length)}, 1fr)` }}>
        {!shown.length && (
          <div className="wb-empty panel">
            <h3>Modo Workload</h3>
            <p>Reproduce en 3D corridas del simulador MATLAB: huerto de 3 filas × 4 árboles, trabajadores y robot transportador.</p>
            <p className="muted">{loading ? 'Cargando corridas…' : 'No hay corridas incluidas. Carga el *_timeseries.csv (y el log del robot) desde el panel izquierdo.'}</p>
          </div>
        )}
        {['ho', 'hr'].map((k) => vis[k] && (
          <div key={k} className="wb-view">
            <WorkloadScene run={vis[k]} selected={snap.sel} onSelect={select} version={vis[k].entryId} preset={preset} />
            <div className="wb-chip"><i style={{ background: SC[k].color }} />{SC[k].label}<span className="muted"> · {fmtT(snap.t)}</span></div>
          </div>
        ))}
        {err && <div className="toast err">{err}</div>}
      </main>

      <aside className="wb-right">
        <div className="tabs">
          {[['resumen', 'Resumen'], ['trab', 'Trabajadores'], ['hri', 'Interacción'], ['datos', 'Datos']].map(([k, l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>
        <div className="wb-scroll">
          {tab === 'resumen' && <Summary ho={ho} hr={hr} t={snap.t} seek={seek} />}
          {tab === 'trab' && <><WorkerList ho={ho} hr={hr} t={snap.t} sel={snap.sel} select={select} /><Detail ho={ho} hr={hr} t={snap.t} sel={snap.sel} /></>}
          {tab === 'hri' && <Analysis run={hr} i={hr ? hr.rowAt(snap.t) : 0} seek={seek} select={(h) => { select(h); setTab('trab') }} />}
          {tab === 'datos' && <DataPanel ho={ho} hr={hr} />}
        </div>
      </aside>

      <footer className="wb-foot">
        {hr?.hri && (
          <div className="heatwrap2" title="Distancia mínima robot–humano: rojo < 0,45 m · naranja < 1,2 m · amarillo < 3,6 m"
            onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * tmax) }}>
            <div className="heat" style={{ background: heatGradient(hr.hri) }} />
            <span className="small muted">Proximidad robot–humano</span>
          </div>
        )}
        <div className="timeline2">
          <button className="btn icon" onClick={() => { if (play.t >= tmax) play.t = 0; play.playing = !play.playing; setSnap((p) => ({ ...p, playing: play.playing })) }} aria-label={snap.playing ? 'Pausar' : 'Reproducir'}>{snap.playing ? '❚❚' : '▶'}</button>
          <input type="range" min="0" max={tmax || 1} step="1" value={snap.t} onChange={(e) => seek(Number(e.target.value))} />
          <span className="small tl-t num">{fmtT(snap.t)} / {fmtT(tmax)}</span>
          <Seg size="mini" value={snap.speed} onChange={(s) => { play.speed = s; setSnap((p) => ({ ...p, speed: s })) }} options={[1, 5, 10, 30, 60, 120].map((s) => [s, `×${s}`])} />
        </div>
      </footer>
    </div>
  )
}
