import { useMemo, useState } from 'react'
import {
  ESTADOS_HO,
  ESTADOS_HR,
  ESTADOS_ROBOT,
  TRANSICIONES_HO,
  TRANSICIONES_HR,
  describirModelo,
  oddMarkdown,
  tiempoPorEstado,
  valoresReglas,
} from '../modelo.js'
import { DEFAULTS_SIM } from './SimPanel.jsx'
import { Seg } from '../ui.jsx'
import { fmtNum, t, useLang } from '../../i18n/index.js'

const W = 112,
  H = 30 // tamaño de cada estado en el diagrama

/** Punto del borde del rectángulo de un estado en dirección a (tx, ty): la flecha nace y muere en el borde. */
function borde(n, tx, ty) {
  const dx = tx - n.x,
    dy = ty - n.y
  const s = Math.min(Math.abs(W / 2 / (dx || 1e-9)), Math.abs(H / 2 / (dy || 1e-9)))
  return [n.x + dx * s, n.y + dy * s]
}

/** Máquina de estados del cosechero: el estado actual resaltado; clic en un estado muestra sus transiciones. */
function Diagrama({ estados, transiciones, actual, foco, setFoco, tiempos }) {
  const byId = new Map(estados.map((e) => [e.id, e]))
  const hmax = Math.max(...estados.map((e) => e.y)) + 30
  return (
    <svg viewBox={`0 0 380 ${hmax}`} className="sm-diagram" role="group" aria-label={t('Máquina de estados del cosechero')}>
      <defs>
        <marker id="sm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
        </marker>
      </defs>
      {transiciones.map((tr, k) => {
        const a = byId.get(tr.de),
          b = byId.get(tr.a)
        if (!a || !b) return null
        const [x1, y1] = borde(a, b.x, b.y),
          [x2, y2] = borde(b, a.x, a.y)
        const on = tr.de === foco
        return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} className={on ? 'sm-edge on' : 'sm-edge'} markerEnd="url(#sm-arrow)" />
      })}
      {estados.map((e) => {
        const cls = ['sm-node', e.id === actual && 'now', e.id === foco && 'foco', !tiempos.get(e.id) && 'nunca'].filter(Boolean).join(' ')
        return (
          <g
            key={e.id}
            className={cls}
            transform={`translate(${e.x - W / 2},${e.y - H / 2})`}
            onClick={() => setFoco(e.id)}
            role="button"
            tabIndex={0}
            aria-pressed={e.id === foco}
            aria-label={`${e.id} · ${t(e.label)}`}
            onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), setFoco(e.id))}
            data-estado={e.id}
          >
            <rect width={W} height={H} rx="6" />
            <text x={W / 2} y={H / 2 + 4} textAnchor="middle">
              {t(e.label)}
            </text>
            <text x={W - 4} y={9} textAnchor="end" className="sm-id">
              {e.id}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function Barras({ estados, tiempos, total }) {
  const filas = estados.map((e) => ({ ...e, s: tiempos.get(e.id) || 0 })).filter((e) => e.s > 0)
  filas.sort((a, b) => b.s - a.s)
  return (
    <div className="sm-bars">
      {filas.map((e) => (
        <div key={e.id} className="sm-bar">
          <span>{t(e.label)}</span>
          <span className="mbar">
            <i style={{ width: `${(100 * e.s) / total}%` }} />
          </span>
          <span className="num small">{fmtNum((100 * e.s) / total, { maximumFractionDigits: 1 })} %</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Pestaña Modelo (I3): el modelo de agentes junto a la simulación. Vista en vivo de las máquinas de estado del
 * cosechero elegido y del robot en el instante de la línea de tiempo, y la descripción ODD con los valores de la corrida.
 */
export function ModelTab({ ho, hr, t: tNow, sel, select }) {
  useLang()
  const [maquina, setMaquina] = useState(hr ? 'hr' : 'ho')
  const run = (maquina === 'hr' ? hr : ho) || hr || ho
  const esHR = run === hr && !!hr
  const estados = esHR ? ESTADOS_HR : ESTADOS_HO,
    transiciones = esHR ? TRANSICIONES_HR : TRANSICIONES_HO
  const nw = run?.workers.length || 0
  const h = typeof sel === 'number' && sel >= 1 && sel <= nw ? sel : 1
  const w = run?.workers[h - 1]
  const i = run ? run.rowAt(tNow) : 0
  const actual = w?.state ? w.state[i] : null
  const [focoSel, setFoco] = useState(null)
  const foco = focoSel ?? actual
  const tiempos = useMemo(() => tiempoPorEstado(w?.state, run?.dt ?? 0.25), [w, run])
  const robotT = useMemo(() => tiempoPorEstado(hr?.robot?.status, hr?.dt ?? 0.25), [hr])
  const p = run?.meta?.params || DEFAULTS_SIM
  const vals = valoresReglas(p)
  const secciones = useMemo(() => describirModelo(p), [p])
  const [copiado, setCopiado] = useState(false)
  const total = run ? run.n * run.dt : 1
  const rActual = hr?.robot?.status ? hr.robot.status[hr.rowAt(tNow)] : null
  const fmt = (v) => fmtNum(v, { maximumFractionDigits: 3 })

  if (!run) return <div className="note">{t('Simula o carga una corrida para ver el modelo en acción.')}</div>
  const salidas = transiciones.filter((x) => x.de === foco)
  const label = (id) => estados.find((e) => e.id === id)?.label

  return (
    <div className="cardlist modelo">
      <h4>{t('Cosechero')}</h4>
      <div className="row-between">
        {hr && ho && (
          <Seg
            size="mini"
            value={esHR ? 'hr' : 'ho'}
            onChange={(m) => {
              setMaquina(m)
              setFoco(null)
            }}
            options={[
              ['hr', t('Con robot')],
              ['ho', t('Sin robot')],
            ]}
          />
        )}
        <label className="small">
          {t('Cosechero')}{' '}
          <select value={h} onChange={(e) => select(Number(e.target.value))} aria-label={t('Cosechero')}>
            {run.workers.map((x) => (
              <option key={x.h} value={x.h}>
                H{x.h}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!w?.state && <div className="note">{t('Esta corrida no registra estados (CSV de MATLAB): el diagrama no se anima.')}</div>}
      <Diagrama estados={estados} transiciones={transiciones} actual={actual} foco={foco} setFoco={setFoco} tiempos={tiempos} />
      <div className="sm-legend small muted">
        <span className="sm-key now" /> {t('estado actual')} · <span className="sm-key foco" /> {t('estado elegido')} ·{' '}
        {t('clic en un estado para ver qué lo hace cambiar')}
      </div>
      {foco != null && (
        <div className="sm-rules" data-testid="sm-reglas">
          <b>
            {foco} · {t(label(foco) || '')}
          </b>
          {salidas.length ? (
            <ul>
              {salidas.map((x, k) => (
                <li key={k}>
                  <span className="muted">→ {t(label(x.a))}:</span> {t(x.regla, vals)}
                </li>
              ))}
            </ul>
          ) : (
            <div className="note">{t('Sin transiciones de salida en esta máquina.')}</div>
          )}
        </div>
      )}
      {w?.state && (
        <>
          <h4 style={{ marginTop: 10 }}>{t('Tiempo de H{h} en cada estado', { h })}</h4>
          <Barras estados={estados} tiempos={tiempos} total={total} />
        </>
      )}

      {hr?.robot?.status && (
        <>
          <h4 style={{ marginTop: 14 }}>{t('Robot')}</h4>
          <div className="sm-robot" data-testid="sm-robot">
            {ESTADOS_ROBOT.filter((e) => !e.flota || p.flota).map((e) => (
              <div key={e.id} className={`sm-chip${e.id === rActual ? ' now' : ''}`} title={t(e.regla, vals)}>
                <span>
                  {e.id} · {t(e.label)}
                </span>
                <span className="num small">{fmtNum((100 * (robotT.get(e.id) || 0)) / (hr.n * hr.dt), { maximumFractionDigits: 1 })} %</span>
              </div>
            ))}
          </div>
          {rActual != null && <div className="note">{t(ESTADOS_ROBOT[rActual].regla, vals)}</div>}
        </>
      )}

      <h4 style={{ marginTop: 14 }}>{t('Descripción del modelo (ODD)')}</h4>
      <div className="note" style={{ marginTop: 0 }}>
        {t('Protocolo ODD (Grimm et al. 2020) con los valores de la corrida que se ve. * = supuesto, sin fuente.')}
      </div>
      {secciones.map((s, k) => (
        <details key={s.id} className="odd" data-testid={`odd-${s.id}`}>
          <summary>
            {k + 1}. {t(s.titulo)}
          </summary>
          {(s.textos || []).map((x, j) => (
            <p key={j} className="small">
              {t(x, { dt: fmt(p.dt), ...s.vars, crr: fmt(s.vars?.crr), eta: fmt(s.vars?.eta), mu: fmt(s.vars?.mu) })}
            </p>
          ))}
          {s.tabla && (
            <table className="cmp odd-t">
              <tbody>
                {s.tabla.map((f) => (
                  <tr key={f.k}>
                    <td>{t(f.label)}</td>
                    <td className="num">
                      {typeof f.valor === 'number' ? fmt(f.valor) : t(String(f.valor))}
                      {f.unidad ? ` ${f.unidad}` : ''}
                    </td>
                    <td className="small muted">
                      {f.fuente ? t(f.fuente) : ''}
                      {f.supuesto ? ' *' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </details>
      ))}
      <button
        className="btn"
        style={{ marginTop: 8 }}
        data-testid="odd-copiar"
        onClick={() =>
          navigator.clipboard.writeText(oddMarkdown(secciones, { dt: fmt(p.dt) }, (s, v) => t(s, v), fmt)).then(
            () => {
              setCopiado(true)
              setTimeout(() => setCopiado(false), 2000)
            },
            () => setCopiado(false),
          )
        }
      >
        {copiado ? t('Descripción copiada') : t('Copiar la descripción (Markdown)')}
      </button>
    </div>
  )
}
