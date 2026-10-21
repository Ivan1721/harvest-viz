// «Comparar con» (I4): la segunda corrida puede ser sin robot (como siempre), con otro robot o con el otro
// comportamiento del robot, sobre el mismo escenario y la misma cuadrilla.
//
//   cmp = 'sinrobot' | 'robot:<tipo>' | 'perfil'
import { profileDefaults } from '../hrsim/common.js'
import { ROBOTS, capacidadCajas } from '../hrsim/robots.js'

export const CMP_DEFAULT = 'sinrobot'
const FUERA = new Set(['profile', 'ssm', 'fixRecallLoop'])

/** Nombre del comportamiento del robot (perfil), como en el paso Agentes. */
export const comportamiento = (perfil) => (perfil === 'hri' ? 'Con regla de seguridad' : 'Como en MATLAB')
const otroPerfil = (perfil) => (perfil === 'hri' ? 'matlab-2026' : 'hri')

/** ¿Es válido `cmp` para estos parámetros? (otro robot solo en huertos generados). */
export function cmpValido(cmp, params) {
  if (cmp === 'sinrobot' || cmp === 'perfil') return true
  const m = /^robot:(.+)$/.exec(cmp || '')
  return !!(m && ROBOTS[m[1]] && params.huertoParams)
}

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
