import { DEFAULTS } from '../../hrsim/common.js'

/* ---------------------------------------------------------------- parámetros del simulador */
const PARAMS = [
  ['walkSpeed', 'Velocidad de caminata (m/s)', 0.05, 'MATLAB: 0,75'],
  ['ladderTime', 'Tiempo de escalera (s)', 0.5, 'MATLAB: 5'],
  ['loadTimePerBox', 'Carga al robot (s/caja)', 0.1, 'Protocolo: 3,6 (worker_loads)'],
  ['unloadTimePerBox', 'Descarga del robot (s/caja)', 0.1, 'Protocolo: 1,44'],
  ['capacityBoxes', 'Capacidad del robot (cajas)', 1, 'Protocolo: 68'],
  ['maxProd', 'Unidades por caja', 1, 'MATLAB: 15'],
  ['maxBoxStopsPerLap', 'Paradas máx. por vuelta', 1, 'Protocolo: 10'],
  ['waypointTimeout', 'Tiempo máx. en waypoint (s)', 5, 'Protocolo: 60'],
  ['detectorRange', 'Alcance del detector (m)', 0.5, 'MATLAB: 3'],
  ['boxRouteOffset', 'Desvío de ruta a caja (m)', 0.1, 'MATLAB: 1,2'],
  ['metabolicMultiplier', 'Multiplicador metabólico', 0.05, '1 = costos del script'],
  ['duration', 'Duración (s)', 60, 'Estudio: 2700 (45 min)'],
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

export function SimPanel({ params, setParams, onRun, busy, info, onExport }) {
  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }))
  const num = (k, step) => (
    <input
      type="number"
      step={step}
      value={params[k]}
      onChange={(e) => {
        const v = Number(e.target.value)
        if (Number.isFinite(v)) set(k, v)
      }}
    />
  )
  const changed = JSON.stringify(params) !== JSON.stringify(DEFAULTS_SIM)
  return (
    <section className="panel">
      <h4>Simulador</h4>
      <button className="btn" onClick={onRun} disabled={busy}>
        {busy ? 'Simulando…' : 'Simular'}
      </button>
      {info && <div className="note">{info}</div>}
      {onExport && (
        <button
          className="btn"
          style={{ marginTop: 6 }}
          onClick={onExport}
          disabled={busy}
          title="Descarga *_timeseries.csv (formato MATLAB), *_poses.csv y *_meta.json (parámetros y versión del motor) de cada corrida"
        >
          Exportar corridas
        </button>
      )}
      <details>
        <summary>Parámetros{changed ? ' (modificados)' : ''}</summary>
        <div className="params">
          {PARAMS.map(([k, l, st, src]) => (
            <label key={k} title={src}>
              <span>{l}</span>
              {num(k, st)}
            </label>
          ))}
          <div className="note">Costos metabólicos (kcal/s)</div>
          {COSTS.map(([k, l]) => (
            <label key={k}>
              <span>{l}</span>
              <input
                type="number"
                step="0.001"
                value={params.costs[k]}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (Number.isFinite(v)) setParams((p) => ({ ...p, costs: { ...p.costs, [k]: v } }))
                }}
              />
            </label>
          ))}
          <div className="note">Bajar escalera: el script actual usa 0,0923; el CSV de ejemplo se generó con 0,106145.</div>
          <div className="note">Segundos por unidad cosechada</div>
          {PERIODS.map(([k, l]) => (
            <label key={k}>
              <span>{l}</span>
              <input
                type="number"
                step="0.25"
                value={params.prodPeriod[k]}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (v > 0) setParams((p) => ({ ...p, prodPeriod: { ...p.prodPeriod, [k]: v } }))
                }}
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
