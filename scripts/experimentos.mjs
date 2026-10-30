// Experimentos en lote (H6): corre todas las celdas de un diseño en paralelo y escribe sus resultados.
//
// uso: npm run experimentos -- experimentos/h6.json [--hilos 4] [--limite 20]
//
// Escribe junto al diseño, en experimentos/<nombre>/:
//   corridas.csv    una fila por corrida terminada (se agrega a medida que terminan: sirve de caché)
//   resultados.csv  las corridas del diseño + el efecto de cada robot contra su corrida sin robot (y, con flota, contra 1 robot)
//   resumen.csv     si el diseño tiene repeticiones: una fila por celda, con la media y el rango de sus semillas
// El motor es determinista: una corrida con la misma clave (versión del motor + parámetros) no se repite.
// Es para el PC: en GitHub Actions no corre.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Worker, isMainThread, parentPort } from 'node:worker_threads'
import { COLS, EFECTO_COLS, RESUMEN_COLS, aCSV, celdas, clave, conEfectos, correr, deCSV, resumen } from './experimentos/lib.mjs'

const FIS_PATH = new URL('../src/hrsim/goal_seeking.fis', import.meta.url)

if (!isMainThread) {
  const fis = fs.readFileSync(FIS_PATH, 'utf8')
  parentPort.on('message', (c) => {
    try {
      parentPort.postMessage({ ok: true, fila: correr(c, fis) })
    } catch (e) {
      parentPort.postMessage({ ok: false, error: `${e.message}\n${e.stack}`, celda: c })
    }
  })
} else await main()

async function main() {
  const args = process.argv.slice(2)
  const opt = (k, d) => {
    const i = args.indexOf(`--${k}`)
    return i >= 0 ? args[i + 1] : d
  }
  const archivo = args.find((a) => a.endsWith('.json'))
  if (!archivo) {
    console.error('uso: npm run experimentos -- experimentos/<diseño>.json [--hilos N] [--limite N]')
    process.exit(1)
  }
  const diseño = JSON.parse(fs.readFileSync(archivo, 'utf8'))
  const dir = path.join(path.dirname(archivo), diseño.nombre)
  fs.mkdirSync(dir, { recursive: true })
  const fCorridas = path.join(dir, 'corridas.csv')

  const todas = diseño.bloques.flatMap(celdas).map((c) => ({ c, k: clave(c) }))
  // celdas con la misma clave (p. ej. pendiente 0 con el acopio arriba o abajo) se corren una vez
  const hechas = new Map(fs.existsSync(fCorridas) ? deCSV(fs.readFileSync(fCorridas, 'utf8')).map((f) => [f.clave, f]) : [])
  const pendientes = [...new Map(todas.filter(({ k }) => !hechas.has(k)).map((x) => [x.k, x.c])).values()]
  // las largas primero: reparte mejor la carga entre hilos
  pendientes.sort((a, b) => b.duration * b.nw - a.duration * a.nw)
  const limite = Number(opt('limite', Infinity))
  const cola = pendientes.slice(0, limite)
  const total = cola.length
  const hilos = Math.max(1, Math.min(Number(opt('hilos', os.availableParallelism?.() ?? os.cpus().length)), cola.length || 1))
  console.log(`${diseño.nombre}: ${todas.length} celdas · ${hechas.size} corridas ya hechas · ${cola.length} por correr en ${hilos} hilos`)

  // una caché con otras columnas (de una versión anterior de este script) se reescribe con las de ahora antes de agregarle filas
  if (!fs.existsSync(fCorridas) || fs.readFileSync(fCorridas, 'utf8').split('\n', 1)[0].trim() !== COLS.join(','))
    fs.writeFileSync(fCorridas, hechas.size ? aCSV([...hechas.values()], COLS) : COLS.join(',') + '\n')
  const t0 = Date.now()
  let n = 0,
    errores = 0
  await new Promise((resolve) => {
    if (!cola.length) return resolve()
    let activos = 0
    for (let i = 0; i < hilos; i++) {
      const w = new Worker(new URL(import.meta.url))
      activos++
      const siguiente = () => {
        const c = cola.shift()
        if (c) w.postMessage(c)
        else w.terminate().then(() => --activos === 0 && resolve())
      }
      w.on('message', (m) => {
        n++
        if (m.ok) {
          hechas.set(m.fila.clave, m.fila)
          fs.appendFileSync(fCorridas, aCSV([m.fila], COLS).split('\n')[1] + '\n')
        } else {
          errores++
          console.error(`\nerror en ${JSON.stringify(m.celda)}:\n${m.error}`)
        }
        const s = (Date.now() - t0) / 1000
        process.stdout.write(`\r${n}/${total} · ${s.toFixed(0)} s`)
        siguiente()
      })
      w.on('error', (e) => {
        console.error(e)
        errores++
        siguiente()
      })
      siguiente()
    }
  })
  console.log(`\n${n} corridas en ${((Date.now() - t0) / 1000).toFixed(0)} s${errores ? ` · ${errores} con error` : ''}`)

  // resultados: una fila por celda del diseño (con sus claves de diseño), más el efecto contra «sin robot»
  const filas = todas.filter(({ k }) => hechas.has(k)).map(({ c, k }) => ({ ...hechas.get(k), bloque: c.bloque, clave: k }))
  const cols = [...COLS, ...EFECTO_COLS]
  const conE = conEfectos(filas)
  fs.writeFileSync(path.join(dir, 'resultados.csv'), aCSV(conE, cols))
  console.log(`${filas.length}/${todas.length} celdas en ${path.join(dir, 'resultados.csv')}`)
  if (diseño.bloques.some((b) => b.repeticiones)) {
    const res = resumen(conE)
    fs.writeFileSync(path.join(dir, 'resumen.csv'), aCSV(res, RESUMEN_COLS))
    console.log(`${res.length} celdas con su rango de semillas en ${path.join(dir, 'resumen.csv')}`)
  }
  if (errores) process.exitCode = 1
}
