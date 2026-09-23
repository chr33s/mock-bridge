import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // The mock server's port, from the repo root's .env.
  const { SHOPIFY_PORT = '3080' } = loadEnv(mode, '..', 'SHOPIFY_')

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    server: {
      proxy: {
        '/api': {
          target: `http://localhost:${SHOPIFY_PORT}`,
          changeOrigin: true,
        },
      },
    },
  }
})
