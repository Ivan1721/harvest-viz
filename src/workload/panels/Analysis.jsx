import { useState } from 'react'
import { SC } from '../charts.jsx'
import { ZONES } from '../hri.js'
import { Bar } from './Workers.jsx'
import { Tabs, fmtT } from '../ui.jsx'
import { fmtNum, t, useLang } from '../../i18n/index.js'
import { protectionDistance } from '../../hrsim/ssm.js'

/* ---------------------------------------------------------------- interacción y seguridad (corrida con robot) */
export function Analysis({ run, i, seek, select, note }) {
  useLang()
  const [tab, setTab] = useState('cortesia')
  const a = run?.hri
  if (!a) return <div className="note">{t('El análisis de interacción requiere una corrida con robot y su log de eventos.')}</div>
  const nw = run.workers.length
  const tabs = [
    ['cortesia', t('Cortesía')],
    ['encuentros', t('Encuentros')],
    ['asign', t('Asignación')],
    ['seguridad', t('Seguridad')],
  ]
  return (
    <>
      {note && (
        <div className="note" style={{ marginTop: 0 }}>
          {note}
        </div>
      )}
      <Tabs className="seg" label={t('Análisis de interacción')} value={tab} onChange={setTab} options={tabs} />
      {tab === 'cortesia' && (
        <>
          <div className="legend wrap">
            {ZONES.map((z) => (
              <span key={z.key}>
                <i style={{ background: z.color }} />
                {t(z.label)} &lt; {z.r} m
              </span>
            ))}
          </div>
          <div className="row">
            <span>{t('Distancia mínima (sin traspasos)')}</span>
            <b>{Math.min(...a.perWorker.map((w) => w.minD)).toFixed(2)} m</b>
          </div>
          <div className="row">
            <span>{t('Trabajadores con invasión íntima')}</span>
            <b className={a.nIntimate ? 'warn' : 'good'}>{t('{a} de {b}', { a: a.nIntimate, b: nw })}</b>
          </div>
          <div className="row">
            <span>{t('Distancia ahora (más cercano)')}</span>
            <b>
              {a.minD[i].toFixed(2)} m · H{run.workers[a.minW[i]].h}
            </b>
          </div>
          <ZoneSplit a={a} />
          <div className="muted small" style={{ marginTop: 6 }}>
            {t('Tiempo en la zona personal (< 1,2 m), sin contar traspasos')}
          </div>
          <div className="wl short">
            {[...a.perWorker]
              .sort((x, y) => y.tPersonal - x.tPersonal)
              .map((w) => (
                <div key={w.h} className="li" onClick={() => select(w.h)}>
                  <b style={{ width: 28 }}>H{w.h}</b>
                  <Bar v={w.tPersonal} max={Math.max(...a.perWorker.map((q) => q.tPersonal), 1)} color="#f59e0b" />
                  <span className="small num" style={{ width: 104, textAlign: 'right' }}>
                    {w.tPersonal.toFixed(0)} s · {t('mín')} {w.minD.toFixed(1)} m
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
      {tab === 'encuentros' && (
        <>
          <div className="row">
            <span>{t('Encuentros (< 1,5 m)')}</span>
            <b>{a.encounters.length}</b>
          </div>
          <div className="row">
            <span>{t('De ellos, traspasos de caja')}</span>
            <b>{a.nHandoffs}</b>
          </div>
          <div className="row">
            <span>{t('Robot en movimiento y humano ocupado')}</span>
            <b>{a.encounters.filter((e) => e.verdict === 'robot debe ceder').length}</b>
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {t('Clic para saltar al instante del encuentro')}
          </div>
          <div className="wl short">
            {a.encounters.map((e, k) => (
              <div key={k} className="li" onClick={() => seek(Math.max(0, e.tMin - 3))}>
                <b style={{ width: 46 }}>{fmtT(e.tMin)}</b>
                <span style={{ width: 28 }}>H{e.h}</span>
                <span className="small num" style={{ width: 44 }}>
                  {e.minD.toFixed(2)} m
                </span>
                <span className="muted small grow">{t(e.verdict)}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'asign' && (
        <>
          <div className="row">
            <span>{t('Cajas atendidas / pendientes')}</span>
            <b>
              {a.assign.n} / {a.assign.pending}
            </b>
          </div>
          <div className="row">
            <span>{t('Espera media · p90 · máxima')}</span>
            <b>
              {a.assign.mean.toFixed(0)} s · {a.assign.p90.toFixed(0)} s · {a.assign.max.toFixed(0)} s
            </b>
          </div>
          <div className="row">
            <span>{t('Equidad entre trabajadores (Jain)')}</span>
            <b className={a.assign.jain < 0.8 ? 'warn' : ''}>{a.assign.jain.toFixed(2)}</b>
          </div>
          <div className="row">
            <span>{t('Atención fuera de orden de detección')}</span>
            <b>{t('{a} de {b}', { a: a.assign.inversions, b: a.assign.pairs })}</b>
          </div>
          <div className="hint">
            {a.assign.inversions === 0
              ? t('El robot atendió las cajas en el mismo orden en que las detectó.')
              : t('El robot inserta las cajas por cercanía (distance_sorted), no por orden de detección; cierto desorden es esperable.')}
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>
            {t('Espera media por trabajador (detección → recogida)')}
          </div>
          <div className="wl short">
            {a.assign.byWorker.map((w) => (
              <div key={w.h} className="li" onClick={() => select(w.h)}>
                <b style={{ width: 28 }}>H{w.h}</b>
                <Bar v={w.mean} max={Math.max(...a.assign.byWorker.map((q) => q.mean), 1)} color={SC.hr.color} />
                <span className="small num" style={{ width: 104, textAlign: 'right' }}>
                  {w.n ? `${w.mean.toFixed(0)} s · ${t('{n} cajas', { n: w.n })}` : '—'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'seguridad' && <Safety a={a} run={run} seek={seek} />}
      <div className="note">
        {t(
          'Posiciones reconstruidas a partir de banderas de actividad y del log: las distancias son aproximadas. Registrar la pose por tick en MATLAB las hace exactas.',
        )}
      </div>
    </>
  )
}

const pc = (x) => (x == null ? '—' : `${(x * 100).toFixed(0)} %`)
const ROBOT_TIME = [
  ['move', 'En movimiento', '#2563eb'],
  ['wait', 'Esperando al trabajador', '#f59e0b'],
  ['stop', 'Descargando o cargando', '#94a3b8'],
  ['safety', 'Parada de seguridad', '#dc2626'],
  ['slow', 'Velocidad reducida por seguridad', '#8b5cf6'],
  ['traction', 'Sin tracción (pendiente o carga)', '#7c2d12'],
  ['acopio', 'Esperando en el acopio', '#0d9488'],
]

// exposición por zona de Hall, total del equipo, separada en robot en movimiento / detenido
function ZoneSplit({ a }) {
  const sum = (key, z) => a.perWorker.reduce((s, w) => s + w[key][z], 0)
  return (
    <table className="mini" style={{ marginTop: 6 }}>
      <thead>
        <tr>
          <th>{t('Zona')}</th>
          <th>{t('robot en movimiento')}</th>
          <th>{t('robot detenido')}</th>
        </tr>
      </thead>
      <tbody>
        {ZONES.map((z, k) => (
          <tr key={z.key}>
            <td>
              <i className="sw" style={{ background: z.color }} /> {t(z.label)}
            </td>
            <td className="num">{sum('zoneMoving', k).toFixed(0)} s</td>
            <td className="num">{sum('zoneStopped', k).toFixed(0)} s</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Reparto del tiempo del robot (exacto en el simulador; en movimiento / detenido en CSV de MATLAB). */
export function RobotTime({ a }) {
  useLang()
  const rt = a.fluency.robotTime
  return (
    <>
      <div className="stackbar" role="img" aria-label={t('Reparto del tiempo del robot')}>
        {rt.exact ? (
          ROBOT_TIME.filter(([k]) => rt[k] > 0).map(([k, , c]) => <i key={k} style={{ width: `${rt[k] * 100}%`, background: c }} />)
        ) : (
          <>
            <i style={{ width: `${rt.move * 100}%`, background: ROBOT_TIME[0][2] }} />
            <i style={{ width: `${rt.stopped * 100}%`, background: ROBOT_TIME[2][2] }} />
          </>
        )}
      </div>
      {rt.exact ? (
        ROBOT_TIME.filter(([k]) => k === 'move' || k === 'wait' || k === 'stop' || rt[k] > 0).map(([k, label, c]) => (
          <div className="row" key={k}>
            <span>
              <i className="sw" style={{ background: c }} /> {t(label)}
            </span>
            <b>{pc(rt[k])}</b>
          </div>
        ))
      ) : (
        <>
          <div className="row">
            <span>{t('En movimiento')}</span>
            <b>{pc(rt.move)}</b>
          </div>
          <div className="row">
            <span>{t('Detenido')}</span>
            <b>{pc(rt.stopped)}</b>
          </div>
        </>
      )}
    </>
  )
}

/** Energía, batería, descargas y tracción del robot (huertos generados). */
export function RobotEnergy({ a }) {
  useLang()
  const e = a.fluency.energia
  if (!e) return <div className="note">{t('El robot del mapa del estudio no tiene modelo de energía.')}</div>
  return (
    <>
      <div className="row">
        <span>{t('Energía usada · por kg entregado')}</span>
        <b>
          {fmtNum(e.wh, { maximumFractionDigits: 0 })} Wh · {e.whPorKg == null ? '—' : `${fmtNum(e.whPorKg, { maximumFractionDigits: 2 })} Wh/kg`}
        </b>
      </div>
      <div className="row">
        <span>{t('Batería restante · descargas en el acopio')}</span>
        <b>
          {e.bateriaPct == null ? '—' : `${fmtNum(e.bateriaPct, { maximumFractionDigits: 0 })} %`} · {e.descargas}
        </b>
      </div>
      {e.traccion_s > 0 && (
        <div className="row">
          <span>{t('Sin tracción suficiente (no sube)')}</span>
          <b className="warn">{fmtNum(e.traccion_s, { maximumFractionDigits: 0 })} s</b>
        </div>
      )}
    </>
  )
}

/** Retardos: cuánto esperan las cajas al robot y el robot a los trabajadores. */
export function Delays({ a }) {
  useLang()
  const f = a.fluency
  return (
    <>
      <div className="row">
        <span>{t('La caja espera al robot (media · p90)')}</span>
        <b>
          {f.boxWait.mean.toFixed(0)} s · {f.boxWait.p90.toFixed(0)} s
        </b>
      </div>
      <div className="row">
        <span>{t('El robot espera al trabajador (total · media)')}</span>
        <b>{f.robotWait ? `${f.robotWait.total.toFixed(0)} s · ${f.robotWait.mean.toFixed(0)} s` : '—'}</b>
      </div>
      <div className="row">
        <span>{t('Equidad de la espera de cajas (Jain)')}</span>
        <b className={a.assign.jain < 0.8 ? 'warn' : ''}>{a.assign.jain.toFixed(2)}</b>
      </div>
    </>
  )
}

/** Tiempo de cada trabajador atendiendo al robot y su equidad (Jain). */
export function Attention({ a, select }) {
  useLang()
  const f = a.fluency
  return (
    <>
      <div className="row">
        <span>{t('Equidad del tiempo atendiendo al robot (Jain)')}</span>
        <b className={f.jainAttend != null && f.jainAttend < 0.8 ? 'warn' : ''}>{f.jainAttend == null ? '—' : f.jainAttend.toFixed(2)}</b>
      </div>
      {f.attend && (
        <>
          <div className="muted small" style={{ marginTop: 6 }}>
            {t('Tiempo atendiendo al robot (camina a la caja, la carga, baja la escalera)')}
          </div>
          <div className="wl short">
            {[...f.attend]
              .sort((x, y) => y.s - x.s)
              .map((w) => (
                <div key={w.h} className="li" onClick={() => select(w.h)}>
                  <b style={{ width: 28 }}>H{w.h}</b>
                  <Bar v={w.s} max={Math.max(...f.attend.map((q) => q.s), 1)} color={SC.hr.color} />
                  <span className="small num" style={{ width: 104, textAlign: 'right' }}>
                    {w.s.toFixed(0)} s · {(w.frac * 100).toFixed(1)} %
                  </span>
                </div>
              ))}
          </div>
        </>
      )}
    </>
  )
}

/** Seguridad medida (ISO/TS 15066): paradas, tiempo dentro de S_p(v), distancias y eventos. */
export function Safety({ a, run, seek }) {
  useLang()
  const f = a.fluency
  const rule = !!run.meta?.params?.ssm?.enabled
  return (
    <>
      <div className="muted small" style={{ marginTop: 8 }}>
        {rule ? t('Seguridad (ISO/TS 15066, regla activa)') : t('Seguridad (ISO/TS 15066, solo se mide)')}
      </div>
      {rule && (
        <div className="row">
          <span>{t('Paradas de seguridad')}</span>
          <b>
            {f.safetyStops.length} · {f.safetyStops.reduce((s, e) => s + e.dur, 0).toFixed(0)} s
          </b>
        </div>
      )}
      <div className="row">
        <span>{t('Trabajador dentro de S_p(v) con el robot en movimiento')}</span>
        <b className={f.protection.n ? 'warn' : 'good'}>
          {f.protection.s.toFixed(0)} s · {t('{n} eventos', { n: f.protection.n })}
        </b>
      </div>
      <div className="row">
        <span>{t('Distancia mínima · p5 en movimiento')}</span>
        <b>
          {f.minDist.toFixed(2)} m · {f.p5Moving == null ? '—' : `${f.p5Moving.toFixed(2)} m`}
        </b>
      </div>
      {f.protection.n > 0 && (
        <div className="wl short">
          {[...f.protection.events]
            .sort((x, y) => x.minD - x.sp - (y.minD - y.sp))
            .slice(0, 50)
            .map((e, k) => (
              <div key={k} className="li" onClick={() => seek(Math.max(0, e.t0 - 3))}>
                <b style={{ width: 46 }}>{fmtT(e.t0)}</b>
                <span style={{ width: 28 }}>H{e.h}</span>
                <span className="small num grow">
                  {e.minD.toFixed(2)} m &lt; {e.sp.toFixed(2)} m · {e.v.toFixed(1)} m/s
                </span>
              </div>
            ))}
        </div>
      )}
      <div className="hint">
        {t('S_p(v) = v_h (T_r + v/a) + v T_r + v²/(2a) + C + Z_d + Z_r, con v_h = {vh} m/s, T_r = {Tr} s, a = {a} m/s²; detenido: {s0} m.', {
          vh: fmtNum(f.ssm.vh, { maximumFractionDigits: 1 }),
          Tr: fmtNum(f.ssm.Tr, { maximumFractionDigits: 2 }),
          a: fmtNum(f.ssm.a, { maximumFractionDigits: 1 }),
          s0: fmtNum(protectionDistance(0, f.ssm), { maximumFractionDigits: 2 }),
        })}
      </div>
      {!f.exact && (
        <div className="hint">{t('Corrida de MATLAB: el estado del robot y de los trabajadores no se registra; solo se separa en movimiento / detenido.')}</div>
      )}
    </>
  )
}
