import { LineChart, SC } from '../charts.jsx'
import { Delays, RobotEnergy, RobotTime } from './Analysis.jsx'
import { fmtNum, t, useLang } from '../../i18n/index.js'

const fmt = (v, d = 0) => (v == null || !Number.isFinite(v) ? '—' : fmtNum(v, { maximumFractionDigits: d }))

/** Métricas del robot que se comparan entre dos corridas con robot (otro robot u otro comportamiento). */
const FILAS = [
  ['Cosecha total', 'u', (r) => r.series.total[r.n - 1]],
  ['Entrega a zona de carga', 'u', (r) => r.series.cargo[r.n - 1]],
  ['Energía por kg entregado', 'Wh/kg', (r) => r.hri?.fluency.energia?.whPorKg, 2],
  ['Batería restante', '%', (r) => r.hri?.fluency.energia?.bateriaPct],
  ['Robot en movimiento', '%', (r) => (r.hri ? 100 * r.hri.fluency.robotTime.move : null)],
  ['Robot esperando al trabajador', '%', (r) => (r.hri?.fluency.robotTime.wait != null ? 100 * r.hri.fluency.robotTime.wait : null)],
  ['Espera media de las cajas', 's', (r) => r.hri?.fluency.boxWait.mean],
  ['Esperando en el acopio', '%', (r) => (r.hri?.fluency.robotTime.acopio != null ? 100 * r.hri.fluency.robotTime.acopio : null), 1],
  ['Tiempo dentro de S_p(v)', 's', (r) => r.hri?.fluency.protection.s],
]

/**
 * Pestaña Robot (I4): qué hace el robot y cuánto cuesta. Con una variante con robot en la comparación, una tabla
 * pone lado a lado las dos corridas; el detalle (tiempo, energía, retardos) es el de la corrida principal.
 */
export function RobotPanel({ ho, hr, labels, t: tNow, seek }) {
  useLang()
  const a = hr?.hri
  if (!a) return <div className="note">{t('El análisis del robot requiere una corrida con robot.')}</div>
  const dos = !!ho?.hri
  const dur = hr.series.t[hr.n - 1]
  return (
    <div className="cardlist">
      {dos && (
        <table className="cmp" data-testid="robot-cmp">
          <thead>
            <tr>
              <th>{t('Métrica')}</th>
              <th>
                <i className="sw" style={{ background: SC.ho.color }} />
                {labels.ho}
              </th>
              <th>
                <i className="sw" style={{ background: SC.hr.color }} />
                {labels.hr}
              </th>
            </tr>
          </thead>
          <tbody>
            {FILAS.map(([name, unit, f, d]) => (
              <tr key={name}>
                <td style={{ whiteSpace: 'normal' }}>
                  {t(name)} <span className="muted small">{unit}</span>
                </td>
                <td className="num">{fmt(f(ho), d)}</td>
                <td className="num">{fmt(f(hr), d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {dos && <div className="note">{t('El detalle de abajo es el de {r}.', { r: labels.hr })}</div>}
      <h4 className="sec">{t('Reparto del tiempo del robot')}</h4>
      <RobotTime a={a} />
      <h4 className="sec">{t('Energía')}</h4>
      <RobotEnergy a={a} />
      <h4 className="sec">{t('Retardos')}</h4>
      <Delays a={a} />
      <LineChart
        title={t('Cultivo a bordo del robot')}
        unit={t('unidades')}
        series={[{ key: 'hr', name: t('A bordo'), color: SC.hr.color, t: hr.series.t, y: hr.robot?.onboard || new Float32Array(hr.n) }]}
        tmax={dur}
        t={tNow}
        onSeek={seek}
      />
    </div>
  )
}
