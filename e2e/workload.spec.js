import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { unzipSync, strFromU8 } from 'fflate'

async function exportZip(page) {
  const dl = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar corridas' }).click()
  const d = await dl
  expect(d.suggestedFilename()).toMatch(/^harvest-viz_12_ROW3_mixed_RP0_SIM-[0-9a-f]{8}\.zip$/)
  return unzipSync(fs.readFileSync(await d.path()))
}
import { openWorkload, useSimulator, play, pause, setRange } from './helpers.js'

test('carga las corridas de MATLAB incluidas sin errores', async ({ page }) => {
  const errors = await openWorkload(page)
  await expect(page.getByText(/12 trabajadores · Fila 3 · Mixta · Disposición 0/)).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(2) // Solo humano y Humano-robot
  await expect(page.getByText('Comparación')).toBeVisible()
  expect(errors).toEqual([])
})

test('la línea de tiempo avanza, se pausa y se puede mover', async ({ page }) => {
  await openWorkload(page)
  const clock = page.locator('.tl-t')
  const t0 = await clock.innerText()
  await play(page)
  await expect(clock).not.toHaveText(t0)
  await pause(page)
  const paused = await clock.innerText()
  await page.waitForTimeout(1000)
  await expect(clock).toHaveText(paused)
  await setRange(page.locator('.timeline2 input[type=range]'), 1350)
  await expect(clock).toHaveText(/^22:30 \//)
})

test('el simulador corre, valida contra MATLAB y exporta', async ({ page }) => {
  const errors = await openWorkload(page)
  await useSimulator(page)
  await page.getByRole('tab', { name: 'Validación' }).click()
  await expect(page.locator('td', { hasText: '✓' })).toHaveCount(16)
  const zip = await exportZip(page)
  const names = Object.keys(zip).sort()
  expect(names).toHaveLength(6) // 3 archivos × (Solo humano + Humano-robot)
  expect(names.filter((n) => n.endsWith('_timeseries.csv'))).toHaveLength(2)
  const meta = JSON.parse(strFromU8(zip[names.find((n) => n.startsWith('HUMAN_ROBOT') && n.endsWith('_meta.json'))]))
  expect(meta.params.nw).toBe(12)
  expect(meta.engineVersion).toMatch(/^\d+\.\d+\.\d+$/)
  expect(meta.summary.TotalProductionCargoZone).toBe(4875)
  expect(errors).toEqual([])
})

test('cambiar un parámetro marca la validación como no comparable', async ({ page }) => {
  await openWorkload(page)
  await useSimulator(page)
  await page.getByTestId('sim-params').click()
  await page.getByLabel('Velocidad de caminata (m/s)').fill('1.2')
  await page.getByRole('button', { name: 'Simular', exact: true }).click()
  await page.getByRole('tab', { name: 'Validación' }).click()
  await expect(page.getByText(/Cambiaste parámetros respecto a MATLAB/)).toBeVisible()
  await page.getByRole('button', { name: 'Restablecer a MATLAB' }).click()
  await expect(page.getByTestId('sim-params')).toHaveText('Parámetros')
})

test('cualquier combinación se puede simular (no solo las que tienen CSV)', async ({ page }) => {
  await openWorkload(page)
  await useSimulator(page)
  await page.getByRole('button', { name: '20', exact: true }).click()
  await page.getByRole('button', { name: 'Gancho', exact: true }).click()
  await expect(page.getByText(/20 trabajadores · Fila 3 · Gancho/)).toBeVisible()
  await expect(page.getByText(/Simulado en \d+ ms/)).toBeVisible()
})

test('una corrida exportada se puede volver a cargar como datos de MATLAB', async ({ page }) => {
  await openWorkload(page)
  await useSimulator(page)
  const zip = await exportZip(page)
  const name = Object.keys(zip).find((n) => n.startsWith('HUMAN_ROBOT') && n.endsWith('_timeseries.csv'))
  await page.getByRole('button', { name: 'Datos MATLAB' }).click()
  await page.locator('input[type=file]').setInputFiles({ name, mimeType: 'text/csv', buffer: Buffer.from(zip[name]) })
  await expect(page.getByText(/corridas disponibles/)).toBeVisible()
  await expect(page.locator('.toast.err')).toHaveCount(0)
})

test('un CSV malformado muestra un error legible y no rompe la página', async ({ page }) => {
  await openWorkload(page)
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'HUMAN_ONLY_4_ROW1_harv_ground_RP0_timeseries.csv', mimeType: 'text/csv', buffer: Buffer.from('Time_s,otra\n0,1\n') })
  await expect(page.locator('.toast.err')).toContainText(/faltan columnas/)
  await expect(page.getByText('Fuente', { exact: true })).toBeVisible()
})

test('pestaña Fluidez: reparto del tiempo del robot y seguridad medida (fase 2)', async ({ page }) => {
  const errors = await openWorkload(page)
  await useSimulator(page)
  await page.getByRole('tab', { name: 'Interacción' }).click()
  await page.getByRole('tab', { name: 'Fluidez' }).click()
  await expect(page.getByText('Esperando al trabajador')).toBeVisible()
  await expect(page.getByText(/dentro de S_p\(v\)/)).toBeVisible()
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT, fullPage: false })
  expect(errors).toEqual([])
})

test('perfil HRI: la regla de seguridad actúa y se ve (fase 3)', async ({ page }) => {
  const errors = await openWorkload(page)
  await useSimulator(page)
  await page.getByRole('button', { name: 'HRI', exact: true }).click()
  await page.getByTestId('sim-run').click()
  await page.getByText(/Simulado en \d+ ms/).waitFor({ timeout: 60_000 })
  await pause(page)
  await expect(page.locator('.ssm-mark').first()).toBeAttached()
  await page.getByRole('tab', { name: 'Interacción' }).click()
  await page.getByRole('tab', { name: 'Fluidez' }).click()
  await expect(page.getByText('Seguridad (ISO/TS 15066, regla activa)')).toBeVisible()
  await expect(page.getByText('Parada de seguridad', { exact: true })).toBeVisible()
  await setRange(page.locator('.timeline2 input[type=range]'), 300)
  if (process.env.SHOT2) await page.screenshot({ path: process.env.SHOT2 })
  expect(errors).toEqual([])
})
