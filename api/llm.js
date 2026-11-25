// Stored replies are served without the access code (they're the same for everyone and cost nothing),
// which is what lets a visitor start a starter climb straight away. Anything that reaches the model
// still needs the code.
import { createHash } from 'node:crypto'
import { getCache } from '@vercel/functions'

const MAX_CHARS = 60_000
const TTL = 60 * 60 * 24 * 30
const cache = getCache({ namespace: 'stepwise-llm-v1' })

export async function callLLM(body, accessCode, env = process.env, store = cache) {
  const { system, prompt, cache: share } = body ?? {}
  if (typeof system !== 'string' || typeof prompt !== 'string' || !prompt.trim()) {
    return { status: 400, data: { error: 'system and prompt must be strings.' } }
  }
  if (system.length + prompt.length > MAX_CHARS) {
    return { status: 413, data: { error: `Request too long (max ${MAX_CHARS} characters).` } }
  }
  const model = env.STEPWISE_MODEL || 'claude-haiku-5-5'
  const variant = Number.isInteger(share?.variant) ? Math.min(Math.max(share.variant, 0), 9) : 0
  const key = share ? createHash('sha256').update(JSON.stringify([model, system, prompt, variant])).digest('hex') : null
  if (key && !share.fresh) {
    const hit = await store.get(key).catch(() => null)
    if (typeof hit === 'string') return { status: 200, data: { text: hit, cached: true } }
  }
  if (env.STEPWISE_ACCESS_CODE && accessCode !== env.STEPWISE_ACCESS_CODE) {
    return { status: 401, data: { error: 'Wrong or missing access code.' } }
  }
  if (!env.ANTHROPIC_API_KEY) {
    return { status: 500, data: { error: 'ANTHROPIC_API_KEY is not set on the server.' } }
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  if (!res.ok) return { status: 502, data: { error: data.error?.message || 'Model request failed.' } }
  const text = data.content.map((c) => c.text ?? '').join('')
  if (key) await store.set(key, text, { ttl: TTL, name: 'stepwise plan or exercise' }).catch(() => {})
  return { status: 200, data: { text, cached: false } }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' })
  const { status, data } = await callLLM(req.body, req.headers['x-access-code'])
  res.status(status).json(data)
}
