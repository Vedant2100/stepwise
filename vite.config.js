import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { callLLM } from './api/llm.js'

// Serves api/llm.js during `npm run dev`, so local development matches Vercel.
function devApi(env) {
  return {
    name: 'stepwise-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/llm', async (req, res) => {
        let raw = ''
        for await (const chunk of req) raw += chunk
        let body
        try {
          body = JSON.parse(raw)
        } catch {
          body = null
        }
        const { status, data } = await callLLM(body, req.headers['x-access-code'], env)
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(data))
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), devApi(loadEnv(mode, process.cwd(), ''))],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['pyodide'] },
  test: { environment: 'node' },
}))
