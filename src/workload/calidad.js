// Calidad de la escena 3D (R1 del diseño «escena 3D más realista»). «alta» agrega luz de cielo, niebla de distancia,
// sombras suaves, suelo con texturas y oclusión ambiental; «basica» es la escena de siempre. Solo cambia cómo se ve: la
// simulación no cambia. Por defecto, básica si el navegador dibuja WebGL por software (equipos sin GPU, CI).
export const CALIDADES = ['alta', 'basica']
const KEY = 'hv-calidad'

/** ¿El nombre del renderizador WebGL delata que se dibuja por software (sin GPU)? */
export const esSoftware = (renderer) => /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(renderer || '')

/** Nombre del renderizador WebGL de este navegador, o null si no hay WebGL. Crea y libera un contexto de prueba. */
export function rendererWebGL() {
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') || c.getContext('webgl')
    if (!gl) return null
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    const r = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return r
  } catch {
    return null
  }
}

/** Calidad al abrir: ?calidad= manda, luego la elegida antes en este navegador y, si no, la que permite el equipo. */
export function calidadInicial(qs, storage, renderer) {
  const q = qs?.get('calidad')
  if (CALIDADES.includes(q)) return q
  try {
    const s = storage()?.getItem(KEY)
    if (CALIDADES.includes(s)) return s
  } catch {
    /* sin almacenamiento */
  }
  return renderer == null || esSoftware(renderer) ? 'basica' : 'alta'
}

/** Recuerda la calidad elegida (si el navegador deja guardar). */
export function guardarCalidad(storage, c) {
  try {
    storage()?.setItem(KEY, c)
  } catch {
    /* sin almacenamiento: dura hasta recargar */
  }
}

/** Opacidad de partida del follaje: más opaco en alta (decisión 4); el control la sigue ajustando. */
export const opacidadInicial = (c) => (c === 'alta' ? 0.8 : 0.42)
