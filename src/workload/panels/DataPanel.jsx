import { fmtT } from '../ui.jsx'
import { t, useLang } from '../../i18n/index.js'

function Item({ run, label }) {
  useLang()
  return (
    run && (
      <div className="ds">
        <div className="row-between">
          <b>{t(label)}</b>
          <span className="muted small">
            {fmtT(run.series.t[run.n - 1])} · {t('paso {dt} s', { dt: run.dt })}
          </span>
        </div>
        <div className="small muted">{run.name}</div>
        <div className="small">
          {t('Entrega de cajas:')}{' '}
          {t(run.meta.robot ? (run.meta.placement === 'tree_point' ? 'punto por árbol' : 'junto a la ruta, por trabajador') : 'a pie hasta la zona de carga')}
        </div>
      </div>
    )
  )
}

export function DataPanel({ ho, hr }) {
  useLang()
  return (
    <>
      <Item run={ho} label="Solo humano" />
      <Item run={hr} label="Humano-robot" />
      <div className="hint">
        {t(
          'Los CSV de MATLAB no registran trayectorias. Las posiciones de los trabajadores se reconstruyen desde sus banderas de actividad y la del robot desde el log de eventos. Producción y carga de trabajo son datos exactos del simulador.',
        )}
      </div>
    </>
  )
}
