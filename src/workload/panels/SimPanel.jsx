import { useEffect, useState } from 'react'
import { PROFILES, profileDefaults } from '../../hrsim/common.js'
import { SISTEMAS } from '../../hrsim/huertos/index.js'
import { HOLGURA_CALLE } from '../../hrsim/huertos/rectangular.js'
import { ROBOTS, capacidadCajas } from '../../hrsim/robots.js'
import { Field, Seg } from '../ui.jsx'
import { ACTS } from '../library.js'
import { ACT_LABEL } from '../spec.js'
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
// cuadrilla: [clave, etiqueta, paso, fuente/valor de MATLAB, mínimo válido, máximo válido]
const CREW = [
  ['walkSpeed', 'Velocidad de caminata (m/s)', 0.05, 'MATLAB: 0,75', 0.05],
  ['ladderTime', 'Tiempo de escalera (s)', 0.5, 'MATLAB: 5', 0],
  ['loadTimePerBox', 'Carga al robot (s/caja)', 0.1, 'Protocolo: 3,6 (worker_loads)', 0],
  ['maxProd', 'Unidades por caja', 1, 'MATLAB: 15', 1],
  ['metabolicMultiplier', 'Multiplicador metabólico', 0.05, '1 = costos del script', 0],
]
// robot transportador
const ROBOT = [
  ['unloadTimePerBox', 'Descarga del robot (s/caja)', 0.1, 'Protocolo: 1,44', 0],
  ['capacityBoxes', 'Capacidad del robot (cajas)', 1, 'Protocolo: 68', 1],
  ['maxBoxStopsPerLap', 'Paradas máx. por vuelta', 1, 'Protocolo: 10', 1],
  ['waypointTimeout', 'Tiempo máx. en waypoint (s)', 5, 'Protocolo: 60', 1],
  ['detectorRange', 'Alcance del detector (m)', 0.5, 'MATLAB: 3', 0.1],
  ['boxRouteOffset', 'Desvío de ruta a caja (m)', 0.1, 'MATLAB: 1,2', 0],
]
const DURATION = ['duration', 'Duración (s)', 60, 'Estudio: 2700 (45 min) · máx. 14 400 (4 h)', 60, 14400]
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
const SHORT = {
  'matlab-2026': 'Estudio',
  'palta-tradicional': 'Palta trad.',
  'palta-alta-densidad': 'Palta alta dens.',
  'palta-ladera': 'Palta ladera',
  'uva-parron': 'Uva parrón',
  arandano: 'Arándano',
  'cerezo-ufo': 'Cerezo UFO',
}
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
  ['pendiente', 'Pendiente a lo largo de las hileras (%)', 1, 0, 60],
]
const PERIODS = [
  [1, 'Suelo'],
  [2, 'Escalera'],
  [3, 'Gancho'],
]

/** Paso k (de 1 a 3) cuyos valores cambian con la clave `k` de los parámetros. */
const STEP_OF = (k) => (k === 'huertoParams' ? 1 : k === 'duration' ? 3 : 2)
/** Pasos con valores distintos de los de partida (un punto junto al título). */
export function changedSteps(params, base) {
  const s = new Set()
  for (const k of new Set([...Object.keys(params), ...Object.keys(base)])) if (JSON.stringify(params[k]) !== JSON.stringify(base[k])) s.add(STEP_OF(k))
  return s
}

/** Paso numerado del panel izquierdo: Escenario → Agentes → Simulación. */
export function Step({ n, title, changed, children, testid }) {
  useLang()
  const id = `step-${n}`
  return (
    <section className="panel wstep" aria-labelledby={id} data-testid={testid}>
      <h4 id={id}>
        <span className="step-n" aria-hidden="true">
          {n}
        </span>
        {title}
        {changed && <i className="step-dot" title={t('Tiene valores distintos de los de partida')} aria-label={t('modificado')} />}
      </h4>
      {children}
    </section>
  )
}

/** Grupo de parámetros avanzados, plegado; el título dice si tiene valores modificados. */
function Group({ title, changed, testid, children }) {
  return (
    <details className="group">
      <summary data-testid={testid}>
        {title}
        {changed && <span className="muted"> · {t('modificado')}</span>}
      </summary>
      <div className="params">{children}</div>
    </details>
  )
}

