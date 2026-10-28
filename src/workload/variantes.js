// «Comparar con» (I4): la segunda corrida puede ser sin robot (como siempre), con otro robot, con el otro
// comportamiento del robot o (H8) con otra cantidad de robots, sobre el mismo escenario y la misma cuadrilla.
//
//   cmp = 'sinrobot' | 'robot:<tipo>' | 'perfil' | 'flota:<n>'
import { profileDefaults } from '../hrsim/common.js'
import { FLOTA_MAX } from '../hrsim/flota.js'
import { ROBOTS, capacidadCajas } from '../hrsim/robots.js'

export const CMP_DEFAULT = 'sinrobot'
const FUERA = new Set(['profile', 'ssm', 'fixRecallLoop'])

/** Nombre del comportamiento del robot (perfil), como en el paso Agentes. */
export const comportamiento = (perfil) => (perfil === 'hri' ? 'Con regla de seguridad' : 'Como en MATLAB')
const otroPerfil = (perfil) => (perfil === 'hri' ? 'matlab-2026' : 'hri')

/** ¿Es válido `cmp` para estos parámetros? (otro robot y otra cantidad de robots, solo en huertos generados). */
export function cmpValido(cmp, params) {
  if (cmp === 'sinrobot' || cmp === 'perfil') return true
  if (/^flota:[1-9]$/.test(cmp || '')) return Number(cmp.slice(6)) <= FLOTA_MAX && !!params.huertoParams
  const m = /^robot:(.+)$/.exec(cmp || '')
  return !!(m && ROBOTS[m[1]] && params.huertoParams)
}

/** Cantidad de robots de una corrida (1 si no hay flota). */
export const robotsDe = (params) => params.flota?.n ?? 1

/** Cantidad de robots de la variante `flota:<n>`: la pedida, o la otra más cercana si coincide con la de la corrida principal. */
export function flotaVariante(cmp, params) {
  const actual = robotsDe(params)
  const pedido = Number(/^flota:(\d)$/.exec(cmp || '')?.[1])
  if (pedido >= 1 && pedido <= FLOTA_MAX && pedido !== actual) return pedido
  return actual === 1 ? 2 : 1
}

/** Nombre de una escena con `n` robots (clave de traducción). */
export const nombreFlota = (n) => `Con ${n} ${n === 1 ? 'robot' : 'robots'}`

/** Robot de la variante: el pedido, o el primero distinto del principal si coinciden. */
export function robotVariante(cmp, params) {
  const pedido = /^robot:(.+)$/.exec(cmp || '')?.[1]
  if (pedido && ROBOTS[pedido] && pedido !== params.robotTipo) return pedido
  return Object.keys(ROBOTS).find((k) => k !== params.robotTipo)
}

/**
 * Parámetros y nombres de la variante. Devuelve null si se compara con «sin robot».
 * Otro comportamiento: los valores de partida del otro perfil más lo que el usuario haya modificado.
 */
export function variante(cmp, params) {
  if (!cmpValido(cmp, params) || cmp === 'sinrobot') return null
  if (cmp.startsWith('flota:')) {
    // otra cantidad de robots: la misma estrategia (con 1 robot no hay flota) sobre el mismo escenario
    const n = flotaVariante(cmp, params),
      v = { ...params }
    if (n === 1) delete v.flota
    else v.flota = { ...params.flota, n, estrategia: params.flota?.estrategia ?? 'zonas' }
    return { params: v, labels: { ho: nombreFlota(n), hr: nombreFlota(robotsDe(params)) } }
  }
  if (cmp === 'perfil') {
    const otro = otroPerfil(params.profile)
    const base = profileDefaults(params.profile, params.huerto, params.robotTipo)
    const v = profileDefaults(otro, params.huerto, params.robotTipo)
    for (const k of Object.keys(params)) if (!FUERA.has(k) && JSON.stringify(params[k]) !== JSON.stringify(base[k])) v[k] = structuredClone(params[k])
    return { params: v, labels: { ho: comportamiento(otro), hr: comportamiento(params.profile) } }
  }
  const r = robotVariante(cmp, params)
  return {
    params: { ...params, robotTipo: r, capacityBoxes: capacidadCajas(r, params.maxProd), energia: { ...ROBOTS[r].energia } },
    labels: { ho: ROBOTS[r].label, hr: ROBOTS[params.robotTipo]?.label ?? 'Warthog' },
  }
}
