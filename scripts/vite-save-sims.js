// Guardado local de simulaciones: plugin del servidor de desarrollo de Vite (`npm run dev`).
//
// Cada simulación hecha en el visor se escribe en una carpeta del proyecto (por defecto `simulaciones/`):
//   simulaciones/
//     motor-0.3.0/
//       matlab-2026/                        ← perfil de modelo (matlab-2026 = réplica validada, hri = extendido)
//         12_ROW3_mixed_RP0_SIM-1a2b3c4d/   ← una carpeta por configuración + parámetros (paramsHash)
//         HUMAN_ONLY_…_timeseries.csv · _poses.csv · _meta.json
//         HUMAN_ROBOT_…_timeseries.csv · _poses.csv · _meta.json
//     indice.csv                            ← una fila por simulación guardada (métricas principales)
//
// El motor es determinista: misma versión + mismos parámetros = mismo resultado, así que una simulación
// que ya existe no se vuelve a escribir.
//
// No guarda nada: en el sitio publicado (build estático, no hay servidor), en `vite preview`, en las pruebas,
// en GitHub Actions (CI=true) ni con HV_SAVE_SIMS=0. Carpeta configurable con HV_SIM_DIR.
import fs from 'node:fs'
import path from 'node:path'

export const SAVE_ROUTE = '/__hv/save-sim'
const MAX_BODY = 300 * 1024 * 1024 // 2 corridas de 48 trabajadores y 4 h caben holgadas
const safe = (s) =>
  String(s)
    .replace(/[^A-Za-z0-9_.-]/g, '_')
    .replace(/^\.+/, '_') // sin «..» ni archivos ocultos
    .slice(0, 160)

export function saveEnabled(env = process.env) {
  return env.CI !== 'true' && env.GITHUB_ACTIONS !== 'true' && env.HV_SAVE_SIMS !== '0'
}

const INDEX_HEAD = [
  'fecha',
  'motor',
  'carpeta',
  'trabajadores',
  'fila',
  'actividad',
  'disposicion',
  'duracion_s',
  'paramsHash',
  'HO_cosecha_total_u',
  'HO_carga_total_kcal',
  'HR_cosecha_total_u',
  'HR_carga_total_kcal',
  'HR_entregado_zona_u',
  'HR_entregas_robot',
  'perfil',
]
// métricas de fluidez y seguridad (fase 2): vienen ya calculadas desde el visor (fluencyIndex en src/workload/hri.js)
export const FLUENCY_COLS = [
  'HR_robot_mov_pct',
  'HR_robot_espera_pct',
  'HR_robot_detenido_pct',
  'HR_robot_parada_seg_pct',
  'HR_robot_lento_pct',
  'HR_paradas_seg',
  'HR_espera_robot_s',
  'HR_espera_caja_media_s',
  'HR_espera_caja_p90_s',
  'HR_atencion_media_s',
  'HR_jain_espera',
  'HR_jain_atencion',
  'HR_dentro_Sp_s',
  'HR_eventos_Sp',
  'HR_dist_min_m',
  'HR_dist_p5_mov_m',
]
INDEX_HEAD.push(...FLUENCY_COLS)

/** Escribe una simulación (HO + HR) en `root`. Devuelve { dir, existed }. Exportada para pruebas. */
export function writeSimulation(root, body, now = new Date()) {
  const { meta, files, summary = {} } = body || {}
  if (!meta || !Array.isArray(files) || !files.length) throw new Error('Simulación sin archivos')
  const ver = `motor-${safe(meta.engineVersion || 'desconocido')}`
  const profile = safe(meta.profile || 'matlab-2026')
  const name = safe(`${meta.nw}_ROW${meta.row}_${meta.act}_RP${meta.rp}_SIM-${meta.paramsHash}`)
  const dir = path.join(root, ver, profile, name)
  const existed = fs.existsSync(path.join(dir, '.completo'))
  if (!existed) {
    fs.mkdirSync(dir, { recursive: true })
    for (const [file, text] of files) {
      const f = safe(file)
      if (!/\.(csv|json)$/.test(f)) continue
      fs.writeFileSync(path.join(dir, f), String(text))
    }
    fs.writeFileSync(path.join(dir, '.completo'), now.toISOString() + '\n')
    const idx = path.join(root, 'indice.csv')
    const head = INDEX_HEAD.join(',')
    if (!fs.existsSync(idx)) fs.writeFileSync(idx, head + '\n')
    else {
      // índice de una versión anterior (columnas de menos): se actualiza la cabecera; las filas viejas quedan sin perfil
      const text = fs.readFileSync(idx, 'utf8'),
        nl = text.indexOf('\n')
      if (text.slice(0, nl) !== head) fs.writeFileSync(idx, head + text.slice(nl))
    }
    const ho = summary.ho || {},
      hr = summary.hr || {}
    const row = [
      now.toISOString(),
      meta.engineVersion,
      path.posix.join(ver, profile, name),
      meta.nw,
      meta.row,
      meta.act,
      meta.rp,
      meta.duration ?? '',
      meta.paramsHash,
      ho.TotalRecollectedCrops ?? '',
      ho.TotalHumanWorkload ?? '',
      hr.TotalRecollectedCrops ?? '',
      hr.TotalHumanWorkload ?? '',
      hr.TotalProductionCargoZone ?? '',
      hr.handoffs ?? '',
      profile,
      ...FLUENCY_COLS.map((c) => hr[c] ?? ''),
    ]
    fs.appendFileSync(idx, row.join(',') + '\n')
  }
  return { dir: path.relative(process.cwd(), dir).split(path.sep).join('/'), existed }
}

/** Plugin de Vite: solo activo en el servidor de desarrollo. */
export function saveSimsPlugin({ dir = process.env.HV_SIM_DIR || 'simulaciones' } = {}) {
  const enabled = saveEnabled()
  return {
    name: 'hv-save-sims',
    apply: 'serve',
    configureServer(server) {
      if (!enabled) return
      const root = path.resolve(server.config.root, dir)
      server.middlewares.use(SAVE_ROUTE, (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        let size = 0
        const chunks = []
        req.on('data', (c) => {
          size += c.length
          if (size > MAX_BODY) req.destroy()
          else chunks.push(c)
        })
        req.on('end', () => {
          try {
            const out = writeSimulation(root, JSON.parse(Buffer.concat(chunks).toString('utf8')))
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(out))
          } catch (e) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: String(e.message || e) }))
          }
        })
      })
      server.config.logger.info(`  ➜  Simulaciones: se guardan en ${path.relative(server.config.root, root) || '.'}/`)
    },
  }
}
