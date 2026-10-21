// Enlace reproducible (I2): la URL guarda el escenario, los agentes y la duración de la corrida que se ve.
// Como el motor es determinista, abrir el enlace reproduce exactamente esa corrida.
//
//   ?modo=sim&huerto=palta-alta-densidad&nw=12&act=mixed&robot=burro&perfil=hri&dur=2700&cmp=robot:warthog&ajustes=<base64url>
//
// Las claves legibles cubren lo que se elige con botones; `ajustes` lleva solo los parámetros que difieren de los
// valores de partida del perfil, el huerto y el robot (JSON en base64url). Se ignoran las demás claves de la URL
// (?look, ?speed, ?lang, ?view…), que siguen siendo de cada lector.
import { profileDefaults, PROFILES } from '../hrsim/common.js'
import { SISTEMAS } from '../hrsim/huertos/index.js'
import { ROBOTS } from '../hrsim/robots.js'

const ACTS = ['ground', 'ladder', 'picker', 'mixed']
const LEGIBLES = ['huerto', 'nw', 'act', 'row', 'rp', 'robot', 'perfil', 'dur', 'cmp', 'ajustes']
// parámetros que viajan en claves legibles (o que se derivan de ellas) y no en `ajustes`
const FUERA = new Set(['profile', 'huerto', 'robotTipo', 'duration'])

const b64url = {
  enc: (s) => {
    const bytes = new TextEncoder().encode(s)
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  },
  dec: (s) => {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
  },
}

/** Diferencias de `p` respecto de `base` (objetos anidados: solo sus claves cambiadas). */
function diff(p, base) {
  const out = {}
  for (const k of Object.keys(p)) {
    if (FUERA.has(k)) continue
    const a = p[k],
      b = base[k]
    if (JSON.stringify(a) === JSON.stringify(b)) continue
    if (a && typeof a === 'object' && b && typeof b === 'object' && !Array.isArray(a)) {
      const d = {}
      for (const kk of Object.keys(a)) if (JSON.stringify(a[kk]) !== JSON.stringify(b[kk])) d[kk] = a[kk]
      out[k] = d
    } else out[k] = a
  }
  return out
}

/** Escribe en `search` (URLSearchParams, se modifica) los parámetros y la configuración de una corrida. */
export function writeRunState(search, params, cfg, cmp = 'sinrobot') {
  for (const k of LEGIBLES) search.delete(k)
  search.set('huerto', params.huerto)
  search.set('nw', String(cfg.nw))
  search.set('act', cfg.act)
  if (params.huerto === 'matlab-2026') {
    search.set('row', String(cfg.row))
    search.set('rp', String(cfg.rp))
  }
  if (params.robotTipo) search.set('robot', params.robotTipo)
  search.set('perfil', params.profile)
  search.set('dur', String(params.duration))
  if (cmp && cmp !== 'sinrobot') search.set('cmp', cmp)
  const d = diff(params, profileDefaults(params.profile, params.huerto, params.robotTipo))
  if (Object.keys(d).length) search.set('ajustes', b64url.enc(JSON.stringify(d)))
  return search
}

const int = (v, ok) => {
  const n = Number(v)
  return Number.isInteger(n) && ok(n) ? n : undefined
}

/**
 * Lee una corrida de `search`. Devuelve { params, cfg } o null si la URL no describe una corrida
 * (sin ?huerto ni ?perfil). Valores inválidos se ignoran y quedan los de partida; `error` dice cuáles.
 */
export function readRunState(search, cfg0) {
  if (!search.has('huerto') && !search.has('perfil')) return null
  const malos = []
  const pick = (k, ok) => {
    const v = search.get(k)
    if (v == null) return undefined
    if (ok(v)) return v
    malos.push(k)
    return undefined
  }
  const huerto = pick('huerto', (v) => v in SISTEMAS) ?? 'matlab-2026'
  const perfil = pick('perfil', (v) => v in PROFILES) ?? 'matlab-2026'
  const robot = pick('robot', (v) => v in ROBOTS)
  const params = profileDefaults(perfil, huerto, robot)
  const dur = search.has('dur') ? int(search.get('dur'), (n) => n > 0 && n <= 14400) : undefined
  if (search.has('dur') && dur === undefined) malos.push('dur')
  if (dur !== undefined) params.duration = dur
  if (search.has('ajustes')) {
    try {
      const d = JSON.parse(b64url.dec(search.get('ajustes')))
      for (const [k, v] of Object.entries(d)) {
        if (FUERA.has(k) || !(k in params)) continue
        params[k] = v && typeof v === 'object' && !Array.isArray(v) && params[k] && typeof params[k] === 'object' ? { ...params[k], ...v } : v
      }
    } catch {
      malos.push('ajustes')
    }
  }
  const cfg = { ...cfg0 }
  for (const [k, ok] of [
    ['nw', (n) => n >= 1 && n <= 48],
    ['row', (n) => n >= 1 && n <= 3],
    ['rp', (n) => n === 0 || n === 1],
  ])
    if (search.has(k)) {
      const n = int(search.get(k), ok)
      if (n === undefined) malos.push(k)
      else cfg[k] = n
    }
  const act = pick('act', (v) => ACTS.includes(v))
  if (act) cfg.act = act
  // «Comparar con» (I4): sinrobot | perfil | robot:<tipo>
  const cmp = pick('cmp', (v) => v === 'sinrobot' || v === 'perfil' || (/^robot:/.test(v) && v.slice(6) in ROBOTS)) ?? 'sinrobot'
  return { params, cfg, cmp, error: malos.length ? malos : null }
}
