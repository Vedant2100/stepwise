import { createHash } from 'node:crypto'
import { getCache } from '@vercel/functions'

const MAX_IMAGE_BYTES = 3_000_000
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const FETCH_TTL = 60 * 60 * 24
const cache = getCache({ namespace: 'stepwise-ingest-v1' })

const FETCH_ERRORS = {
  url_not_accessible: 'That page couldn’t be opened. It may need a login or block automated access.',
  too_many_requests: 'That site is rate limiting requests. Try again in a minute.',
  unsupported_content_type: 'That link isn’t a web page or PDF.',
  url_too_long: 'That link is too long.',
}

async function anthropic(env, body, beta) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      ...(beta && { 'anthropic-beta': beta }),
    },
    body: JSON.stringify({ model: env.STEPWISE_MODEL || 'claude-haiku-5-5', ...body }),
  })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.error?.message || 'Model request failed.'), { status: 502 })
  return data
}

async function fetchPage(url, env, store) {
  const key = createHash('sha256').update(url).digest('hex')
  const hit = await store.get(key).catch(() => null)
  if (hit) return hit
  const data = await anthropic(env, {
    max_tokens: 64,
    tools: [{ type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 1, max_content_tokens: 20000 }],
    messages: [{ role: 'user', content: `Fetch ${url} and then reply with just the word done.` }],
  }, 'web-fetch-2025-09-10')
  const result = data.content.find((c) => c.type === 'web_fetch_tool_result')?.content
  if (!result) throw Object.assign(new Error('That page couldn’t be fetched.'), { status: 422 })
  if (result.type === 'web_fetch_tool_error') throw Object.assign(new Error(FETCH_ERRORS[result.error_code] || 'That page couldn’t be fetched.'), { status: 422 })
  const doc = result.content
  const out = doc.source.type === 'text'
    ? { title: doc.title || url, text: doc.source.data }
    : { title: doc.title || url, pdf: doc.source.data }
  await store.set(key, out, { ttl: FETCH_TTL, name: 'stepwise fetched page' }).catch(() => {})
  return out
}

async function readImage(image, env) {
  const data = await anthropic(env, {
    max_tokens: 3000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
        { type: 'text', text: 'Turn this image into study notes: transcribe all text exactly, write formulas in LaTeX between $ signs, and describe diagrams, charts and tables precisely. Plain markdown only, no commentary.' },
      ],
    }],
  })
  return { title: image.name || 'Image', text: data.content.map((c) => c.text ?? '').join('') }
}

export async function handleIngest(body, accessCode, env = process.env, store = cache) {
  if (env.STEPWISE_ACCESS_CODE && accessCode !== env.STEPWISE_ACCESS_CODE) return { status: 401, data: { error: 'Wrong or missing access code.' } }
  if (!env.ANTHROPIC_API_KEY) return { status: 500, data: { error: 'ANTHROPIC_API_KEY is not set on the server.' } }
  try {
    if (typeof body?.url === 'string') {
      const url = new URL(body.url)
      if (!['http:', 'https:'].includes(url.protocol) || body.url.length > 2000) return { status: 400, data: { error: 'Only http and https links can be fetched.' } }
      return { status: 200, data: await fetchPage(url.href, env, store) }
    }
    const image = body?.image
    if (image && IMAGE_TYPES.includes(image.mediaType) && typeof image.data === 'string') {
      if (image.data.length * 0.75 > MAX_IMAGE_BYTES) return { status: 413, data: { error: 'That image is over 3 MB.' } }
      return { status: 200, data: await readImage(image, env) }
    }
    return { status: 400, data: { error: 'Send a url, or an image as { mediaType, data }.' } }
  } catch (e) {
    return { status: e.status || 400, data: { error: e instanceof TypeError ? 'That doesn’t look like a valid link.' : e.message } }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only.' })
  const { status, data } = await handleIngest(req.body, req.headers['x-access-code'])
  res.status(status).json(data)
}
