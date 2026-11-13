import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Three.js is only fetched on demand when a visitor opens the 3D map.
    chunkSizeWarningLimit: 600,
  },
})
