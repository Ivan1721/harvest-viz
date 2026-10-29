// H8, fase B: la flota de robots en la interfaz.
import { test, expect } from '@playwright/test'
import { openWorkload, simulate } from './helpers.js'

test('flota (H8-B): 2 robots desde el enlace, en la escena, la lista y la pestaña Robot; «Comparar con» otra cantidad', async ({ page }) => {
  const errors = await openWorkload(page, { mode: 'sim', query: 'huerto=palta-alta-densidad&nw=12&act=mixed&dur=600&robots=2&estrategia=opuestas' })
  const agentes = page.getByTestId('step-agentes')
  // el enlace deja elegidos 2 robots y su estrategia
  await expect(agentes.getByRole('group', { name: 'Cantidad de robots' }).getByRole('button', { name: '2', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(agentes.getByRole('group', { name: 'Cómo se reparten' }).getByRole('button', { name: 'Direcciones opuestas' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  // la escena rotula a los dos robots
  await expect(page.getByText(/^RB-01 · a bordo/).first()).toBeAttached()
  await expect(page.getByText(/^RB-02 · a bordo/).first()).toBeAttached()
  // la lista tiene una fila por robot y el detalle de RB-02 dice su estado
  await page.getByRole('tab', { name: 'Personas' }).click()
  await page.locator('.wl .li', { hasText: 'RB-02' }).click()
  await expect(page.locator('.detail-title')).toHaveText('RB-02')
  await expect(page.locator('.detail')).toContainText('Estado')
  // la pestaña Robot: una columna por robot y el total de la flota
  await page.getByRole('tab', { name: 'Robot' }).click()
  const tabla = page.getByTestId('flota-tabla')
  await expect(tabla.locator('th')).toHaveText(['Métrica', 'RB-01', 'RB-02', 'Flota'])
  await expect(tabla).toContainText('Cajas atendidas')
  await expect(tabla).toContainText('Esperando calle libre')
  // «Comparar con» otra cantidad de robots: 1 frente a 2 sobre el mismo escenario
  await page.getByRole('group', { name: 'Comparar con' }).getByRole('button', { name: 'Otra cantidad de robots' }).click()
  await page.getByRole('group', { name: 'Cantidad de robots de la comparación' }).getByRole('button', { name: '1', exact: true }).click()
  await simulate(page)
  await expect(page.getByTestId('wb-views').locator('.wb-chip')).toHaveText([/^Con 1 robot/, /^Con 2 robots/])
  // la pestaña Robot sigue siendo la de la flota principal y trae además la tabla lado a lado de las dos corridas
  await expect(page.getByTestId('flota-tabla').locator('th')).toHaveText(['Métrica', 'RB-01', 'RB-02', 'Flota'])
  await expect(page.getByTestId('robot-cmp')).toBeVisible()
  expect(errors).toEqual([])
})
