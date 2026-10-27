// ui-p1: «Simular» siempre a la vista, Ctrl+Enter y aviso completo de resultados desactualizados.
import { test, expect } from '@playwright/test'
import { openWorkload, pause } from './helpers.js'

test('Ctrl+Enter: cambiar cosecheros marca el paso, el aviso los nombra, la escena se atenúa y el atajo simula (ui-p1)', async ({ page }) => {
  const errors = await openWorkload(page, { mode: 'sim' })
  await expect(page.getByTestId('sim-estado')).toHaveText('Resultados al día.')
  const done = Number(await page.locator('.wb').getAttribute('data-sim-done'))
  await page.getByTestId('step-agentes').getByRole('button', { name: '16', exact: true }).click()
  await expect(page.locator('#step-2 .step-dot')).toBeAttached()
  await expect(page.getByTestId('stale')).toContainText('Cambió: Cosecheros.')
  await expect(page.getByTestId('stale-derecha')).toContainText('Cosecheros')
  await expect(page.getByTestId('sim-estado')).toHaveText('Hay 1 cambio sin simular: Cosecheros.')
  await expect(page.getByTestId('sim-run')).toHaveClass(/primary/)
  await expect(page.getByTestId('wb-views')).toHaveClass(/viejo/)
  await page.keyboard.press('Control+Enter')
  await page.waitForFunction((b) => Number(document.querySelector('.wb')?.dataset.simDone) > b, done, { timeout: 60_000 })
  await pause(page)
  await expect(page.getByText(/^16 trabajadores · Fila 3/)).toBeVisible()
  await expect(page.getByTestId('stale')).toHaveCount(0)
  await expect(page.getByTestId('wb-views')).not.toHaveClass(/viejo/)
  await expect(page.getByTestId('sim-estado')).toHaveText('Resultados al día.')
  // «Restablecer» del paso 2 devuelve también los cosecheros
  await page.getByTestId('reset-2').click()
  await expect(page.getByTestId('stale')).toContainText('Cosecheros')
  expect(errors).toEqual([])
})

test('«Simular» a la vista en 1.280 × 720 y posiciones exactas en Interacción (ui-p1)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const errors = await openWorkload(page, { mode: 'sim' })
  await expect(page.getByTestId('sim-run')).toBeInViewport({ ratio: 1 })
  await page.getByRole('tab', { name: 'Interacción' }).click()
  await expect(page.getByTestId('nota-posiciones')).toHaveText('Posiciones exactas: el simulador registra la pose de cada agente cada 0,25 s.')
  await page.getByRole('tab', { name: 'Datos' }).click()
  await expect(page.getByTestId('nota-posiciones')).toContainText('Posiciones exactas')
  expect(errors).toEqual([])
})
