import { Suspense, lazy, useState } from 'react'
import { ErrorBoundary } from './shared/ErrorBoundary.jsx'
import { LANGS, setLang, t, useLang } from './i18n/index.js'

// cada modo se descarga solo cuando se abre (code splitting)
const OcclusionApp = lazy(() => import('./OcclusionApp.jsx'))
const WorkloadApp = lazy(() => import('./workload/WorkloadApp.jsx'))

/** Selector de idioma: se recuerda en el navegador y también acepta ?lang=es|en|pt. */
export function LangSwitch() {
  const lang = useLang()
  return (
    <div className="seg modes lang" role="group" aria-label={t('Idioma')}>
      {Object.entries(LANGS).map(([k, v]) => (
        <button key={k} className={lang === k ? 'on' : ''} aria-pressed={lang === k} title={v.label} lang={k} onClick={() => setLang(k)}>
          {v.short}
        </button>
      ))}
    </div>
  )
}

function ModeSwitch({ mode, setMode }) {
  useLang()
  return (
    <div className="seg modes">
      <button className={mode === 'workload' ? 'on' : ''} onClick={() => setMode('workload')}>
        Workload
      </button>
      <button className={mode === 'occlusion' ? 'on' : ''} onClick={() => setMode('occlusion')}>
        {t('Oclusión')}
      </button>
    </div>
  )
}

export default function App() {
  useLang() // al cambiar de idioma se vuelve a dibujar toda la interfaz
  const [mode, setMode] = useState(() => {
    try {
      return ['workload', 'occlusion'].includes(localStorage.getItem('hv-mode')) ? localStorage.getItem('hv-mode') : 'workload'
    } catch {
      return 'workload'
    }
  })
  const change = (m) => {
    setMode(m)
    try {
      localStorage.setItem('hv-mode', m)
    } catch {
      /* sin almacenamiento: se usa el modo por defecto */
    }
  }
  const sw = (
    <>
      <ModeSwitch mode={mode} setMode={change} />
      <LangSwitch />
    </>
  )
  return (
    <ErrorBoundary label={t('la aplicación')} resetKey={mode}>
      <Suspense fallback={<div className="loading-mode">{t('Cargando…')}</div>}>
        {mode === 'workload' ? <WorkloadApp modeSwitch={sw} /> : <OcclusionApp modeSwitch={sw} />}
      </Suspense>
    </ErrorBoundary>
  )
}
