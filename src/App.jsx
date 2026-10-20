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

// modos de la cabecera: Simulador (uso principal), Réplica MATLAB (mapa del estudio, corridas de MATLAB y su
// validación) y Oclusión. Workload ('workload', guardado por versiones anteriores) abre el Simulador.
const MODES = [
  ['sim', 'Simulador'],
  ['replica', 'Réplica MATLAB'],
  ['occlusion', 'Oclusión'],
]
const MODE_KEYS = MODES.map(([k]) => k)

function ModeSwitch({ mode, setMode }) {
  useLang()
  return (
    <div className="seg modes" role="group" aria-label={t('Modo')}>
      {MODES.map(([k, l]) => (
        <button key={k} className={mode === k ? 'on' : ''} aria-pressed={mode === k} onClick={() => setMode(k)}>
          {t(l)}
        </button>
      ))}
    </div>
  )
}

/** ?modo=sim|replica|occlusion manda; si no, el último modo usado. */
function initialMode() {
  try {
    const q = new URLSearchParams(window.location.search).get('modo')
    if (MODE_KEYS.includes(q)) return q
    const saved = localStorage.getItem('hv-mode')
    if (saved === 'workload') return 'sim'
    return MODE_KEYS.includes(saved) ? saved : 'sim'
  } catch {
    return 'sim'
  }
}

export default function App() {
  useLang() // al cambiar de idioma se vuelve a dibujar toda la interfaz
  const [mode, setMode] = useState(initialMode)
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
  const workload = mode !== 'occlusion'
  return (
    <ErrorBoundary label={t('la aplicación')} resetKey={workload ? 'workload' : mode}>
      <Suspense fallback={<div className="loading-mode">{t('Cargando…')}</div>}>
        {workload ? <WorkloadApp modeSwitch={sw} source={mode === 'replica' ? 'data' : 'sim'} /> : <OcclusionApp modeSwitch={sw} />}
      </Suspense>
    </ErrorBoundary>
  )
}
