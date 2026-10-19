import { useState } from 'react'
import { LineChart, SC } from '../charts.jsx'
import { Seg, f0 } from '../ui.jsx'
import { t as tr, fmtNum, useLang } from '../../i18n/index.js'

/* ---------------------------------------------------------------- tabla comparativa */
export function Compare({ ho, hr, t, mode, setMode }) {
  useLang()
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
      <div className="row-between">
        <b>{tr('Comparación')}</b>
        <Seg
          size="mini"
          value={mode}
          onChange={setMode}
          options={[
            ['now', tr('Ahora')],
            ['final', tr('Final')],
          ]}
        />
      </div>
      <table className="cmp">
        <thead>
          <tr>
            <th>{tr('Métrica')}</th>
            <th>
              <i className="sw" style={{ background: SC.ho.color }} />
              {tr('Sin robot')}
            </th>
            <th>
              <i className="sw" style={{ background: SC.hr.color }} />
              {tr('Con robot')}
            </th>
            <th>Δ</th>
          </tr>
        </thead>
        <tbody>
          {M.map(([name, unit, f, onlyHR, dg]) => {
            const a = at(ho, f),
              b = at(hr, f)
            const fmt = (v) => (v == null ? '—' : dg ? fmtNum(v, { minimumFractionDigits: dg, maximumFractionDigits: dg }) : f0(v))
            const d = a != null && b != null && a > 0 ? ((b - a) / a) * 100 : null
            return (
              <tr key={name}>
                <td style={{ whiteSpace: 'normal' }}>
                  {tr(name)}
                  <span className="muted small"> {unit}</span>
                </td>
                <td>{onlyHR ? '—' : fmt(a)}</td>
                <td>{fmt(b)}</td>
                <td>
                  {d == null
                    ? '—'
                    : `${d >= 0 ? '+' : '−'}${fmtNum(Math.abs(d), { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })} %`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function Summary({ ho, hr, t, seek }) {
  useLang()
  const [mode, setMode] = useState('final')
  const dur = Math.max(ho?.series.t[ho.n - 1] || 0, hr?.series.t[hr.n - 1] || 0)
  const ser = (key, fn) =>
    [
      ho && { key: 'ho', name: tr(SC.ho.label), color: SC.ho.color, t: ho.series.t, y: fn(ho) },
      hr && { key: 'hr', name: tr(SC.hr.label), color: SC.hr.color, t: hr.series.t, y: fn(hr) },
    ].filter(Boolean)
  return (
    <>
      {ho && hr && <Compare ho={ho} hr={hr} t={t} mode={mode} setMode={setMode} />}
      {!(ho && hr) && <div className="note">{tr('Para comparar, carga o selecciona una configuración con corrida sin robot y con robot.')}</div>}
      <LineChart
        title={tr('Entrega a la zona de carga')}
        unit={tr('unidades acumuladas')}
        series={ser('cargo', (r) => r.series.cargo)}
        tmax={dur}
        t={t}
        onSeek={seek}
      />
      <LineChart
        title={tr('Carga de trabajo del equipo')}
        unit={tr('kcal acumuladas')}
        series={ser('work', (r) => r.series.work)}
        tmax={dur}
        t={t}
        onSeek={seek}
      />
      {hr && (
        <LineChart
          title={tr('Cultivo a bordo del robot')}
          unit={tr('unidades')}
          series={[{ key: 'hr', name: tr('A bordo'), color: SC.hr.color, t: hr.series.t, y: hr.robot?.onboard || new Float32Array(hr.n) }]}
          tmax={dur}
          t={t}
          onSeek={seek}
        />
      )}
    </>
  )
}
