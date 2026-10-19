// Guarda en la carpeta local del proyecto la simulación recién hecha (solo con `npm run dev`; ver scripts/vite-save-sims.js).
// En el sitio publicado y en CI la constante es false y esta función no hace nada.
/* global __HV_SAVE_SIMS__ */
import { runFiles } from '../hrsim/export.js'
import { fluencyIndex } from './hri.js'

export const SAVE_ENABLED = typeof __HV_SAVE_SIMS__ !== 'undefined' && __HV_SAVE_SIMS__

/** Devuelve { dir, existed } o null (desactivado o error: nunca interrumpe la simulación). */
export async function saveSimulation(ho, hr) {
  if (!SAVE_ENABLED || !ho || !hr) return null
  try {
    const m = hr.meta
    const body = {
      meta: {
        profile: m.params?.profile ?? 'matlab-2026',
        nw: m.nw,
        row: m.row,
        act: m.act,
        rp: m.rp,
        engineVersion: m.engineVersion,
        paramsHash: m.paramsHash,
        duration: m.params?.duration,
      },
      summary: { ho: ho.summary, hr: { ...hr.summary, ...fluencyIndex(hr.hri) } },
      files: [...runFiles(ho), ...runFiles(hr)],
    }
    const r = await fetch('/__hv/save-sim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return r.ok ? await r.json() : null
  } catch {
    return null
  }
}
