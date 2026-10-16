import { fmtT } from '../ui.jsx'

export function DataPanel({ ho, hr }) {
  const Item = ({ run, label }) =>
    run && (
      <div className="ds">
        <div className="row-between">
          <b>{label}</b>
          <span className="muted small">
            {fmtT(run.series.t[run.n - 1])} · paso {run.dt} s
          </span>
        </div>
        <div className="small muted">{run.name}</div>
        <div className="small">
          Entrega de cajas:{' '}
          {run.meta.robot ? (run.meta.placement === 'tree_point' ? 'punto por árbol' : 'junto a la ruta, por trabajador') : 'a pie hasta la zona de carga'}
        </div>
      </div>
    )
  return (
    <>
      <Item run={ho} label="Solo humano" />
      <Item run={hr} label="Humano-robot" />
      <div className="hint">
        Los CSV de MATLAB no registran trayectorias. Las posiciones de los trabajadores se reconstruyen desde sus banderas de actividad y la del robot desde el
        log de eventos. Producción y carga de trabajo son datos exactos del simulador.
      </div>
    </>
  )
}
