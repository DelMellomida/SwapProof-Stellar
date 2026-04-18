import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Required for Stellar SDK in browser
    global: 'globalThis',
  },
  optimizeDeps: {
    // Pre-bundle Stellar SDK to avoid ESM issues
    include: ['@stellar/stellar-sdk', '@stellar/freighter-api'],
  },
})
