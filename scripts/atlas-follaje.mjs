// Exporta la plantilla del atlas de racimos de palto a la textura que carga la escena (diseño «Follaje de paltos», etapa B):
// docs/plantillas/palto-racimos.svg → public/texturas/palto-racimos.png, 2048 × 2048 px con transparencia y sin la capa
// «guias». Renderiza con Chrome (Playwright), el mismo motor que dibuja el visor.
// uso: npm run atlas:follaje [-- <entrada.svg> <salida.png>]   (PW_CHROMIUM=<ruta> para usar un Chrome instalado)
/* global document */
import fs from 'node:fs'
import { chromium } from '@playwright/test'

const [, , ENTRADA = 'docs/plantillas/palto-racimos.svg', SALIDA = 'public/texturas/palto-racimos.png'] = process.argv
const LADO = 2048

const svg = fs.readFileSync(ENTRADA, 'utf8').replace(/<\?xml[^>]*>/, '')
const navegador = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const page = await navegador.newPage({ viewport: { width: LADO, height: LADO }, deviceScaleFactor: 1 })
await page.setContent(
  `<!doctype html><style>html,body{margin:0;background:transparent}svg{display:block;width:${LADO}px;height:${LADO}px}#guias{display:none}</style>${svg}`,
)
const guias = await page.evaluate(() => document.querySelectorAll('#guias').length)
await page.screenshot({ path: SALIDA, omitBackground: true, clip: { x: 0, y: 0, width: LADO, height: LADO } })
await navegador.close()
console.log(`${ENTRADA} → ${SALIDA} (${LADO} × ${LADO} px${guias ? '' : '; aviso: la plantilla no tiene capa «guias»'})`)
