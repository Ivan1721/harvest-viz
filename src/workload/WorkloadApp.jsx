import { useEffect, useState } from 'react'
import { DEFAULTS } from '../hrsim/common.js'
import { runSimulation, cancelSimulation } from '../hrsim/simClient.js'
import { SC } from './charts.jsx'
import { heatGradient } from './hri.js'
import { cfgKey, entriesFromFiles, loadManifest, realize } from './library.js'
import { Analysis } from './panels/Analysis.jsx'
import { ConfigPanel } from './panels/ConfigPanel.jsx'
import { DataPanel } from './panels/DataPanel.jsx'
import { DEFAULTS_SIM } from './panels/SimPanel.jsx'
import { Summary } from './panels/Summary.jsx'
import { Validation } from './panels/Validation.jsx'
import { Detail, WorkerList } from './panels/Workers.jsx'
import { play, setPlay, usePlayback } from './playback.js'
import WorkloadScene from './WorkloadScene.jsx'
import { PerfOverlay, perfEnabled } from './perf.jsx'
import { VideoPanel } from './panels/VideoPanel.jsx'
import { ErrorBoundary } from '../shared/ErrorBoundary.jsx'
import { downloadRuns } from '../hrsim/export.js'
import { ACT_LABEL } from './spec.js'
import { Seg, Tabs, Toast, f0, fmtT } from './ui.jsx'

