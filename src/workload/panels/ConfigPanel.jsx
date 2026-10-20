import { useRef } from 'react'
import { ACTS } from '../library.js'
import { SimSteps, Step } from './SimPanel.jsx'
import { ACT_LABEL } from '../spec.js'
import { Field, Seg } from '../ui.jsx'
import { t, useLang } from '../../i18n/index.js'

/* ---------------------------------------------------------------- panel izquierdo: pasos de la configuración */
/**
 * Modo Simulador: los tres pasos de SimSteps. Modo Réplica MATLAB: los mismos tres pasos sobre el mapa del estudio,
 * pero se elige entre las corridas de MATLAB disponibles (incluidas o cargadas) en vez de simular.
 */
export function ConfigPanel({ lib, cfg, pickCfg, onFiles, loading, source, simProps, videoPanel }) {
  useLang()
  return (
    <aside className="wb-left" aria-label={t('Configuración de la corrida')}>
      {source === 'sim' ? (
        <SimSteps {...simProps} cfg={cfg} pickCfg={pickCfg} videoPanel={videoPanel} />
      ) : (
        <ReplicaSteps lib={lib} cfg={cfg} pickCfg={pickCfg} onFiles={onFiles} loading={loading} videoPanel={videoPanel} />
      )}
    </aside>
  )
}

function ReplicaSteps({ lib, cfg, pickCfg, onFiles, loading, videoPanel }) {
  const fileRef = useRef()
  const uniq = (k) => [...new Set(lib.map((e) => e[k]))].sort((a, b) => (typeof a === 'number' ? a - b : String(a).localeCompare(String(b))))
  const acts = ACTS.filter((a) => lib.some((e) => e.act === a))
  return (
    <>
      <Step n={1} title={t('Escenario')} testid="step-escenario">
        <div className="note" style={{ marginTop: 0, marginBottom: 8 }}>
          {t('Mapa del estudio: 3 filas × 4 árboles, con las corridas del simulador MATLAB.')}
        </div>
        <Field label={t('Fila de cultivo')}>
          <Seg value={cfg?.row} options={uniq('row').map((v) => [v, String(v)])} onChange={(v) => pickCfg('row', v)} />
        </Field>
        <Field label={t('Disposición (RP)')}>
          <Seg value={cfg?.rp} options={uniq('rp').map((v) => [v, String(v)])} onChange={(v) => pickCfg('rp', v)} />
        </Field>
      </Step>

      <Step n={2} title={t('Agentes')} testid="step-agentes">
        <Field label={t('Cosecheros')}>
          <Seg value={cfg?.nw} options={uniq('nw').map((v) => [v, String(v)])} onChange={(v) => pickCfg('nw', v)} />
        </Field>
        <Field label={t('Actividad')}>
          <Seg value={cfg?.act} options={acts.map((a) => [a, t(ACT_LABEL[a])])} onChange={(v) => pickCfg('act', v)} />
        </Field>
        <div className="note">{t('Robot Warthog del estudio, con el comportamiento de la réplica.')}</div>
      </Step>

      <Step n={3} title={t('Corridas')} testid="step-datos">
        <div className="note" style={{ marginTop: 0, marginBottom: 8 }}>
          {t(lib.length === 1 ? '{n} corrida disponible.' : '{n} corridas disponibles.', { n: lib.length })}{' '}
          {t('Las demás combinaciones se agregan cargando archivos de MATLAB.')}
        </div>
        <button className="btn" onClick={() => fileRef.current.click()}>
          {t('Cargar archivos de MATLAB…')}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".csv,.txt"
          hidden
          onChange={(e) => {
            onFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <div className="note">
          {t('Selecciona el')} <b>*_timeseries.csv</b> {t('y, para corridas con robot, su')} <b>*_robot_status_log.txt</b>
          {t('. Se procesan en tu navegador; no se suben a ningún servidor.')}
        </div>
        {loading && <div className="note">{t('Cargando…')}</div>}
      </Step>
      {videoPanel}
    </>
  )
}
