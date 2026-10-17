// Accesibilidad con axe-core: sin violaciones críticas ni graves (WCAG 2.1 A/AA).
// El lienzo 3D se excluye: su contenido no es accesible por naturaleza y se describe con texto en los paneles.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { openWorkload, useSimulator } from './helpers.js'

async function audit(page, label) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('canvas').analyze()
  const bad = r.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
  const report = bad.map(
    (v) =>
      `${v.impact} · ${v.id} · ${v.help} (${v.nodes.length}) → ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  )
  test.info().annotations.push({ type: `axe ${label}`, description: `${r.violations.length} violaciones (${bad.length} críticas/graves)` })
  expect(report, `Violaciones de accesibilidad en ${label}`).toEqual([])
}

test('Workload (datos MATLAB) sin violaciones críticas ni graves', async ({ page }) => {
  await openWorkload(page)
  await audit(page, 'Workload')
})

test('Workload (simulador + validación) sin violaciones críticas ni graves', async ({ page }) => {
  await openWorkload(page)
  await useSimulator(page)
  await page.getByTestId('sim-params').click()
  await page.getByRole('tab', { name: 'Validación' }).click()
  await audit(page, 'Simulador')
})

test('Oclusión sin violaciones críticas ni graves', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Oclusión' }).click()
  await page.getByText('Selector de punto de vista').waitFor()
  await audit(page, 'Oclusión')
})
