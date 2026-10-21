import { useEffect, useRef } from 'react'
import { Field, Seg } from '../ui.jsx'
import { t, useLang } from '../../i18n/index.js'

/**
 * Barra sobre la escena: qué se ve y cómo. No cambia la simulación, por eso no está en los pasos de la izquierda.
 * Lo frecuente (qué corrida, cámara) queda a la vista; estilo, follaje, color y capas, en «Capas y estilo».
 */
export function ViewBar({ view, setView, hasHO, hasHR, labels, preset, setPreset, look, setLook, canopy, setCanopy, colorBy, setColorBy, ov, setOv }) {
  useLang()
  const pop = useRef()
  // el menú se cierra al hacer clic fuera o con Escape
  useEffect(() => {
    const close = (e) => {
      const d = pop.current
      if (d?.open && (e.key === 'Escape' || (e.type === 'pointerdown' && !d.contains(e.target)))) d.open = false
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', close)
    }
  }, [])
  return (
    <div className="wb-viewbar" role="toolbar" aria-label={t('Vista')}>
      <Seg
        size="mini"
        label={t('Corrida mostrada')}
        value={view}
        onChange={setView}
        options={[
          ['ho', labels?.ho ?? t('Solo humano'), !hasHO],
          ['hr', labels?.hr ?? t('Humano-robot'), !hasHR],
          ['cmp', t('Comparar'), !(hasHO && hasHR)],
        ]}
      />
      <Seg
        size="mini"
        label={t('Cámara')}
        value={preset}
        onChange={setPreset}
        options={[
          ['iso', t('Isométrica')],
          ['top', t('Cenital')],
          ['side', t('Lateral')],
        ]}
      />
      <details className="pop" ref={pop}>
        <summary className="btn">{t('Capas y estilo')}</summary>
        <div className="pop-body panel">
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
          <Field label={t('Color de los trabajadores')}>
            <Seg
              value={colorBy}
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
        </div>
      </details>
    </div>
  )
}

/** Franja sobre la escena y los resultados cuando lo configurado ya no es lo que se simuló. */
export function StaleBanner({ onRun, busy, text }) {
  useLang()
  return (
    <div className="stale" role="status" data-testid="stale">
      <span>{text ?? t('Resultados de la configuración anterior.')}</span>
      <button className="btn primary" onClick={onRun} disabled={busy}>
        {t('Simular')}
      </button>
    </div>
  )
}
