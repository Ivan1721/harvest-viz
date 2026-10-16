// Reloj de reproducción del modo Workload.
// `play` es mutable a propósito: la escena 3D lo lee y avanza en cada frame sin provocar renders de React.
// La interfaz no lo lee directo: usa `usePlayback()`, que recibe una instantánea cuando algo cambia
// (inmediato con setPlay, y a lo sumo ~5 veces por segundo mientras corre la reproducción).
import { useEffect, useState } from 'react'

export const play = { t: 0, playing: true, speed: 10, colorBy: 'rate', selected: null, zones: false, intent: false, driver: null, tEnd: 0, canopy: { v: 0.42 } }
export const anim = { t: 0 }

const listeners = new Set()
const snapshot = () => ({ t: play.t, playing: play.playing, speed: play.speed, colorBy: play.colorBy, sel: play.selected })
let last = snapshot(), lastEmit = 0

function emit(force) {
  const s = snapshot()
  if (!force && s.t === last.t && s.playing === last.playing && s.speed === last.speed && s.colorBy === last.colorBy && s.sel === last.sel) return
  last = s
  listeners.forEach((fn) => fn(s))
}

/** Cambia el estado de reproducción y avisa a la interfaz de inmediato. */
export function setPlay(patch) { Object.assign(play, patch); emit(true) }

/** Avance de un frame (lo llama la escena). Devuelve true si el reloj avanzó. */
export function advance(run, dtReal) {
  if (!play.playing || !run || play.driver !== run.name) return false
  const d = Math.min(dtReal, 0.05)
  anim.t += d
  play.t = Math.min(play.tEnd, play.t + d * play.speed)
  if (play.t >= play.tEnd) play.playing = false
  const now = performance.now()
  if (now - lastEmit > 200 || !play.playing) { lastEmit = now; emit(false) }
  return true
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) }

/** Instantánea del reloj para componentes de React. */
export function usePlayback() {
  const [s, set] = useState(snapshot)
  useEffect(() => subscribe(set), [])
  return s
}
