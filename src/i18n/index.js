// Idiomas de la interfaz. El texto en español del código es la clave: t('Simular') devuelve la traducción del
// idioma activo o, si falta, el mismo español. Así una traducción incompleta nunca rompe nada.
//
// Uso:
//   en componentes: const lang = useLang()  (re-renderiza al cambiar de idioma) y luego t('Texto', { var })
//   fuera de React (motor de oclusión, grabador de video): t() lee el idioma activo en ese momento
//   números: fmtNum(v, { maximumFractionDigits: 1 }) con el formato regional del idioma
// Agregar un idioma: un diccionario en src/i18n/<código>/ y una entrada en LANGS.
import { useSyncExternalStore } from 'react'
import en from './en/index.js'
import pt from './pt/index.js'

export const LANGS = {
  es: { label: 'Español', short: 'ES', locale: 'es-CL' },
  en: { label: 'English', short: 'EN', locale: 'en-US' },
  pt: { label: 'Português', short: 'PT', locale: 'pt-BR' },
}
const DICTS = { es: null, en, pt }
const KEY = 'hv-lang'

function initial() {
  try {
    const q = new URLSearchParams(window.location.search).get('lang')
    if (LANGS[q]) return q
    const saved = window.localStorage.getItem(KEY)
    if (LANGS[saved]) return saved
  } catch {
    /* sin ventana o sin almacenamiento (pruebas en Node) */
  }
  return 'es'
}

let lang = typeof window === 'undefined' ? 'es' : initial()
const listeners = new Set()

export const getLang = () => lang
export const locale = () => LANGS[lang].locale

export function setLang(l) {
  if (!LANGS[l] || l === lang) return
  lang = l
  try {
    window.localStorage.setItem(KEY, l)
    document.documentElement.lang = l
  } catch {
    /* sin almacenamiento: el idioma dura hasta recargar */
  }
  listeners.forEach((fn) => fn())
}

/** Traduce un texto en español al idioma activo; {nombre} se reemplaza con vars.nombre. */
export function t(s, vars) {
  const d = DICTS[lang]
  let out = (d && d[s]) || s
  if (vars) out = out.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? String(vars[k]) : m))
  return out
}

/** Número con el formato regional del idioma activo. */
export const fmtNum = (v, opts) => Number(v).toLocaleString(locale(), opts)
/** Número con `d` decimales fijos, en el formato del idioma (en vez de toFixed, que siempre usa punto). */
export const fmtFix = (v, d) => fmtNum(v, { minimumFractionDigits: d, maximumFractionDigits: d })
/** Duración con una sola regla: «48 s» bajo un minuto, «12,5 min» bajo una hora, «2 h 05 min» desde ahí. */
export function fmtDur(s) {
  if (!Number.isFinite(s)) return '—'
  if (Math.round(s) < 60) return `${fmtNum(Math.round(s))} s`
  if (Math.round(s / 6) < 600) return `${fmtNum(Math.round(s / 6) / 10, { maximumFractionDigits: 1 })} min`
  const m = Math.round(s / 60)
  return `${fmtNum(Math.floor(m / 60))} h ${String(m % 60).padStart(2, '0')} min`
}

export const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
/** Idioma activo; el componente se vuelve a dibujar cuando cambia. */
export const useLang = () => useSyncExternalStore(subscribe, getLang, getLang)