/* ---------------------------------------------------------------- aplicación */
export default function WorkloadApp({ modeSwitch }) {
  const base = import.meta.env.BASE_URL
  const [lib, setLib] = useState([])
  const [cfg, setCfg] = useState(null)
  // parámetros de URL: ?view=ho|hr|cmp, ?speed=1…120, ?perf=1 (diagnóstico), ?look=schem
  const qs = new URLSearchParams(window.location.search)
  const [view, setView] = useState(() => (['ho', 'hr', 'cmp'].includes(qs.get('view')) ? qs.get('view') : 'cmp'))
  const [runs, setRuns] = useState({ ho: null, hr: null })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [tab, setTab] = useState('resumen')
  const [preset, setPreset] = useState('iso')
  // ?look=schem abre en estilo Esquemático (más liviano: útil para figuras y equipos sin GPU)
  const [look, setLook] = useState(() => (qs.get('look') === 'schem' ? 'schem' : 'real'))
  const [canopy, setCanopyState] = useState(0.42)
  const setCanopy = (v) => {
    play.canopy.v = v
    setCanopyState(v)
  }
  const [ov, setOvState] = useState({ zones: false, intent: false })
  const [source, setSourceState] = useState('data')
  const [params, setParams] = useState(DEFAULTS_SIM)
  const [simBusy, setSimBusy] = useState(false)
  const [simInfo, setSimInfo] = useState(null)
  const [simNonce, setSimNonce] = useState(0)
  const snap = usePlayback()
  useEffect(() => {
    const sp = Number(qs.get('speed'))
    if (sp > 0) setPlay({ speed: Math.min(120, Math.max(1, sp)) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadManifest(base).then((l) => {
      setLib(l)
      if (l.length) {
        const e = l.find((x) => x.robot) || l[0]
        setCfg({ nw: e.nw, row: e.row, act: e.act, rp: e.rp })
      } else setLoading(false)
    })
  }, [])

  const eHO = cfg && lib.find((e) => !e.robot && cfgKey(e) === cfgKey(cfg))
  const eHR = cfg && lib.find((e) => e.robot && cfgKey(e) === cfgKey(cfg))
  useEffect(() => {
    if (!cfg || source !== 'data') return
    let alive = true
    setLoading(true)
    Promise.all([eHO ? realize(eHO, base) : null, eHR ? realize(eHR, base) : null])
      .then(([ho, hr]) => {
        if (!alive) return
        setRuns({ ho, hr })
        setErr(null)
        setLoading(false)
        setPlay({ t: 0, playing: true, selected: null })
        setView((v) => (ho && hr ? (v === 'ho' || v === 'hr' ? v : 'cmp') : ho ? 'ho' : 'hr'))
      })
      .catch((e) => {
        if (alive) {
          setErr(e.message)
          setLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [eHO?.id, eHR?.id, source])

  useEffect(() => {
    if (!cfg || source !== 'sim') return
    let alive = true
    setSimBusy(true)
    setErr(null)
    runSimulation({ ...params, ...cfg })
      .then(({ ho, hr, ms }) => {
        if (!alive) return
        setRuns({ ho, hr })
        setLoading(false)
        const s = hr.summary
        setSimInfo(
          `Simulado en ${Math.round(ms)} ms · carga total ${f0(hr.series.work[hr.n - 1])} kcal (HR) vs ${f0(ho.series.work[ho.n - 1])} kcal (HO) · ${s.handoffs} entregas a robot`,
        )
        setPlay({ t: 0, playing: true, selected: null })
      })
      .catch((e) => {
        if (alive && e.name !== 'AbortError') setErr(e.message)
      })
      .finally(() => {
        if (alive) setSimBusy(false)
      })
    return () => {
      // al cambiar de fuente o de configuración: detener la simulación en curso y liberar la interfaz
      alive = false
      cancelSimulation()
      setSimBusy(false)
    }
  }, [source, cfg?.nw, cfg?.row, cfg?.act, cfg?.rp, simNonce])

  const { ho, hr } = runs
  const vis = { ho: (view === 'ho' || view === 'cmp') && ho, hr: (view === 'hr' || view === 'cmp') && hr }
  const shown = [vis.ho, vis.hr].filter(Boolean)
  const tmax = Math.max(0, ...shown.map((r) => r.series.t[r.n - 1]))
  // la escena que avanza el reloj y su límite (valores derivados de lo que se muestra)
  play.driver = shown[0]?.name || null
  play.tEnd = tmax

  const select = (s) => setPlay({ selected: s })
  const seek = (t) => setPlay({ t: Math.max(0, Math.min(tmax, t)) })
  const setOv = (o) => {
    setPlay({ zones: o.zones, intent: o.intent })
    setOvState(o)
  }
  const setColorBy = (k) => setPlay({ colorBy: k })
  const setSource = (v) => {
    setSourceState(v)
    if (v !== 'sim') setTab((t) => (t === 'valid' ? 'resumen' : t))
    if (v === 'sim') {
      setRuns({ ho: null, hr: null })
      setView('cmp')
      if (!cfg) setCfg({ nw: DEFAULTS.nw, row: DEFAULTS.row, act: DEFAULTS.act, rp: DEFAULTS.rp })
    }
  }
  const pickCfg = (field, value) => {
    if (source === 'sim') {
      setCfg((c) => ({ ...(c || { nw: DEFAULTS.nw, row: DEFAULTS.row, act: DEFAULTS.act, rp: DEFAULTS.rp }), [field]: value }))
      return
    }
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
    } catch (e) {
      setErr(e.message)
    }
  }

  const ref = hr || ho
  const title = cfg ? `${cfg.nw} trabajadores · Fila ${cfg.row} · ${ACT_LABEL[cfg.act] || cfg.act} · Disposición ${cfg.rp}` : 'Sin datos'

  return (
    <div className="wb">
      <header className="wb-top">
        <div className="logo">
          <span className="logo-mark">H</span> HarvestView
        </div>
        {modeSwitch}
        <div className="wb-title">
          <b>{title}</b>
          {ref && (
            <span className="muted">
              {' '}
              · sesión de {fmtT(ref.series.t[ref.n - 1])}{' '}
              {source === 'sim' ? ' · simulación en el navegador (réplica del modelo MATLAB)' : ' · reproducción de corridas del simulador MATLAB'}
            </span>
          )}
        </div>
      </header>

      <ConfigPanel
        lib={lib}
        cfg={cfg}
        pickCfg={pickCfg}
        view={view}
        setView={setView}
        hasHO={!!ho}
        hasHR={!!hr}
        preset={preset}
        setPreset={setPreset}
        snap={snap}
        setColorBy={setColorBy}
        ov={ov}
        setOv={setOv}
        onFiles={onFiles}
        loading={loading || simBusy}
        look={look}
        setLook={setLook}
        canopy={canopy}
        setCanopy={setCanopy}
        source={source}
        setSource={setSource}
        simProps={{
          params,
          setParams,
          onRun: () => setSimNonce((n) => n + 1),
          onCancel: () => cancelSimulation(),
          busy: simBusy,
          info: simInfo,
          onExport: source === 'sim' && (hr || ho) ? () => downloadRuns([ho, hr].filter(Boolean)) : null,
        }}
        videoPanel={
          shown.length > 0 && (
            <VideoPanel
              tmax={tmax}
              title={`${title}${source === 'sim' ? ' · simulación' : ' · MATLAB'}`}
              fileStem={cfg ? `harvest-viz_${cfg.nw}_ROW${cfg.row}_${cfg.act}_RP${cfg.rp}_${view}` : 'harvest-viz'}
              disabled={loading || simBusy}
            />
          )
        }
      />

      {perfEnabled() && <PerfOverlay />}
      <main className="wb-stage" style={{ gridTemplateColumns: `repeat(${Math.max(1, shown.length)}, 1fr)` }}>
        {!shown.length && (
          <div className="wb-empty panel">
            <h3>Modo Workload</h3>
            <p>Reproduce en 3D corridas del simulador MATLAB: huerto de 3 filas × 4 árboles, trabajadores y robot transportador.</p>
            <p className="muted">
              {loading ? 'Cargando corridas…' : 'No hay corridas incluidas. Carga el *_timeseries.csv (y el log del robot) desde el panel izquierdo.'}
            </p>
          </div>
        )}
        {['ho', 'hr'].map(
          (k) =>
            vis[k] && (
              <div key={k} className="wb-view">
                <ErrorBoundary label={`la vista ${SC[k].label}`} resetKey={vis[k].entryId}>
                  <WorkloadScene run={vis[k]} selected={snap.sel} onSelect={select} version={vis[k].entryId} preset={preset} look={look} />
                </ErrorBoundary>
                <div className="wb-chip">
                  <i style={{ background: SC[k].color }} />
                  {SC[k].label}
                  <span className="muted"> · {fmtT(snap.t)}</span>
                </div>
              </div>
            ),
        )}
        {err && <Toast onClose={() => setErr(null)}>{err}</Toast>}
      </main>

      <aside className="wb-right">
        <Tabs
          label="Paneles de análisis"
          value={tab}
          onChange={setTab}
          options={[
            ['resumen', 'Resumen'],
            ['trab', 'Trabajadores'],
            ['hri', 'Interacción'],
            ...(source === 'sim' ? [['valid', 'Validación']] : []),
            ['datos', 'Datos'],
          ]}
        />
        <div className="wb-scroll">
          {tab === 'resumen' && <Summary ho={ho} hr={hr} t={snap.t} seek={seek} />}
          {tab === 'trab' && (
            <>
              <WorkerList ho={ho} hr={hr} t={snap.t} sel={snap.sel} select={select} />
              <Detail ho={ho} hr={hr} t={snap.t} sel={snap.sel} />
            </>
          )}
          {tab === 'hri' && (
            <Analysis
              run={hr}
              i={hr ? hr.rowAt(snap.t) : 0}
              seek={seek}
              select={(h) => {
                select(h)
                setTab('trab')
              }}
            />
          )}
          {tab === 'valid' && source === 'sim' && <Validation ho={ho} hr={hr} cfg={cfg} params={params} base={base} />}
          {tab === 'datos' && <DataPanel ho={ho} hr={hr} />}
        </div>
      </aside>

      <footer className="wb-foot">
        {hr?.hri && (
          <div
            className="heatwrap2"
            title="Distancia mínima robot–humano: rojo < 0,45 m · naranja < 1,2 m · amarillo < 3,6 m"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              seek(((e.clientX - r.left) / r.width) * tmax)
            }}
          >
            <div className="heat" style={{ background: heatGradient(hr.hri) }} />
            <span className="small muted">Proximidad robot–humano</span>
          </div>
        )}
        <div className="timeline2">
          <button
            className="btn icon"
            onClick={() => setPlay({ t: play.t >= tmax ? 0 : play.t, playing: !play.playing })}
            aria-label={snap.playing ? 'Pausar' : 'Reproducir'}
          >
            {snap.playing ? '❚❚' : '▶'}
          </button>
          <input
            type="range"
            aria-label="Instante de la reproducción"
            min="0"
            max={tmax || 1}
            step="1"
            value={snap.t}
            onChange={(e) => seek(Number(e.target.value))}
          />
          <span className="small tl-t num">
            {fmtT(snap.t)} / {fmtT(tmax)}
          </span>
          <Seg size="mini" value={snap.speed} onChange={(s) => setPlay({ speed: s })} options={[1, 5, 10, 30, 60, 120].map((s) => [s, `×${s}`])} />
        </div>
      </footer>
    </div>
  )
}
