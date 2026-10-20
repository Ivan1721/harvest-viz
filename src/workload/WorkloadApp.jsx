import { useEffect, useRef, useState } from 'react'
import { DEFAULTS } from '../hrsim/common.js'
import { runSimulation, cancelSimulation } from '../hrsim/simClient.js'
import { SISTEMAS } from '../hrsim/huertos/index.js'
import { saveSimulation } from './saveSim.js'
import { profileDefaults } from '../hrsim/common.js'
import { SC } from './charts.jsx'
import { heatGradient } from './hri.js'
import { cfgKey, entriesFromFiles, loadManifest, realize } from './library.js'
import { Analysis } from './panels/Analysis.jsx'
import { ConfigPanel } from './panels/ConfigPanel.jsx'
import { DataPanel } from './panels/DataPanel.jsx'
import { DEFAULTS_SIM } from './panels/SimPanel.jsx'
import { StaleBanner, ViewBar } from './panels/ViewBar.jsx'
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
import { t, useLang } from '../i18n/index.js'

/* ---------------------------------------------------------------- aplicación */
const base = import.meta.env.BASE_URL // constante del build (ruta de publicación)

const CFG0 = { nw: DEFAULTS.nw, row: DEFAULTS.row, act: DEFAULTS.act, rp: DEFAULTS.rp }
/** Clave de lo configurado: si cambia después de simular, los resultados están desactualizados. */
const simKeyOf = (params, cfg) => JSON.stringify({ ...params, ...cfg })

/**
 * Modo Workload. `source` lo elige la cabecera: 'sim' (modo Simulador) o 'data' (modo Réplica MATLAB: corridas de
 * MATLAB del mapa del estudio y su validación). Cada modo recuerda su propia configuración.
 */
