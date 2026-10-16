import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// base './' permite servir el sitio desde cualquier subruta (GitHub Pages: /nombre-repo/)
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800, // three.js minificado pesa ~680 kB por sí solo
    rollupOptions: {
      output: {
        // three.js y react-three en un chunk propio: se cachean entre despliegues y entre modos
        manualChunks: { three: ['three'], r3f: ['@react-three/fiber', '@react-three/drei'] },
      },
    },
  },
})
