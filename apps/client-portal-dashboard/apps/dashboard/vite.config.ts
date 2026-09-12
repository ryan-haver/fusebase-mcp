import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: process.env.PORT,
    watch: {
      // Prevent unnecessary reloads from debug logs written by fusebase dev start
      ignored: ['**/logs/**'],
    },
  },
})
