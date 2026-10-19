import { useRef } from 'react'
import { ACTS } from '../library.js'
import { SimPanel } from './SimPanel.jsx'
import { ACT_LABEL } from '../spec.js'
import { Field, Seg } from '../ui.jsx'
import { t, useLang } from '../../i18n/index.js'

/* ---------------------------------------------------------------- panel izquierdo: configuración */
export function ConfigPanel({
  lib,
  cfg,
  pickCfg,
  view,
  setView,
  hasHO,
  hasHR,
  preset,
  setPreset,
  snap,
  setColorBy,
  ov,
  setOv,
  onFiles,
  loading,
  look,
  setLook,
  canopy,
  setCanopy,
  source,
  setSource,
  simProps,
  videoPanel,
}) {
  useLang()
  const fileRef = useRef()
  const uniq = (k) => [...new Set(lib.map((e) => e[k]))].sort((a, b) => (typeof a === 'number' ? a - b : String(a).localeCompare(String(b))))
  const sim = source === 'sim'
  // huertos sin escalera (árboles bajos): no se ofrece la actividad «Escalera»
  const noLadder = sim && simProps?.params?.huertoParams?.escalera === false
  const acts = (sim ? ACTS : ACTS.filter((a) => lib.some((e) => e.act === a))).filter((a) => !(noLadder && a === 'ladder'))
  const opt = (k, all) => (sim ? all : uniq(k))
  // huertos generados: la fila y la disposición del estudio no aplican
  const generated = sim && simProps?.params?.huerto && simProps.params.huerto !== 'matlab-2026'
  return (
    <aside className="wb-left">
      <section className="panel">
        <h4>{t('Fuente')}</h4>
        <Seg
          value={source}
          onChange={setSource}
          options={[
            ['data', t('Datos MATLAB')],
            ['sim', t('Simulador')],
          ]}
        />
      </section>

      <section className="panel">
        <h4>{t('Configuración')}</h4>
        <Field label={t('Trabajadores')}>
          <Seg
            value={cfg?.nw}
            options={opt('nw', generated ? [4, 8, 12, 16, 24, 32] : [4, 6, 8, 10, 12, 16, 20]).map((v) => [v, String(v)])}
            onChange={(v) => pickCfg('nw', v)}
          />
        </Field>
        {!generated && (
          <Field label={t('Fila de cultivo')}>
            <Seg value={cfg?.row} options={opt('row', [1, 2, 3]).map((v) => [v, String(v)])} onChange={(v) => pickCfg('row', v)} />
          </Field>
        )}
        <Field label={t('Actividad')}>
          <Seg value={cfg?.act} options={acts.map((a) => [a, t(ACT_LABEL[a])])} onChange={(v) => pickCfg('act', v)} />
        </Field>
        {!generated && (
          <Field label={t('Disposición (RP)')}>
            <Seg value={cfg?.rp} options={opt('rp', [0, 1]).map((v) => [v, String(v)])} onChange={(v) => pickCfg('rp', v)} />
          </Field>
        )}
        {generated ? (
          <div className="note">{t('Huerto generado: los cosecheros trabajan por parejas en las calles frente al acopio y avanzan por la hilera.')}</div>
        ) : sim ? (
          <div className="note">{t('Cualquier combinación se simula en tu navegador con el modelo de MATLAB.')}</div>
        ) : (
          <div className="note">
            {t(lib.length === 1 ? '{n} corrida disponible.' : '{n} corridas disponibles.', { n: lib.length })}{' '}
            {t('Las demás combinaciones se agregan cargando archivos de MATLAB o con el simulador.')}
          </div>
        )}
      </section>

      {sim && <SimPanel {...simProps} />}

      <section className="panel">
        <h4>{t('Vista')}</h4>
        <Seg
          value={view}
          onChange={setView}
          options={[
            ['ho', t('Solo humano'), !hasHO],
            ['hr', t('Humano-robot'), !hasHR],
            ['cmp', t('Comparar'), !(hasHO && hasHR)],
          ]}
        />
        <Field label={t('Estilo visual')}>
          <Seg
            value={look}
            onChange={setLook}
            options={[
              ['real', t('Realista')],
              ['schem', t('Esquemático')],
            ]}
          />
        </Field>
        {look === 'real' && (
          <Field label={`${t('Opacidad del follaje')} · ${Math.round(canopy * 100)} %`}>
            <input
              type="range"
              aria-label={t('Opacidad del follaje')}
              min="0.15"
              max="1"
              step="0.05"
              value={canopy}
              onChange={(e) => setCanopy(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </Field>
        )}
        <Field label={t('Cámara')}>
          <Seg
            value={preset}
            onChange={setPreset}
            options={[
              ['iso', t('Isométrica')],
              ['top', t('Cenital')],
              ['side', t('Lateral')],
            ]}
          />
        </Field>
        <Field label={t('Color de los trabajadores')}>
          <Seg
            value={snap.colorBy}
            onChange={setColorBy}
            options={[
              ['rate', t('Carga metabólica')],
              ['flag', t('Actividad')],
            ]}
          />
        </Field>
        <div className="checks">
          <label className={ov.zones ? 'on' : ''}>
            <input type="checkbox" disabled={!hasHR} checked={ov.zones} onChange={(e) => setOv({ ...ov, zones: e.target.checked })} />
            {t('Zonas de cortesía')}
          </label>
          <label className={ov.intent ? 'on' : ''}>
            <input type="checkbox" disabled={!hasHR} checked={ov.intent} onChange={(e) => setOv({ ...ov, intent: e.target.checked })} />
            {t('Ruta anticipada')}
          </label>
        </div>
      </section>

      {!sim && (
        <section className="panel">
          <h4>{t('Datos')}</h4>
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
        </section>
      )}
      {videoPanel}
    </aside>
  )
}
