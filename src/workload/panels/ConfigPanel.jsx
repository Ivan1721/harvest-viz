import { useRef } from 'react'
import { ACTS } from '../library.js'
import { SimPanel } from './SimPanel.jsx'
import { ACT_LABEL } from '../spec.js'
import { Field, Seg } from '../ui.jsx'

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
  const fileRef = useRef()
  const uniq = (k) => [...new Set(lib.map((e) => e[k]))].sort((a, b) => (typeof a === 'number' ? a - b : String(a).localeCompare(String(b))))
  const sim = source === 'sim'
  const acts = sim ? ACTS : ACTS.filter((a) => lib.some((e) => e.act === a))
  const opt = (k, all) => (sim ? all : uniq(k))
  return (
    <aside className="wb-left">
      <section className="panel">
        <h4>Fuente</h4>
        <Seg
          value={source}
          onChange={setSource}
          options={[
            ['data', 'Datos MATLAB'],
            ['sim', 'Simulador'],
          ]}
        />
      </section>

      <section className="panel">
        <h4>Configuración</h4>
        <Field label="Trabajadores">
          <Seg value={cfg?.nw} options={opt('nw', [4, 6, 8, 10, 12, 16, 20]).map((v) => [v, String(v)])} onChange={(v) => pickCfg('nw', v)} />
        </Field>
        <Field label="Fila de cultivo">
          <Seg value={cfg?.row} options={opt('row', [1, 2, 3]).map((v) => [v, String(v)])} onChange={(v) => pickCfg('row', v)} />
        </Field>
        <Field label="Actividad">
          <Seg value={cfg?.act} options={acts.map((a) => [a, ACT_LABEL[a]])} onChange={(v) => pickCfg('act', v)} />
        </Field>
        <Field label="Disposición (RP)">
          <Seg value={cfg?.rp} options={opt('rp', [0, 1]).map((v) => [v, String(v)])} onChange={(v) => pickCfg('rp', v)} />
        </Field>
        {sim ? (
          <div className="note">Cualquier combinación se simula en tu navegador con el modelo de MATLAB.</div>
        ) : (
          <div className="note">
            {lib.length} corrida{lib.length === 1 ? '' : 's'} disponible{lib.length === 1 ? '' : 's'}. Las demás combinaciones se agregan cargando archivos de
            MATLAB o con el simulador.
          </div>
        )}
      </section>

      {sim && <SimPanel {...simProps} />}

      <section className="panel">
        <h4>Vista</h4>
        <Seg
          value={view}
          onChange={setView}
          options={[
            ['ho', 'Solo humano', !hasHO],
            ['hr', 'Humano-robot', !hasHR],
            ['cmp', 'Comparar', !(hasHO && hasHR)],
          ]}
        />
        <Field label="Estilo visual">
          <Seg
            value={look}
            onChange={setLook}
            options={[
              ['real', 'Realista'],
              ['schem', 'Esquemático'],
            ]}
          />
        </Field>
        {look === 'real' && (
          <Field label={`Opacidad del follaje · ${Math.round(canopy * 100)} %`}>
            <input type="range" min="0.15" max="1" step="0.05" value={canopy} onChange={(e) => setCanopy(Number(e.target.value))} style={{ width: '100%' }} />
          </Field>
        )}
        <Field label="Cámara">
          <Seg
            value={preset}
            onChange={setPreset}
            options={[
              ['iso', 'Isométrica'],
              ['top', 'Cenital'],
              ['side', 'Lateral'],
            ]}
          />
        </Field>
        <Field label="Color de los trabajadores">
          <Seg
            value={snap.colorBy}
            onChange={setColorBy}
            options={[
              ['rate', 'Carga metabólica'],
              ['flag', 'Actividad'],
            ]}
          />
        </Field>
        <div className="checks">
          <label className={ov.zones ? 'on' : ''}>
            <input type="checkbox" disabled={!hasHR} checked={ov.zones} onChange={(e) => setOv({ ...ov, zones: e.target.checked })} />
            Zonas de cortesía
          </label>
          <label className={ov.intent ? 'on' : ''}>
            <input type="checkbox" disabled={!hasHR} checked={ov.intent} onChange={(e) => setOv({ ...ov, intent: e.target.checked })} />
            Ruta anticipada
          </label>
        </div>
      </section>

      {!sim && (
        <section className="panel">
          <h4>Datos</h4>
          <button className="btn" onClick={() => fileRef.current.click()}>
            Cargar archivos de MATLAB…
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
            Selecciona el <b>*_timeseries.csv</b> y, para corridas con robot, su <b>*_robot_status_log.txt</b>. Se procesan en tu navegador; no se suben a
            ningún servidor.
          </div>
          {loading && <div className="note">Cargando…</div>}
        </section>
      )}
      {videoPanel}
    </aside>
  )
}