const differs = (a, b, keys) => keys.some((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))

/**
 * Panel izquierdo del modo Simulador en tres pasos que siguen la jerarquía del modelo:
 * 1 Escenario (qué huerto), 2 Agentes (cuadrilla y robot), 3 Simulación (correr, exportar).
 * Nada simula solo: los cambios se aplican al pulsar «Simular» y, mientras tanto, la escena avisa que está desactualizada.
 */
export function SimSteps({ params, setParams, cfg, pickCfg, onRun, onCancel, busy, stale, info, onExport, videoPanel }) {
  useLang()
  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }))
  const row = (k, l, st, src, min, max) => (
    <label key={k} title={src ? t(src) : undefined}>
      <span>{t(l)}</span>
      <NumField value={params[k]} step={st} min={min} max={max} label={t(l)} onCommit={(v) => set(k, v)} />
    </label>
  )
  const base = profileDefaults(params.profile, params.huerto, params.robotTipo)
  const steps = changedSteps(params, base)
  const hp = params.huertoParams
  const generated = !!hp
  const libre = hp ? hp.calle - 2 * hp.radioCopa : null
  const noLadder = hp?.escalera === false
  const acts = ACTS.filter((a) => !(noLadder && a === 'ladder'))
  const crewChanged = differs(params, base, [...CREW.map((r) => r[0]), 'costs', 'prodPeriod'])
  const robotChanged = differs(params, base, [...ROBOT.map((r) => r[0]), 'ssm', 'energia'])
  return (
    <>
      <Step n={1} title={t('Escenario')} changed={steps.has(1)} testid="step-escenario">
        <Field label={t('Huerto')}>
          <Seg
            size="mini"
            value={params.huerto}
            onChange={(h) => setParams(profileDefaults(params.profile, h, params.robotTipo))}
            options={Object.entries(SISTEMAS).map(([k, v]) => [k, t(SHORT[k] || k), false, t(v.label)])}
          />
        </Field>
        {generated ? (
          <div className="note" data-testid="huerto-info">
            {t('{n} plantas · {w} × {h} m · calle libre {l} m', {
              n: hp.hileras * hp.arbolesPorHilera,
              w: fmtNum(hp.hileras * hp.calle, { maximumFractionDigits: 1 }),
              h: fmtNum(2 * hp.cabecera + hp.arbolesPorHilera * hp.sobreHilera, { maximumFractionDigits: 1 }),
              l: fmtNum(libre, { maximumFractionDigits: 2 }),
            })}
            {hp.pendiente > 0 &&
              ` · ${t('pendiente {p} %, acopio {d}', { p: fmtNum(hp.pendiente, { maximumFractionDigits: 1 }), d: hp.acopioEnCima ? t('en la cima') : t('al pie') })}`}
          </div>
        ) : (
          <>
            <Field label={t('Fila de cultivo')}>
              <Seg value={cfg?.row} options={[1, 2, 3].map((v) => [v, String(v)])} onChange={(v) => pickCfg('row', v)} />
            </Field>
            <Field label={t('Disposición (RP)')}>
              <Seg value={cfg?.rp} options={[0, 1].map((v) => [v, String(v)])} onChange={(v) => pickCfg('rp', v)} />
            </Field>
            <div className="note">{t('Mapa del estudio: 3 filas × 4 árboles, simulado con el modelo de MATLAB.')}</div>
          </>
        )}
        {generated && (
          <Group title={t('Ajustar el huerto')} changed={steps.has(1)} testid="huerto-params">
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
            <label>
              <span>{t('Acopio en la cima del cerro')}</span>
              <input
                type="checkbox"
                checked={hp.acopioEnCima}
                disabled={!hp.pendiente}
                onChange={(e) => setParams((p) => ({ ...p, huertoParams: { ...p.huertoParams, acopioEnCima: e.target.checked } }))}
              />
            </label>
            {2 * hp.radioCopa >= hp.calle && <div className="note warn">{t('Las copas de hileras vecinas se tocan: no queda calle para caminar.')}</div>}
          </Group>
        )}
      </Step>

      <Step n={2} title={t('Agentes')} changed={steps.has(2)} testid="step-agentes">
        <Field label={t('Cosecheros')}>
          <Seg
            value={cfg?.nw}
            options={(generated ? [4, 8, 12, 16, 24, 32] : [4, 6, 8, 10, 12, 16, 20]).map((v) => [v, String(v)])}
            onChange={(v) => pickCfg('nw', v)}
          />
        </Field>
        <Field label={t('Actividad')}>
          <Seg value={cfg?.act} options={acts.map((a) => [a, t(ACT_LABEL[a])])} onChange={(v) => pickCfg('act', v)} />
        </Field>
        {generated && <div className="note">{t('Los cosecheros trabajan por parejas en las calles frente al acopio y avanzan por la hilera.')}</div>}
        <Group title={t('Ajustar la cuadrilla')} changed={crewChanged} testid="crew-params">
          {CREW.map((r) => row(...r))}
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
                label={t(l)}
                onCommit={(v) => setParams((p) => ({ ...p, prodPeriod: { ...p.prodPeriod, [k]: v } }))}
              />
            </label>
          ))}
        </Group>

        <Field label={t('Robot')}>
          {generated ? (
            <Seg
              size="mini"
              value={params.robotTipo}
              onChange={(r) => setParams((p) => ({ ...p, robotTipo: r, capacityBoxes: capacidadCajas(r, p.maxProd), energia: { ...ROBOTS[r].energia } }))}
              options={Object.entries(ROBOTS).map(([k, v]) => [k, t(v.label), false, t(v.label)])}
            />
          ) : (
            <div className="note" style={{ marginTop: 0 }}>
              {t('Warthog del estudio: 68 cajas, sin modelo de energía.')}
            </div>
          )}
        </Field>
        {generated && (
          <div className="note" data-testid="robot-info">
            {libre >= (ROBOTS[params.robotTipo]?.ancho ?? 1.38) + HOLGURA_CALLE
              ? t('el robot entra a las calles')
              : t('el robot no cabe en las calles: recorre la cabecera')}
            {` · ${t('{n} cajas de {k} kg por viaje', { n: params.capacityBoxes, k: fmtNum(params.maxProd, { maximumFractionDigits: 1 }) })}`}
            {params.robotTipo !== 'warthog' && hp.pendiente > 15 && ` · ${t('pendiente fuera de la ficha del Burro (15 %)')}`}
          </div>
        )}
        <Field label={t('Comportamiento del robot')}>
          <Seg
            size="mini"
            value={params.profile}
            onChange={(p) => setParams(profileDefaults(p, params.huerto, params.robotTipo))}
            options={Object.entries(PROFILES).map(([k, v]) => [k, k === 'matlab-2026' ? t('Como en MATLAB') : t('Con regla de seguridad'), false, t(v.label)])}
          />
        </Field>
        {params.profile !== 'matlab-2026' && (
          <div className="note">
            {t('{p}: extiende la réplica de MATLAB con consideraciones de interacción humano-robot.', { p: t(PROFILES[params.profile].label) })}
          </div>
        )}
        <Group title={t('Ajustar el robot')} changed={robotChanged} testid="robot-params">
          {ROBOT.map((r) => row(...r))}
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
        </Group>
      </Step>

      <Step n={3} title={t('Simulación')} changed={steps.has(3)} testid="step-simulacion">
        <div className="params">{row(...DURATION)}</div>
        {busy ? (
          <button className="btn" onClick={onCancel} data-testid="sim-cancel">
            {t('Simulando… · Cancelar')}
          </button>
        ) : (
          <button className={`btn${stale ? ' primary' : ''}`} onClick={onRun} data-testid="sim-run">
            {t('Simular')}
          </button>
        )}
        {stale && !busy && <div className="note warn">{t('Hay cambios sin simular.')}</div>}
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
        {steps.size > 0 && (
          <button className="btn link" style={{ marginTop: 6 }} onClick={() => setParams(base)} data-testid="sim-reset">
            {params.profile === 'matlab-2026' ? t('Restablecer a MATLAB') : t('Restablecer perfil')}
          </button>
        )}
      </Step>
      {videoPanel}
    </>
  )
}

/** Parámetros de la réplica validada (perfil matlab-2026). */
export const DEFAULTS_SIM = profileDefaults('matlab-2026')
