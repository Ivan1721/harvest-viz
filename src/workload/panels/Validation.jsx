import { useEffect, useState } from 'react'
import { DEFAULTS_SIM } from './SimPanel.jsx'
import { fmtNum, t, useLang } from '../../i18n/index.js'

/* ---------------------------------------------------------------- validación contra MATLAB */
let _ms = null
const loadMS = (base) =>
  (_ms ||= fetch(`${base}data/matlab_summary.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({})))
const VM = [
  ['TimeWeightedAverageMetabolicRate', 'Tasa metabólica media (kcal)', 2],
  ['AverageHumanProduction', 'Producción media por trabajador (u)', 1],
  ['TotalHumanWorkload', 'Carga de trabajo total (kcal)', 1],
  ['TotalProductionCargoZone', 'Entregado a zona de carga (u)', 0],
  ['RemainingCropsHumanBags', 'Restante en bolsas (u)', 0],
  ['RemainingCropsBoxes', 'Restante en cajas (u)', 0],
  ['RemainingCropsRobot', 'Restante en robot (u)', 0],
  ['TotalRecollectedCrops', 'Total recolectado (u)', 0],
]
export function Validation({ ho, hr, cfg, params, base }) {
  useLang()
  const [ms, setMs] = useState(null)
  useEffect(() => {
    loadMS(base).then(setMs)
  }, [base])
  const std = JSON.stringify({ ...params, duration: 0 }) === JSON.stringify({ ...DEFAULTS_SIM, duration: 0 }) && params.duration === DEFAULTS_SIM.duration
  const block = (run, kind, label) => {
    const ref = ms && cfg && ms[`${kind}|${cfg.nw}|${cfg.row}|${cfg.act}|${cfg.rp}`]
    if (!run || !run.summary) return null
    return (
      <div key={kind}>
        <h4 style={{ marginTop: 14 }}>{t(label)}</h4>
        {!ref ? (
          <div className="note">{t('MATLAB no tiene esta configuración en sus resúmenes; no hay contra qué comparar.')}</div>
        ) : (
          <table className="cmp">
            <thead>
              <tr>
                <th>{t('Métrica')}</th>
                <th>{t('Simulador')}</th>
                <th>MATLAB</th>
                <th>Δ</th>
              </tr>
            </thead>
            <tbody>
              {VM.map(([k, l, dg]) => {
                const a = run.summary[k],
                  b = ref[k],
                  d = a - b
                const ok = Math.abs(d) <= 1e-6 * Math.max(1, Math.abs(b))
                const fm = (v) => fmtNum(v, { minimumFractionDigits: dg, maximumFractionDigits: dg })
                return (
                  <tr key={k}>
                    <td>{t(l)}</td>
                    <td className="num">{fm(a)}</td>
                    <td className="num">{fm(b)}</td>
                    <td className="num" style={{ color: ok ? 'var(--green)' : 'var(--warn, #b45309)' }}>
                      {ok ? '✓' : (d > 0 ? '+' : '') + fmtNum(d, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    )
  }
  return (
    <div className="cardlist">
      <div className="note">
        {t(
          'Compara las métricas finales del simulador con las de MATLAB para esta misma configuración (resúmenes de simulation_outputs). Réplica verificada: 360/360 configuraciones Solo-humano y 352/360 Humano-robot idénticas (las demás difieren por un empate de redondeo; ver docs/simulador.md).',
        )}
      </div>
      {!std && (
        <div className="note" style={{ color: 'var(--warn, #b45309)' }}>
          {params.profile === 'matlab-2026'
            ? t('Cambiaste parámetros respecto a MATLAB: una diferencia ahora es el efecto del cambio, no un error del modelo.')
            : t('Perfil HRI: el modelo extiende la réplica de MATLAB, así que una diferencia es el efecto de las consideraciones nuevas, no un error.')}
        </div>
      )}
      {block(ho, 'HO', 'Solo humano')}
      {block(hr, 'HR', 'Humano-robot')}
    </div>
  )
}
