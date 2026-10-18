import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { saveSimsPlugin, saveEnabled } from './scripts/vite-save-sims.js'
// base './' permite servir el sitio desde cualquier subruta (GitHub Pages: /nombre-repo/)
export default defineConfig(({ command, isPreview }) => ({
  base: './',
  plugins: [react(), saveSimsPlugin()],
  // guardado local de simulaciones: solo en `npm run dev` fuera de CI (el sitio publicado no guarda nada)
  define: { __HV_SAVE_SIMS__: JSON.stringify(command === 'serve' && !isPreview && !process.env.VITEST && saveEnabled()) },
  // pruebas de componentes (vitest + jsdom); el motor y los datos se prueban con node:test en tests/**/*.test.mjs
  test: { environment: 'jsdom', include: ['tests/components/**/*.test.jsx'], setupFiles: ['tests/components/setup.js'], globals: false },
  build: {
    chunkSizeWarningLimit: 800, // three.js minificado pesa ~680 kB por sí solo
    rolldownOptions: {
      output: {
        // three.js y react-three en un chunk propio: se cachean entre despliegues y entre modos
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 2 },
            { name: 'r3f', test: /node_modules[\\/]@react-three[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
}))
