import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { callLLM } from './api/llm.js'
import { handleAuth } from './api/auth.js'
import { handleData } from './api/data.js'
import { respond } from './server/http.js'
import { handleShare } from './server/share.js'
import { sharedStore } from './server/store.js'

async function readJSON(req) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function devApi(env) {
  return {
    name: 'stepwise-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/llm', async (req, res) => {
        const { status, data } = await callLLM(await readJSON(req), req.headers['x-access-code'], env)
        respond(res, { status, data })
      })
      const share = (r) => handleShare(r, sharedStore())
      for (const [path, handle] of [['/api/auth', handleAuth], ['/api/data', handleData], ['/api/share', share]]) {
        server.middlewares.use(path, async (req, res) => {
          const body = req.method === 'GET' ? null : await readJSON(req)
          const query = Object.fromEntries(new URL(req.url, 'http://dev').searchParams)
          respond(res, await handle({ method: req.method, body, query, ip: '127.0.0.1', cookie: req.headers.cookie ?? '' }), false)
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