export default function WorkloadApp({ modeSwitch, source = 'sim' }) {
  useLang()
  const [lib, setLib] = useState([])
  // configuración elegida en cada modo (la réplica elige entre corridas existentes; el simulador, cualquiera)
  const [cfgs, setCfgs] = useState({ data: null, sim: CFG0 })
  const cfg = cfgs[source]
  const setCfg = (c) => setCfgs((s) => ({ ...s, [source]: typeof c === 'function' ? c(s[source]) : c }))
  const setCfgData = (c) => setCfgs((s) => ({ ...s, data: c }))
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
  // ?perfil=hri abre el simulador con el modelo extendido; por defecto, la réplica de MATLAB
  const [params, setParams] = useState(() => (qs.get('perfil') === 'hri' ? profileDefaults('hri') : DEFAULTS_SIM))
  const [simBusy, setSimBusy] = useState(false)
  const [simInfo, setSimInfo] = useState(null)
  const [simNonce, setSimNonce] = useState(0)
  // un solo disparador: se simula al entrar al modo y al pulsar «Simular» (simNonce); el efecto lee lo configurado
  // de refs, así que editar no simula. simKey guarda qué configuración produjo los resultados que se ven.
  const paramsRef = useRef(params)
  paramsRef.current = params
  const cfgRef = useRef(cfg)
  cfgRef.current = cfg
  const [simKey, setSimKey] = useState(null)
  const [simDone, setSimDone] = useState(0) // simulaciones terminadas (las pruebas de interfaz esperan a que suba)
  const [valRuns, setValRuns] = useState(null)
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
        setCfgData({ nw: e.nw, row: e.row, act: e.act, rp: e.rp })
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
  }, [cfg, eHO, eHR, source]) // eHO/eHR son objetos estables de `lib` (cambian solo si cambia la configuración)

  useEffect(() => {
    if (source !== 'sim') return
    let alive = true
    setSimBusy(true)
    setErr(null)
    const c = cfgRef.current,
      key = simKeyOf(paramsRef.current, c)
    runSimulation({ ...paramsRef.current, ...c })
      .then(({ ho, hr, ms }) => {
        if (!alive) return
        setRuns({ ho, hr })
        setSimKey(key)
        setSimDone((n) => n + 1)
        setLoading(false)
        const s = hr.summary
        // se guardan los valores (no el texto) para que el aviso siga el idioma activo
        setSimInfo({ ms: Math.round(ms), hr: hr.series.work[hr.n - 1], ho: ho.series.work[ho.n - 1], n: s.handoffs })
        setPlay({ t: 0, playing: true, selected: null })
        // con `npm run dev`: copia en la carpeta local del proyecto (no bloquea ni falla la simulación)
        saveSimulation(ho, hr).then((r) => {
          if (r && alive) setSimInfo((i) => i && { ...i, saved: r })
        })
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
  }, [source, simNonce])

  // al cambiar de modo: se vacía la escena hasta que lleguen las corridas del modo nuevo
  const firstSource = useRef(true)
  useEffect(() => {
    if (firstSource.current) {
      firstSource.current = false
      return
    }
    setRuns({ ho: null, hr: null })
    setSimKey(null)
    setTab((t) => (t === 'valid' && source === 'sim' ? 'resumen' : t))
    if (source === 'sim') setView('cmp')
  }, [source])

  // Réplica MATLAB · Validación: el simulador corre la misma configuración con los parámetros de MATLAB
  useEffect(() => {
    if (source !== 'data' || tab !== 'valid' || !cfg) return
    let alive = true
    setValRuns(null)
    runSimulation({ ...DEFAULTS_SIM, ...cfg })
      .then((r) => alive && setValRuns(r))
      .catch((e) => alive && e.name !== 'AbortError' && setErr(e.message))
    return () => {
      alive = false
      cancelSimulation()
    }
  }, [source, tab, cfg])

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
  const pickCfg = (field, value) => {
    if (source === 'sim') {
      setCfg((c) => ({ ...(c || CFG0), [field]: value }))
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
      setCfgData({ nw: f.nw, row: f.row, act: f.act, rp: f.rp })
      setErr(null)
    } catch (e) {
      setErr(e.message)
    }
  }

  const ref = hr || ho
  const stale = source === 'sim' && !!simKey && !simBusy && simKeyOf(params, cfg) !== simKey
  const runNow = () => setSimNonce((n) => n + 1)
  // el título describe lo que se ve (la corrida simulada), no lo que se está configurando
  const tc = source === 'sim' ? ref?.meta?.params || null : cfg
  const genHuerto = tc && source === 'sim' && tc.huerto && tc.huerto !== 'matlab-2026' ? SISTEMAS[tc.huerto] : null
  const title = tc
    ? genHuerto
      ? t('{nw} trabajadores · {act} · {h}', { nw: tc.nw, act: ACT_LABEL[tc.act] ? t(ACT_LABEL[tc.act]) : tc.act, h: t(genHuerto.label) })
      : t('{nw} trabajadores · Fila {row} · {act} · Disposición {rp}', {
          nw: tc.nw,
          row: tc.row,
          act: ACT_LABEL[tc.act] ? t(ACT_LABEL[tc.act]) : tc.act,
          rp: tc.rp,
        })
    : source === 'sim'
      ? t('Simulando…')
      : t('Sin datos')

  return (
    <div className="wb" data-sim-done={simDone}>
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
              · {t('sesión de {t}', { t: fmtT(ref.series.t[ref.n - 1]) })}{' '}
              {source === 'sim'
                ? ` · ${t('simulación en el navegador ({m})', {
                    m: t(
                      runs.hr?.meta?.params?.profile === 'hri'
                        ? 'perfil HRI'
                        : (runs.hr?.meta?.params?.huerto ?? 'matlab-2026') === 'matlab-2026'
                          ? 'réplica del modelo MATLAB'
                          : 'perfil MATLAB 2026',
                    ),
                  })}`
                : ` · ${t('reproducción de corridas del simulador MATLAB')}`}
            </span>
          )}
        </div>
      </header>

      <ConfigPanel
        lib={lib}
        cfg={cfg}
        pickCfg={pickCfg}
        onFiles={onFiles}
        loading={loading}
        source={source}
        simProps={{
          params,
          setParams,
          onRun: runNow,
          onCancel: () => cancelSimulation(),
          busy: simBusy,
          stale,
          info:
            simInfo &&
            t('Simulado en {ms} ms · carga total {hr} kcal (HR) vs {ho} kcal (HO) · {n} entregas a robot', {
              ms: simInfo.ms,
              hr: f0(simInfo.hr),
              ho: f0(simInfo.ho),
              n: simInfo.n,
            }) + (simInfo.saved ? ` · ${t(simInfo.saved.existed ? 'ya guardada en {dir}' : 'guardada en {dir}', { dir: simInfo.saved.dir })}` : ''),
          onExport: source === 'sim' && (hr || ho) ? () => downloadRuns([ho, hr].filter(Boolean)) : null,
        }}
        videoPanel={
          shown.length > 0 && (
            <VideoPanel
              tmax={tmax}
              title={`${title}${source === 'sim' ? ` · ${t('simulación')}` : ' · MATLAB'}`}
              fileStem={tc ? `harvest-viz_${tc.nw}_ROW${tc.row}_${tc.act}_RP${tc.rp}_${view}` : 'harvest-viz'}
              disabled={loading || simBusy}
            />
          )
        }
      />

      {perfEnabled() && <PerfOverlay />}
      <main className="wb-stage">
        <ViewBar
          view={view}
          setView={setView}
          hasHO={!!ho}
          hasHR={!!hr}
          preset={preset}
          setPreset={setPreset}
          look={look}
          setLook={setLook}
          canopy={canopy}
          setCanopy={setCanopy}
          colorBy={snap.colorBy}
          setColorBy={setColorBy}
          ov={ov}
          setOv={setOv}
        />
        {stale && <StaleBanner onRun={runNow} busy={simBusy} />}
        <div className="wb-views" style={{ gridTemplateColumns: `repeat(${Math.max(1, shown.length)}, 1fr)` }}>
          {!shown.length && (
            <div className="wb-empty panel">
              {source === 'sim' ? (
                <>
                  <h3>{t('Simulador')}</h3>
                  <p>{t('Elige el escenario y los agentes a la izquierda y pulsa «Simular».')}</p>
                  <p className="muted">{simBusy ? t('Simulando…') : t('No hay resultados todavía.')}</p>
                </>
              ) : (
                <>
                  <h3>{t('Réplica MATLAB')}</h3>
                  <p>{t('Reproduce en 3D corridas del simulador MATLAB: huerto de 3 filas × 4 árboles, trabajadores y robot transportador.')}</p>
                  <p className="muted">
                    {loading
                      ? t('Cargando corridas…')
                      : t('No hay corridas incluidas. Carga el *_timeseries.csv (y el log del robot) desde el panel izquierdo.')}
                  </p>
                </>
              )}
            </div>
          )}
          {['ho', 'hr'].map(
            (k) =>
              vis[k] && (
                <div key={k} className="wb-view">
                  <ErrorBoundary label={t('la vista {v}', { v: t(SC[k].label) })} resetKey={vis[k].entryId}>
                    <WorkloadScene run={vis[k]} selected={snap.sel} onSelect={select} version={vis[k].entryId} preset={preset} look={look} />
                  </ErrorBoundary>
                  <div className="wb-chip">
                    <i style={{ background: SC[k].color }} />
                    {t(SC[k].label)}
                    <span className="muted"> · {fmtT(snap.t)}</span>
                  </div>
                </div>
              ),
          )}
        </div>
        {err && <Toast onClose={() => setErr(null)}>{err}</Toast>}
      </main>

      <aside className="wb-right">
        <Tabs
          label={t('Paneles de análisis')}
          value={tab}
          onChange={setTab}
          options={[
            ['resumen', t('Resumen')],
            ['trab', t('Trabajadores')],
            ['hri', t('Interacción')],
            ...(source === 'data' ? [['valid', t('Validación')]] : []),
            ['datos', t('Datos')],
          ]}
        />
        {stale && (
          <div className="stale small" role="status">
            {t('Resultados de la configuración anterior.')}
          </div>
        )}
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
          {tab === 'valid' &&
            source === 'data' &&
            (valRuns ? (
              <Validation ho={valRuns.ho} hr={valRuns.hr} cfg={cfg} params={DEFAULTS_SIM} base={base} />
            ) : (
              <div className="note">{t('Simulando la misma configuración con los parámetros de MATLAB…')}</div>
            ))}
          {tab === 'datos' && <DataPanel ho={ho} hr={hr} />}
        </div>
      </aside>

      <footer className="wb-foot">
        {hr?.hri && (
          <div
            className="heatwrap2"
            title={t('Distancia mínima robot–humano: rojo < 0,45 m · naranja < 1,2 m · amarillo < 3,6 m')}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              seek(((e.clientX - r.left) / r.width) * tmax)
            }}
          >
            <div className="heat" style={{ background: heatGradient(hr.hri) }}>
              {/* paradas de seguridad (fase 3, perfil hri) */}
              {hr.hri.fluency?.safetyStops.map((e, k) => (
                <i key={k} className="ssm-mark" style={{ left: `${(e.t0 / tmax) * 100}%` }} title={t('Parada de seguridad')} />
              ))}
            </div>
            <span className="small muted">{t('Proximidad robot–humano')}</span>
          </div>
        )}
        <div className="timeline2">
          <button
            className="btn icon"
            onClick={() => setPlay({ t: play.t >= tmax ? 0 : play.t, playing: !play.playing })}
            aria-label={snap.playing ? t('Pausar') : t('Reproducir')}
          >
            {snap.playing ? '❚❚' : '▶'}
          </button>
          <input
            type="range"
            aria-label={t('Instante de la reproducción')}
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
