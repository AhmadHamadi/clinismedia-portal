import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Ensure production builds don't use eval
    target: 'esnext',
    minify: 'esbuild', // Use esbuild instead of terser (faster, no eval)
    rollupOptions: {
      output: {
        // Ensure no eval in production
        format: 'es',
      }
    }
  },
  // Disable source maps in production to avoid eval issues
  esbuild: {
    legalComments: 'none',
  }
})
