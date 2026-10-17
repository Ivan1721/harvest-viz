import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { openWorkload } from './helpers.js'

test('exporta un video MP4 de la reproducción', async ({ page }) => {
  const errors = await openWorkload(page)
  await page.getByRole('button', { name: 'Humano-robot' }).click()
  const video = page.locator('section', { has: page.getByRole('heading', { name: 'Video' }) })
  await video.locator('label', { hasText: 'Hasta' }).locator('input').fill('0.2') // 12 s de simulación
  await video.getByRole('button', { name: '×5', exact: true }).click()
  await video.getByRole('button', { name: '720p' }).click()
  await video.getByRole('button', { name: '30', exact: true }).click()
  await expect(video.getByText(/72 cuadros/)).toBeVisible() // 12 s / ×5 = 2,4 s × 30 fps
  const dl = page.waitForEvent('download', { timeout: 240_000 })
  await video.getByRole('button', { name: 'Exportar video (MP4)' }).click()
  const d = await dl
  expect(d.suggestedFilename()).toMatch(/_0-12s_x5_720p30\.mp4$/)
  const buf = fs.readFileSync(await d.path())
  expect(buf.length).toBeGreaterThan(10_000)
  expect(buf.subarray(4, 8).toString('latin1')).toBe('ftyp') // contenedor MP4
  expect(errors).toEqual([])
})
