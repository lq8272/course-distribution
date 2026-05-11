import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import path from 'path'

export default defineConfig({
  plugins: [
    uni()
  ],
  server: {
    host: '0.0.0.0',
    port: 5173
  },
  build: {
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname)
    }
  }
})
