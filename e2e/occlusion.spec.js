import { test, expect } from '@playwright/test'

test('el modo Oclusión carga y su simulación se puede pausar', async ({ page }) => {
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await page.getByRole('button', { name: 'Oclusión' }).click()
  await expect(page.getByText('Selector de punto de vista')).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.getByRole('button', { name: /Pausar/ }).click()
  await expect(page.getByRole('button', { name: /Reanudar|Continuar|Reproducir/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('el modo elegido se recuerda al recargar', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Oclusión' }).click()
  await page.reload()
  await expect(page.getByText('Selector de punto de vista')).toBeVisible()
})
