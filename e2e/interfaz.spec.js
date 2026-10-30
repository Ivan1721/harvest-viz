// ui-p2: la columna derecha cabe a 1.024 px y la ayuda funciona sin ratón (antes estaba solo en title).
import { test, expect } from '@playwright/test'
import { openWorkload } from './helpers.js'

/** Ancho útil y ocupado de las pestañas y de la columna derecha, y qué pestañas quedan fuera. */
const medir = (page) =>
  page.evaluate(() => {
    const der = document.querySelector('.wb-right')
    const tabs = der.querySelector('[role=tablist]')
    const borde = tabs.getBoundingClientRect().right
    return {
      columna: der.scrollWidth - der.clientWidth,
      fuera: [...tabs.querySelectorAll('[role=tab]')].filter((b) => b.getBoundingClientRect().right > borde + 1).map((b) => b.textContent),
    }
  })

for (const [w, h] of [
  [1024, 768],
  [1280, 800],
]) {
  test(`a ${w} px las seis pestañas caben y la columna derecha no tiene barra horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h })
    const errors = await openWorkload(page, { mode: 'sim' })
    await expect(page.locator('.wb-right [role=tablist]').first().getByRole('tab')).toHaveCount(6)
    expect(await medir(page)).toEqual({ columna: 0, fuera: [] })
    // la pestaña de más a la derecha se puede abrir con un clic
    await page.getByRole('tab', { name: 'Datos' }).click()
    await expect(page.getByRole('tab', { name: 'Datos' })).toHaveAttribute('aria-selected', 'true')
    expect(errors).toEqual([])
  })
}

test('la ayuda se abre con el teclado, se cierra con Esc y el motivo de una opción deshabilitada se ve', async ({ page }) => {
  const errors = await openWorkload(page, { mode: 'sim' })
  await page.getByTestId('crew-params').click()
  // la fuente del parámetro, antes solo en title, se abre al llegar al campo con el teclado
  const campo = page.getByLabel('Velocidad de caminata (m/s)', { exact: true })
  await campo.focus()
  const ayuda = page.getByRole('tooltip', { name: 'MATLAB: 0,75' })
  await expect(ayuda).toBeVisible()
  await expect(campo).toHaveAccessibleDescription('MATLAB: 0,75')
  await page.keyboard.press('Escape')
  await expect(ayuda).toBeHidden()
  // en el mapa del estudio, comparar con otro robot no se puede y el motivo está escrito
  await expect(page.getByText('Otro robot, Otra cantidad de robots: solo en los huertos generados.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Otro robot' })).toHaveAttribute('aria-disabled', 'true')
  // la barra de proximidad tiene su leyenda dibujada
  await expect(page.getByTestId('heat-ley')).toContainText('< 0,45 m')
  expect(errors).toEqual([])
})
