import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    legacy({
      targets: ['edge >= 17', 'ie >= 11', 'firefox >= 50', 'chrome >= 64', 'safari >= 11.1']
    })
  ],
  build: {
    target: 'es2018'
  }
})