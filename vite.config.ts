import { defineConfig } from 'vite'

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/solar_system/' : '/',
  server: {
    port: 8080,
    open: false
  },
  build: {
    target: 'es2022'
  }
}))
