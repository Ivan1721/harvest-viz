// Regresión visual: capturas comparadas con las de referencia (e2e/__screenshots__).
// Solo corre con VISUAL=1 (el texto y WebGL varían entre máquinas): npm run test:visual
// Para aceptar un cambio visual intencional: npm run test:visual -- --update-snapshots
import { test, expect } from '@playwright/test'
import { openWorkload, useSimulator, pause, setRange } from './helpers.js'

test.skip(!process.env.VISUAL, 'regresión visual desactivada (VISUAL=1 para activarla)')

async function freezeAt(page, seconds) {
  await pause(page)
  await setRange(page.locator('.timeline2 input[type=range]'), seconds)
  await page.waitForTimeout(1500) // deja que la escena dibuje el nuevo instante
}

test('panel de resumen con gráficos (datos MATLAB)', async ({ page }) => {
  await openWorkload(page)
  await freezeAt(page, 1350)
  await expect(page.locator('.wb-right')).toHaveScreenshot('resumen.png')
})

test('escena 3D Humano-robot en un instante fijo', async ({ page }) => {
  await openWorkload(page)
  await page.getByRole('button', { name: 'Humano-robot' }).click()
  await freezeAt(page, 900)
  await expect(page.locator('.wb-stage')).toHaveScreenshot('escena-hr.png', { maxDiffPixelRatio: 0.05 })
})

test('pestaña de validación del simulador', async ({ page }) => {
  await openWorkload(page)
  await useSimulator(page)
  await page.getByRole('button', { name: 'Validación' }).click()
  await expect(page.locator('.wb-right')).toHaveScreenshot('validacion.png')
})
