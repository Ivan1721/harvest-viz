import { useEffect, useState } from 'react'
import { DEFAULTS } from '../../hrsim/common.js'

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
const PERIODS = [
  [1, 'Suelo'],
  [2, 'Escalera'],
  [3, 'Gancho'],
]

export function SimPanel({ params, setParams, onRun, onCancel, busy, info, onExport }) {
  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }))
  // un campo vacío o fuera de rango no se aplica (p. ej. velocidad 0 dejaría a los trabajadores inmóviles)
  const num = (k, step, min, max) => <NumField value={params[k]} step={step} min={min} max={max} onCommit={(v) => set(k, v)} />
  const changed = JSON.stringify(params) !== JSON.stringify(DEFAULTS_SIM)
  return (
    <section className="panel">
      <h4>Simulador</h4>
      {busy ? (
        <button className="btn" onClick={onCancel} data-testid="sim-cancel">
          Simulando… · Cancelar
        </button>
      ) : (
        <button className="btn" onClick={onRun} data-testid="sim-run">
          Simular
        </button>
      )}
      {info && <div className="note">{info}</div>}
      {onExport && (
        <button
          className="btn"
          style={{ marginTop: 6 }}
          onClick={onExport}
          disabled={busy}
          title="Descarga un .zip con *_timeseries.csv (formato MATLAB), *_poses.csv y *_meta.json (parámetros y versión del motor) de cada corrida"
        >
          Exportar corridas
        </button>
      )}
      <details>
        <summary>Parámetros{changed ? ' (modificados)' : ''}</summary>
        <div className="params">
          {PARAMS.map(([k, l, st, src, min, max]) => (
            <label key={k} title={src}>
              <span>{l}</span>
              {num(k, st, min, max)}
            </label>
          ))}
          <div className="note">Costos metabólicos (kcal/s)</div>
          {COSTS.map(([k, l]) => (
            <label key={k}>
              <span>{l}</span>
              <NumField value={params.costs[k]} step="0.001" min={0} onCommit={(v) => setParams((p) => ({ ...p, costs: { ...p.costs, [k]: v } }))} />
            </label>
          ))}
          <div className="note">Bajar escalera: el script actual usa 0,0923; el CSV de ejemplo se generó con 0,106145.</div>
          <div className="note">Segundos por unidad cosechada</div>
          {PERIODS.map(([k, l]) => (
            <label key={k}>
              <span>{l}</span>
              <NumField
                value={params.prodPeriod[k]}
                step="0.25"
                min={0.25}
                onCommit={(v) => setParams((p) => ({ ...p, prodPeriod: { ...p.prodPeriod, [k]: v } }))}
              />
            </label>
          ))}
          <button className="btn" onClick={() => setParams(DEFAULTS_SIM)}>
            Restablecer a MATLAB
          </button>
        </div>
      </details>
    </section>
  )
}
export const DEFAULTS_SIM = JSON.parse(JSON.stringify(DEFAULTS))
