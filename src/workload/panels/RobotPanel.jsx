import { useState } from 'react'
import { LineChart, SC } from '../charts.jsx'
import { Seg } from '../ui.jsx'
import { Delays, RobotEnergy, RobotTime } from './Analysis.jsx'
import { ESTRATEGIAS, colorRobot, etiquetaRobot, filasFlota } from '../flota.js'
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
  ['Calles recorridas', '', (r) => r.robot?.calles],
  ['Esperando en el acopio', '%', (r) => (r.hri?.fluency.robotTime.acopio != null ? 100 * r.hri.fluency.robotTime.acopio : null), 1],
  ['Tiempo dentro de S_p(v)', 's', (r) => r.hri?.fluency.protection.s],
]

/** Flota (H8): una columna por robot y el total de la flota, más el equilibrio de cajas y la distancia entre robots. */
function TablaFlota({ run }) {
  const res = run.flota.resumen
  return (
    <>
      <h4 className="sec">{t('Cada robot y la flota')}</h4>
      <div className="row">
        <span>{t('Cómo se reparten')}</span>
        <b>{t(ESTRATEGIAS[run.flota.estrategia][0])}</b>
      </div>
      <table className="cmp" data-testid="flota-tabla">
        <thead>
          <tr>
            <th>{t('Métrica')}</th>
            {run.flota.robots.map((_, k) => (
              <th key={k}>
                <i className="sw" style={{ background: colorRobot(k) }} />
                {etiquetaRobot(k)}
              </th>
            ))}
            <th>{t('Flota')}</th>
          </tr>
        </thead>
        <tbody>
          {filasFlota(run).map((f) => (
            <tr key={f.key}>
              <td style={{ whiteSpace: 'normal' }}>
                {t(f.nombre)} <span className="muted small">{f.unidad}</span>
              </td>
              {f.robots.map((v, k) => (
                <td key={k} className="num">
                  {fmt(v, f.dg ?? 0)}
                </td>
              ))}
              <td className="num">
                <b>{fmt(f.flota, f.dg ?? 0)}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row">
        <span>{t('Equilibrio de cajas entre robots (Jain)')}</span>
        <b className={res.jainCajas < 0.8 ? 'warn' : ''}>{fmt(res.jainCajas, 2)}</b>
      </div>
      <div className="row">
        <span>{t('Distancia mínima entre robots')}</span>
        <b>{res.distMin_m == null ? '—' : `${fmt(res.distMin_m, 1)} m`}</b>
      </div>
      <div className="row">
        <span>{t('Distancia mínima entre robots (con alguno en una calle)')}</span>
        <b>{res.distMinCalle_m == null ? '—' : `${fmt(res.distMinCalle_m, 1)} m`}</b>
      </div>
    </>
  )
}

/**
 * Pestaña Robot (I4): qué hace el robot y cuánto cuesta. Con una variante con robot en la comparación, una tabla
 * pone lado a lado las dos corridas; el detalle (tiempo, energía, retardos) es el de la corrida principal.
 */
export function RobotPanel({ ho, hr, labels, t: tNow, seek }) {
  useLang()
  // con flota (H8): el detalle de abajo es el de la flota entera (-1) o el de un robot
  const [det, setDet] = useState(-1)
  const a = hr?.hri
  if (!a) return <div className="note">{t('El análisis del robot requiere una corrida con robot.')}</div>
  const dos = !!ho?.hri
  const dur = hr.series.t[hr.n - 1]
  const fl = hr.flota
  const ad = fl && a.porRobot[det] ? a.porRobot[det] : a
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
      {fl && <TablaFlota run={hr} />}
      {dos && <div className="note">{t('El detalle de abajo es el de {r}.', { r: labels.hr })}</div>}
      {fl && (
        <Seg
          size="mini"
          label={t('Detalle de')}
          value={a.porRobot[det] ? det : -1}
          onChange={setDet}
          options={[[-1, t('Flota')], ...fl.robots.map((_, k) => [k, etiquetaRobot(k)])]}
        />
      )}
      <h4 className="sec">{t('Reparto del tiempo del robot')}</h4>
      <RobotTime a={ad} />
      <h4 className="sec">{t('Energía')}</h4>
      <RobotEnergy a={ad} />
      <h4 className="sec">{t('Retardos')}</h4>
      <Delays a={ad} />
      <LineChart
        title={fl ? t('Cultivo a bordo de cada robot') : t('Cultivo a bordo del robot')}
        unit={t('unidades')}
        series={
          fl
            ? fl.robots.map((r, k) => ({ key: `r${k}`, name: etiquetaRobot(k), color: colorRobot(k), t: hr.series.t, y: r.onboard }))
            : [{ key: 'hr', name: t('A bordo'), color: SC.hr.color, t: hr.series.t, y: hr.robot?.onboard || new Float32Array(hr.n) }]
        }
        tmax={dur}
        t={tNow}
        onSeek={seek}
      />
    </div>
  )
}
