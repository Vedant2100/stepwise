import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { callLLM } from './api/llm.js'
import { handleAuth } from './api/auth.js'
import { handleData } from './api/data.js'
import { respond } from './server/http.js'

async function readJSON(req) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// Serves the api/ functions during `npm run dev`, so local development matches Vercel.
// Without Upstash env vars, accounts and synced data live in memory until the dev server restarts.
function devApi(env) {
  return {
    name: 'stepwise-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/llm', async (req, res) => {
        const { status, data } = await callLLM(await readJSON(req), req.headers['x-access-code'], env)
        respond(res, { status, data })
      })
      for (const [path, handle] of [['/api/auth', handleAuth], ['/api/data', handleData]]) {
        server.middlewares.use(path, async (req, res) => {
          const body = req.method === 'GET' ? null : await readJSON(req)
          respond(res, await handle({ method: req.method, body, cookie: req.headers.cookie ?? '' }), false)
        })
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), devApi(loadEnv(mode, process.cwd(), ''))],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['pyodide'] },
  test: { environment: 'node' },
}))
