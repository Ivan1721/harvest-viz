import { useState } from 'react'
import { SC } from '../charts.jsx'
import { ZONES } from '../hri.js'
import { Bar } from './Workers.jsx'
import { fmtT } from '../ui.jsx'

/* ---------------------------------------------------------------- análisis HRI (corrida con robot) */
export function Analysis({ run, i, seek, select }) {
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
