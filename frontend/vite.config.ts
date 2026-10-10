import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The backend the dev server forwards /api to: the deployed Render API by default, so the local
// frontend works without running Python. Set API_PROXY_TARGET=http://127.0.0.1:8000 in frontend/.env
// to use a local backend instead.
const RENDER_API = 'https://formpilot-yapl.onrender.com'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '') // '' prefix: also read non-VITE_ variables such as API_PROXY_TARGET
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // The Use Anywhere demo imports the browser extension's core from ../extension.
      fs: { allow: ['.', '../extension'] },
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || RENDER_API,
          changeOrigin: true,
          // Render's free plan sleeps; the first request after a while can take up to a minute.
          timeout: 120_000,
          proxyTimeout: 120_000,
        },
      },
    },
  }
})
