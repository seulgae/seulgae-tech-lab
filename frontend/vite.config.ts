import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Phaser·React는 배포마다 거의 바뀌지 않으므로 앱 코드와 분리해, 재배포 후에도 브라우저 캐시를 그대로 쓴다.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'phaser', test: /node_modules[\\/]phaser/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 1300,
  },
  server: {
    host: '127.0.0.1',
    fs: { allow: ['.', '../shared'] },
    proxy: {
      '/api': process.env.LAB_DEV_BACKEND_URL ?? 'http://127.0.0.1:8080',
      '/ws': { target: process.env.LAB_DEV_BACKEND_URL ?? 'http://127.0.0.1:8080', ws: true },
    },
  },
})
