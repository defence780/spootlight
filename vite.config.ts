import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    // Configure preview server to handle SPA routing
    port: 4173,
    strictPort: true,
  },
  build: {
    // Ensure proper handling of client-side routing
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})

