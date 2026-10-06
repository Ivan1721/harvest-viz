import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// base './' permite servir el sitio desde cualquier subruta (GitHub Pages: /nombre-repo/)
export default defineConfig({ base: './', plugins: [react()] })
