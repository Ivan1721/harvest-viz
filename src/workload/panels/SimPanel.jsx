import { useEffect, useState } from 'react'
import { PROFILES, profileDefaults } from '../../hrsim/common.js'
import { SISTEMAS } from '../../hrsim/huertos/index.js'
import { ROBOT_ANCHO, HOLGURA_CALLE } from '../../hrsim/huertos/rectangular.js'
import { Field, Seg } from '../ui.jsx'
import { fmtNum, t, useLang } from '../../i18n/index.js'

/** Campo numérico: deja escribir libremente y solo aplica valores válidos (≥ min, no vacío). */
export function NumField({ value, onCommit, step, min = 0, max = Infinity, label }) {
  const [text, setText] = useState(String(value))
  useEffect(() => {
    if (Number(text) !== value) setText(String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const v = Number(text.trim())
  const invalid = text.trim() === '' || !Number.isFinite(v) || v < min || v > max
  return (
    <input
      type="number"
      step={step}
      min={min}
      max={Number.isFinite(max) ? max : undefined}
      aria-label={label}
      value={text}
      aria-invalid={invalid}
      style={invalid ? { borderColor: '#dc2626' } : undefined}
      onChange={(e) => {
        const t = e.target.value
        setText(t)
        const n = Number(t.trim())
        if (t.trim() !== '' && Number.isFinite(n) && n >= min && n <= max) onCommit(n)
      }}
    />
  )
}

/* ---------------------------------------------------------------- parámetros del simulador */
// [clave, etiqueta, paso, fuente/valor de MATLAB, mínimo válido, máximo válido]
const PARAMS = [
  ['walkSpeed', 'Velocidad de caminata (m/s)', 0.05, 'MATLAB: 0,75', 0.05],
  ['ladderTime', 'Tiempo de escalera (s)', 0.5, 'MATLAB: 5', 0],
  ['loadTimePerBox', 'Carga al robot (s/caja)', 0.1, 'Protocolo: 3,6 (worker_loads)', 0],
  ['unloadTimePerBox', 'Descarga del robot (s/caja)', 0.1, 'Protocolo: 1,44', 0],
  ['capacityBoxes', 'Capacidad del robot (cajas)', 1, 'Protocolo: 68', 1],
  ['maxProd', 'Unidades por caja', 1, 'MATLAB: 15', 1],
  ['maxBoxStopsPerLap', 'Paradas máx. por vuelta', 1, 'Protocolo: 10', 1],
  ['waypointTimeout', 'Tiempo máx. en waypoint (s)', 5, 'Protocolo: 60', 1],
  ['detectorRange', 'Alcance del detector (m)', 0.5, 'MATLAB: 3', 0.1],
  ['boxRouteOffset', 'Desvío de ruta a caja (m)', 0.1, 'MATLAB: 1,2', 0],
  ['metabolicMultiplier', 'Multiplicador metabólico', 0.05, '1 = costos del script', 0],
  ['duration', 'Duración (s)', 60, 'Estudio: 2700 (45 min) · máx. 14 400 (4 h)', 60, 14400],
]
const COSTS = [
  ['walking', 'Caminar'],
  ['walkingCarrying', 'Caminar con caja'],
  ['harvestGround', 'Cosechar (suelo)'],
  ['harvestLadder', 'Cosechar (escalera)'],
  ['harvestPicker', 'Cosechar (gancho)'],
  ['ladderClimb', 'Subir escalera'],
  ['ladderDown', 'Bajar escalera'],
]
// regla de seguridad SSM (fase 3, solo perfil hri): [clave, etiqueta, paso, fuente, mínimo]
const SSM = [
  ['vh', 'Velocidad humana supuesta v_h (m/s)', 0.1, 'ISO 13855: 1,6', 0.1],
  ['Tr', 'Tiempo de reacción T_r (s)', 0.05, 'Campomaggiore et al. 2019: 0,10', 0],
  ['a', 'Desaceleración de frenado a (m/s²)', 0.1, 'Supuesto: 1,5 (conservador: 1,0)', 0.1],
  ['C', 'Intrusión antes de detectar C (m)', 0.05, 'Campomaggiore et al. 2019: 0,20', 0],
  ['Zd', 'Incertidumbre del trabajador Z_d (m)', 0.01, 'Campomaggiore et al. 2019: 0,107', 0],
  ['Zr', 'Incertidumbre del robot Z_r (m)', 0.01, 'Supuesto: 0,10', 0],
  ['warn', 'Margen de advertencia (m)', 0.1, 'Supuesto: 1,0', 0],
  ['vSlow', 'Velocidad lenta (m/s)', 0.05, 'ISO 3691-4: 0,3', 0.05],
  ['tResume', 'Tiempo libre para reanudar (s)', 0.25, 'Supuesto: 1,0', 0],
]
const SHORT = { 'matlab-2026': 'Estudio', 'palta-tradicional': 'Palta trad.', 'palta-alta-densidad': 'Palta alta dens.' }
// parámetros del generador de huertos (H2): [clave, etiqueta, paso, mínimo, máximo, entero]
const HUERTO = [
  ['hileras', 'Hileras', 1, 2, 200, true],
  ['arbolesPorHilera', 'Árboles por hilera', 1, 2, 200, true],
  ['calle', 'Distancia entre hileras (m)', 0.5, 1, 20],
  ['sobreHilera', 'Distancia sobre la hilera (m)', 0.5, 0.5, 20],
  ['radioCopa', 'Radio de copa (m)', 0.1, 0.2, 9],
  ['altura', 'Altura del árbol (m)', 0.5, 0.5, 12],
  ['cargaArbol', 'Carga por árbol (kg)', 1, 0, 500],
  ['cabecera', 'Ancho de cabecera (m)', 0.5, 3, 20],
]
const PERIODS = [
  [1, 'Suelo'],
  [2, 'Escalera'],
  [3, 'Gancho'],
]

export function SimPanel({ params, setParams, onRun, onCancel, busy, info, onExport }) {
  useLang()
  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }))
  // un campo vacío o fuera de rango no se aplica (p. ej. velocidad 0 dejaría a los trabajadores inmóviles)
  const num = (k, step, min, max, label) => <NumField value={params[k]} step={step} min={min} max={max} label={label} onCommit={(v) => set(k, v)} />
  const base = profileDefaults(params.profile, params.huerto)
  const changed = JSON.stringify(params) !== JSON.stringify(base)
  const hp = params.huertoParams
  const libre = hp ? hp.calle - 2 * hp.radioCopa : null
  return (
    <section className="panel">
      <h4>{t('Simulador')}</h4>
      <Field label={t('Modelo')}>
        <Seg
          size="mini"
          value={params.profile}
          onChange={(p) => setParams(profileDefaults(p, params.huerto))}
          options={Object.entries(PROFILES).map(([k, v]) => [k, k === 'matlab-2026' ? 'MATLAB 2026' : 'HRI', false, t(v.label)])}
        />
      </Field>
      <Field label={t('Huerto')}>
        <Seg
          size="mini"
          value={params.huerto}
          onChange={(h) => {
            setParams(profileDefaults(params.profile, h))
            onRun()
          }}
          options={Object.entries(SISTEMAS).map(([k, v]) => [k, t(SHORT[k] || k), false, t(v.label)])}
        />
      </Field>
      {hp && (
        <div className="note" data-testid="huerto-info">
          {t('{n} árboles · {w} × {h} m · calle libre {l} m', {
            n: hp.hileras * hp.arbolesPorHilera,
            w: fmtNum(hp.hileras * hp.calle, { maximumFractionDigits: 1 }),
            h: fmtNum(2 * hp.cabecera + hp.arbolesPorHilera * hp.sobreHilera, { maximumFractionDigits: 1 }),
            l: fmtNum(libre, { maximumFractionDigits: 2 }),
          })}
          {' · '}
          {libre >= ROBOT_ANCHO + HOLGURA_CALLE ? t('el robot entra a las calles') : t('el robot no cabe en las calles: recorre la cabecera')}
        </div>
      )}
      {params.profile !== 'matlab-2026' && (
        <div className="note">
          {t('{p}: extiende la réplica de MATLAB con consideraciones de interacción humano-robot.', { p: t(PROFILES[params.profile].label) })}
        </div>
      )}
      {busy ? (
        <button className="btn" onClick={onCancel} data-testid="sim-cancel">
          {t('Simulando… · Cancelar')}
        </button>
      ) : (
        <button className="btn" onClick={onRun} data-testid="sim-run">
          {t('Simular')}
        </button>
      )}
      {info && <div className="note">{info}</div>}
      {onExport && (
        <button
          className="btn"
          style={{ marginTop: 6 }}
          onClick={onExport}
          disabled={busy}
          title={t('Descarga un .zip con *_timeseries.csv (formato MATLAB), *_poses.csv y *_meta.json (parámetros y versión del motor) de cada corrida')}
        >
          {t('Exportar corridas')}
        </button>
      )}
      <details>
        <summary data-testid="sim-params">{changed ? t('Parámetros (modificados)') : t('Parámetros')}</summary>
        <div className="params">
          {PARAMS.map(([k, l, st, src, min, max]) => (
            <label key={k} title={t(src)}>
              <span>{t(l)}</span>
              {num(k, st, min, max, t(l))}
            </label>
          ))}
          <div className="note">{t('Costos metabólicos (kcal/s)')}</div>
          {COSTS.map(([k, l]) => (
            <label key={k}>
              <span>{t(l)}</span>
              <NumField
                value={params.costs[k]}
                step="0.001"
                min={0}
                label={t(l)}
                onCommit={(v) => setParams((p) => ({ ...p, costs: { ...p.costs, [k]: v } }))}
              />
            </label>
          ))}
          <div className="note">{t('Bajar escalera: el script actual usa 0,0923; el CSV de ejemplo se generó con 0,106145.')}</div>
          <div className="note">{t('Segundos por unidad cosechada')}</div>
          {PERIODS.map(([k, l]) => (
            <label key={k}>
              <span>{t(l)}</span>
              <NumField
                value={params.prodPeriod[k]}
                step="0.25"
                min={0.25}
                onCommit={(v) => setParams((p) => ({ ...p, prodPeriod: { ...p.prodPeriod, [k]: v } }))}
              />
            </label>
          ))}
          {hp && (
            <>
              <div className="note">{t('Huerto (generador)')}</div>
              {HUERTO.map(([k, l, st, min, max, int]) => (
                <label key={k}>
                  <span>{t(l)}</span>
                  <NumField
                    value={hp[k]}
                    step={st}
                    min={min}
                    max={max}
                    label={t(l)}
                    onCommit={(v) => (!int || Number.isInteger(v)) && setParams((p) => ({ ...p, huertoParams: { ...p.huertoParams, [k]: v } }))}
                  />
                </label>
              ))}
              {2 * hp.radioCopa >= hp.calle && <div className="note warn">{t('Las copas de hileras vecinas se tocan: no queda calle para caminar.')}</div>}
            </>
          )}
          {params.ssm && (
            <>
              <div className="note">{t('Seguridad: velocidad y separación (ISO/TS 15066)')}</div>
              <label>
                <span>{t('Regla de seguridad activa')}</span>
                <input
                  type="checkbox"
                  checked={params.ssm.enabled}
                  onChange={(e) => setParams((p) => ({ ...p, ssm: { ...p.ssm, enabled: e.target.checked } }))}
                />
              </label>
              {SSM.map(([k, l, st, src, min]) => (
                <label key={k} title={t(src)}>
                  <span>{t(l)}</span>
                  <NumField value={params.ssm[k]} step={st} min={min} label={t(l)} onCommit={(v) => setParams((p) => ({ ...p, ssm: { ...p.ssm, [k]: v } }))} />
                </label>
              ))}
            </>
          )}
          <button className="btn" onClick={() => setParams(base)}>
            {params.profile === 'matlab-2026' ? t('Restablecer a MATLAB') : t('Restablecer perfil')}
          </button>
        </div>
      </details>
    </section>
  )
}
/** Parámetros de la réplica validada (perfil matlab-2026). */
export const DEFAULTS_SIM = profileDefaults('matlab-2026')
