import { useMemo } from 'react'
import { SC } from '../charts.jsx'
import { ROBOTS } from '../../hrsim/robots.js'
import { FLAG, onboard } from '../run.js'
import { ACT_LABEL } from '../spec.js'
import { ACT_COLOR, f0, f1 } from '../ui.jsx'
import { t as tr, useLang } from '../../i18n/index.js'

/* ---------------------------------------------------------------- trabajadores */
export function Bar({ v, max, color }) {
  return (
    <span className="mbar">
      <i style={{ width: `${Math.min(100, (v / (max || 1)) * 100)}%`, background: color }} />
    </span>
  )
}

export function Stack({ run, w }) {
  useLang()
  const counts = useMemo(() => {
    const c = {}
    for (let k = 0; k < run.n; k++) c[w.flag[k]] = (c[w.flag[k]] || 0) + 1
    return c
  }, [run, w])
  return (
    <>
      <div className="stackbar">
        {[1, 2, 3, 4, 5].map((f) =>
          counts[f] ? (
            <i
              key={f}
              title={`${tr(FLAG[f].label)}: ${(counts[f] * run.dt).toFixed(0)} s`}
              style={{ width: `${(counts[f] / run.n) * 100}%`, background: FLAG[f].color }}
            />
          ) : null,
        )}
      </div>
      <div className="legend wrap">
        {[1, 2, 3, 4, 5]
          .filter((f) => counts[f])
          .map((f) => (
            <span key={f}>
              <i style={{ background: FLAG[f].color }} />
              {tr(FLAG[f].label)} {(counts[f] * run.dt).toFixed(0)} s
            </span>
          ))}
      </div>
    </>
  )
}

export function WorkerList({ ho, hr, t, sel, select, labels }) {
  useLang()
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
              <span className="dotc" style={{ background: FLAG[f].color }} title={tr(FLAG[f].label)} />
              <b>H{w.h}</b>
              <span className="muted small" style={{ width: 54 }}>
                {tr(ACT_LABEL[w.act])}
              </span>
              <Bar v={w.work[iR]} max={maxW} color={ACT_COLOR[w.act]} />
              <span className="small num" style={{ width: wo ? 86 : 52, textAlign: 'right' }}>
                {wo ? (
                  <>
                    <span style={{ color: SC.ho.color }}>{f0(wo.work[iO])}</span> · <span style={{ color: SC.hr.color }}>{f0(w.work[iR])}</span>
                  </>
                ) : (
                  `${f0(w.work[iR])} kcal`
                )}
              </span>
            </div>
          )
        })}
        {hr && hr.robot && (
          <div className={`li ${sel === 'robot' ? 'sel' : ''}`} onClick={() => select('robot')}>
            <span className="dotc" style={{ background: SC.hr.color }} />
            <b>RB-01</b>
            <span className="muted grow small">{tr('Transportador')}</span>
            <span className="tag-s">{tr('{n} cajas', { n: hr.robot.picks.filter((p) => p.idx <= iR).length })}</span>
          </div>
        )}
      </div>
      {ho && hr && (
        <div className="note">
          {tr('Carga acumulada en kcal:')} <span style={{ color: SC.ho.color }}>{labels ? labels.ho : tr('solo humano')}</span> ·{' '}
          <span style={{ color: SC.hr.color }}>{labels ? labels.hr : tr('con robot')}</span>.
        </div>
      )}
    </>
  )
}

export function Detail({ ho, hr, t, sel, labels }) {
  useLang()
  const run = hr || ho
  if (!run) return null
  const i = run.rowAt(t)
  if (sel === 'robot' && hr?.robot) {
    const j = hr.rowAt(t)
    const picked = hr.robot.picks.filter((p) => p.idx <= j)
    const p = hr.robot.pos
    return (
      <div className="detail">
        <div className="detail-head">
          <div>
            <div className="muted small">{tr('ROBOT TRANSPORTADOR')}</div>
            <div className="detail-title">RB-01</div>
          </div>
          <span className="pill blue">{tr(ROBOTS[hr.meta?.params?.robotTipo]?.label ?? 'Warthog 4WS')}</span>
        </div>
        <div className="row">
          <span>{tr('Posición (x, y)')}</span>
          <b>
            {p[j * 3].toFixed(1)} , {p[j * 3 + 1].toFixed(1)} m
          </b>
        </div>
        <div className="row">
          <span>{tr('Cajas recogidas')}</span>
          <b>{picked.length}</b>
        </div>
        <div className="row">
          <span>{tr('Cultivo recogido (total)')}</span>
          <b>{f0(hr.series.robot[j])} u</b>
        </div>
        <div className="row">
          <span>{tr('A bordo ahora')}</span>
          <b>{f0(onboard(hr, j))} u</b>
        </div>
        <div className="row">
          <span>{tr('Descargas en zona de carga')}</span>
          <b>{hr.robot.unloads.filter((u) => u.idx <= j && u.amount > 0).length}</b>
        </div>
        <div className="hint">{tr('Ruta reconstruida desde el log de eventos (interpolación lineal entre waypoints).')}</div>
      </div>
    )
  }
  const w = run.workers.find((x) => x.h === sel)
  if (!w) {
    return (
      <div className="detail">
        <div className="muted small">{tr('SELECCIÓN')}</div>
        <div className="hint">{tr('Haz clic en un trabajador (en la escena o en la lista) o en el robot para ver su detalle.')}</div>
      </div>
    )
  }
  const f = w.flag[i]
  const total = run.series.work[i] || 1
  const wo = ho && hr ? ho.workers.find((x) => x.h === w.h) : null
  return (
    <div className="detail">
      <div className="detail-head">
        <div>
          <div className="muted small">
            {tr('TRABAJADOR')} · {tr(ACT_LABEL[w.act]).toUpperCase()}
          </div>
          <div className="detail-title">H{w.h}</div>
        </div>
        <span className="pill" style={{ background: FLAG[f].color + '22', color: FLAG[f].color }}>
          {tr(FLAG[f].label)}
        </span>
      </div>
      <div className="row">
        <span>{tr('Carga acumulada')}</span>
        <b>{f1(w.work[i])} kcal</b>
      </div>
      {wo && (
        <div className="row">
          <span>{labels ? tr('… {v} (mismo instante)', { v: labels.ho }) : tr('… sin robot (mismo instante)')}</span>
          <b style={{ color: SC.ho.color }}>{f1(wo.work[ho.rowAt(t)])} kcal</b>
        </div>
      )}
      <div className="row">
        <span>{tr('Tasa (últimos 10 s)')}</span>
        <b>{f1(w.rate[i] * 60)} kcal/min</b>
      </div>
      <div className="row">
        <span>{tr('Parte de la carga del equipo')}</span>
        <b>{f1((w.work[i] / total) * 100)} %</b>
      </div>
      <div className="row">
        <span>{tr('Bolsa actual')}</span>
        <b>{f0(w.prod[i])} u</b>
      </div>
      <div className="muted small" style={{ marginTop: 6 }}>
        {tr('Tiempo por actividad (toda la corrida)')}
      </div>
      <Stack run={run} w={w} />
    </div>
  )
}
